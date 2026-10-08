import { describe, expect, it } from "vitest";
import { getStoreIncomeStatus } from "./incomeStatus";
import { emptyData } from "./model";
import { summarizeRevenueIncome } from "./revenueIncome";
import type { RevenueData, RevenueRow } from "./types";

function sales(month = "2026-10", patch: Partial<RevenueRow> = {}): RevenueRow {
  return {
    id: `google-sales:${month}`, reportKey: `google:sales/salesreport_${month.replace("-", "")}.zip:report.csv`,
    source: "google-sales", periodKind: "calendar", date: `${month}-01`, period: month,
    appId: "google:test", appName: "테스트", platform: "google", country: "KR",
    currency: "KRW", proceedsCurrency: "KRW", gross: 100, refunds: 0, fee: null, tax: null, proceeds: null,
    units: 1, basis: "estimate", taxClass: "unreviewed", ...patch,
  };
}
function dataWith(...rows: RevenueRow[]): RevenueData {
  return { ...emptyData(), rows };
}
function status(data: RevenueData, month = "2026-10", now = "2026-10-08T03:00:00Z") {
  return getStoreIncomeStatus({ data, month, platform: "google", income: summarizeRevenueIncome(data, month).perPlatform.google, now: new Date(now) });
}

describe("income availability, with Seoul publication boundaries", () => {
  it("treats current-month Google sales without earnings as settlement pending, keeping net proceeds unknown", () => {
    const data = dataWith(sales());
    const before = structuredClone(data);
    expect(status(data)).toMatchObject({ state: "settlement-pending", label: "정산 예정", actionRequired: false, expectedBy: "2026-11-05" });
    expect(status(data).detail).toContain("보통 11월 5일까지 공개");
    expect(summarizeRevenueIncome(data, "2026-10").perPlatform.google.value).toBeNull();
    expect(data).toEqual(before);
  });

  it("keeps the previous month pending until the end of November 5 in Seoul", () => {
    expect(status(dataWith(sales()), "2026-10", "2026-11-05T14:59:59.999Z").state).toBe("settlement-pending");
  });

  it("marks a missing past report actionable at November 6 00:00 KST even while UTC is still November 5", () => {
    const result = status(dataWith(sales()), "2026-10", "2026-11-05T15:00:00.000Z");
    expect(result).toMatchObject({ state: "report-missing", label: "확정 보고서 미수집", actionRequired: true, expectedBy: "2026-11-05" });
  });

  it("recognizes October's start in Seoul while UTC is still September", () => {
    expect(status(dataWith(sales()), "2026-10", "2026-09-30T15:00:00.000Z").state).toBe("settlement-pending");
    expect(status(dataWith(sales()), "2026-10", "2026-09-30T14:59:59.999Z").state).not.toBe("settlement-pending");
  });

  it("does not mark a September report pending on October 8", () => {
    expect(status(dataWith(sales("2026-09")), "2026-09")).toMatchObject({ state: "report-missing", actionRequired: true, expectedBy: "2026-10-05" });
  });

  it("handles the December-to-January publication window", () => {
    expect(status(dataWith(sales("2026-12")), "2026-12", "2027-01-04T20:00:00Z")).toMatchObject({ state: "settlement-pending", expectedBy: "2027-01-05" });
  });

  it("switches to ready when an earnings report arrives, including a legitimate zero", () => {
    for (const proceeds of [65, 0]) {
      const data = dataWith(sales(), sales("2026-10", { id: "earnings", reportKey: "google:earnings", source: "google-earnings", basis: "settled", proceeds }));
      expect(status(data)).toMatchObject({ state: "ready", label: "확정", actionRequired: false });
      expect(status(data).expectedBy).toBeUndefined();
    }
  });

  it("prioritizes missing proceeds FX over the ordinary publication window", () => {
    const data = dataWith(sales(), sales("2026-10", { id: "earnings", reportKey: "google:earnings", source: "google-earnings", basis: "settled", proceeds: 1, proceedsCurrency: "USD" }));
    expect(status(data)).toMatchObject({ state: "fx-missing", label: "환율 확인 필요", actionRequired: true });
  });

  it("keeps known KRW net proceeds ready when only sales-currency FX is missing", () => {
    const data = dataWith(sales("2026-10", { source: "google-earnings", basis: "settled", currency: "USD", proceeds: 65 }));
    expect(status(data).state).toBe("ready");
  });

  it("treats a received final report without proceeds as incomplete rather than normal waiting", () => {
    const data = dataWith(sales("2026-10", { source: "google-earnings", basis: "settled", proceeds: null }));
    expect(status(data)).toMatchObject({ state: "report-incomplete", actionRequired: true });
  });

  it("does not claim normal settlement waiting without an original Google sales report", () => {
    expect(status(emptyData()).state).toBe("report-missing");
    expect(status(dataWith(sales("2026-10", { source: "standard", reportKey: "manual" }))).state).toBe("report-incomplete");
  });

  it("discloses cached source data without claiming successful live sync or parsing unscoped errors", () => {
    const data = dataWith(sales());
    data.imports = [{ key: data.rows[0].reportKey, name: "cached report", source: "cache", importedAt: "2026-10-08T01:00:00Z", rows: 1 }];
    data.logs = [{ id: "recent", at: "2026-10-08T01:00:00Z", status: "partial", message: "sync", detail: { errors: ["Google app search 403"] } }];
    const result = status(data);
    expect(result.state).toBe("settlement-pending");
    expect(result.detail).toContain("보관본 기준");
    expect(result.detail).toContain("동기화 상태");
    expect(result.detail).not.toContain("연결 정상");
    expect(data.logs[0].status).toBe("partial");
  });

  it("does not let unrelated previous-month or app-search error text change this month's publishing state", () => {
    const data = dataWith(sales());
    data.logs = [{ id: "other", at: "2026-10-08T01:00:00Z", status: "error", message: "old job", detail: { errors: ["Apple 2026-08 financial report 403", "Google app search 403"] } }];
    expect(status(data).state).toBe("settlement-pending");
  });

  it("does not replace Apple report-provided estimates with Google settlement rules", () => {
    const data = dataWith(sales("2026-10", { platform: "apple", appId: "apple:test", source: "apple-sales", proceeds: 70 }));
    const result = getStoreIncomeStatus({ data, month: "2026-10", platform: "apple", income: summarizeRevenueIncome(data, "2026-10").perPlatform.apple, now: new Date("2026-10-08T03:00:00Z") });
    expect(result).toMatchObject({ state: "ready", label: "스토어 제공 예상", actionRequired: false });
    expect(result.expectedBy).toBeUndefined();
  });
});
