import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RevenueChart } from "./RevenueChart";
import { emptyData } from "./model";
import type { RevenueRow } from "./types";

const row = (id: string, overrides: Partial<RevenueRow> = {}): RevenueRow => ({
  id, reportKey: id, date: "2026-09-05", period: "2026-09",
  appId: "google:sample", appName: "Sample", platform: "google", country: "KR",
  currency: "KRW", proceedsCurrency: "KRW", gross: 10000, refunds: 0,
  fee: 3000, tax: 0, proceeds: 7000, units: 1,
  basis: "settled", taxClass: "unreviewed", ...overrides,
});
const render = (rows: RevenueRow[], coverageRows = rows, mode: "day" | "month" = "month") =>
  renderToStaticMarkup(<RevenueChart rows={rows} coverageRows={coverageRows}
    data={{ ...emptyData(), rows: coverageRows }} month="2026-09" mode={mode} />);

describe("revenue chart report coverage", () => {
  it("hides a Google-only final subtotal when Apple sales prove missing final coverage", () => {
    const google = row("google-final");
    const apple = row("apple-sales", { platform: "apple", appId: "apple:sample", basis: "estimate", gross: 22000 });
    const html = render([google], [apple, google]);
    expect(html).toContain("9월, 매출 미집계, 수익 미집계");
    expect(html).not.toContain("7,000");
  });
  it("allows a complete single-store filter", () => {
    const google = row("google-final");
    expect(render([google])).toContain("9월, 매출 10,000원, 수익 7,000원");
  });
  it("hides sales when a previously observed store has no report this month", () => {
    const current = row("google-sales", { source: "google-sales", basis: "estimate", proceeds: null });
    const earlier = row("apple-earlier", { platform: "apple", period: "2026-08", date: "2026-08-05", basis: "estimate" });
    expect(render([current], [current, earlier])).toContain("9월, 매출 미집계, 수익 미집계");
  });
  it("does not label a Google daily detail as complete when Apple only has a monthly report", () => {
    const google = row("google-final");
    const apple = row("apple-finance", { platform: "apple", date: "2026-09-01", endDate: "2026-09-30" });
    expect(render([google, apple], [google, apple], "day")).toContain("5일, 매출 미집계, 수익 미집계");
  });
  it("rejects mixed sales and final report bases instead of adding them", () => {
    const html = render([row("google-final"), row("google-sales", { basis: "estimate" })]);
    expect(html).toContain("예상·확정 자료가 섞여 있습니다");
    expect(html).toContain("9월, 보고서 기준 혼합 · 미집계");
    expect(html).not.toContain("14,000");
  });
  it("keeps confirmed zero income distinct from missing income", () => {
    expect(render([row("zero", { proceeds: 0 })])).toContain("9월, 매출 10,000원, 수익 0원");
  });
  it("retains a known KRW payout total when only the sales exchange rate is missing", () => {
    expect(render([row("foreign-sales", { currency: "USD", proceedsCurrency: "KRW" })]))
      .toContain("9월, 매출 미집계, 수익 7,000원");
  });
});
