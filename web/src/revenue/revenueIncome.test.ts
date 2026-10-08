import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import { validateBackup } from "./storage";
import { summarizeRevenueIncome, summarizeRevenueIncomeRange } from "./revenueIncome";
import type { Platform, RevenueRow } from "./types";

function row(platform: Platform, basis: RevenueRow["basis"], patch: Partial<RevenueRow> = {}): RevenueRow {
  return {
    id: `${platform}:${basis}:2026-09`, reportKey: `${platform}:${basis}`, date: "2026-09-01", endDate: "2026-09-30", period: "2026-09",
    source: platform === "apple" ? basis === "settled" ? "apple-finance" : "apple-sales" : basis === "settled" ? "google-earnings" : "google-sales",
    periodKind: platform === "apple" && basis === "settled" ? "fiscal" : "calendar",
    appId: `${platform}:test`, appName: "테스트", platform, country: "KR", currency: "KRW", proceedsCurrency: "KRW",
    gross: 100, refunds: 0, fee: null, tax: null, proceeds: platform === "google" && basis === "estimate" ? null : 70,
    units: 1, basis, taxClass: "unreviewed", ...patch,
  };
}

describe("report-based income including estimates", () => {
  it("uses actual Apple sales-report proceeds plus Google final proceeds without inventing a commission", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate", { proceeds: 75 }), row("google", "estimate"), row("google", "settled", { proceeds: 65 })];
    const result = summarizeRevenueIncome(data, "2026-09");
    expect(result.total).toBe(140);
    expect(result.partialSum).toBe(140);
    expect(result.perPlatform.apple).toMatchObject({ basis: "estimate", value: 75 });
    expect(result.perPlatform.google).toMatchObject({ basis: "settled", value: 65 });
    expect(result.perPlatform.google.rows).toHaveLength(1);
    expect(result.hasEstimates).toBe(true);
    expect(result.unknownPlatforms).toEqual([]);
  });

  it("prefers final Apple proceeds and excludes its estimate rather than adding both", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate", { proceeds: 75 }), row("apple", "settled", { proceeds: 60 })];
    const result = summarizeRevenueIncome(data, "2026-09");
    expect(result.total).toBe(60);
    expect(result.perPlatform.apple.basis).toBe("settled");
    expect(result.hasEstimates).toBe(false);
  });

  it("does not fall back to a known estimate when an existing final report needs an FX rate", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate"), row("apple", "settled", { proceedsCurrency: "USD" })];
    const result = summarizeRevenueIncome(data, "2026-09");
    expect(result.total).toBeNull();
    expect(result.perPlatform.apple).toMatchObject({ basis: "settled", value: null, missingFx: 1 });
    expect(result.unknownPlatforms).toEqual(["apple"]);
  });

  it("never uses a legacy assumed Google sales net amount as reported proceeds", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate"), row("google", "estimate", { reportKey: "google:sales/salesreport_202609.zip:salesreport_202609.csv", source: undefined, fee: 30, proceeds: 70 })];
    const result = summarizeRevenueIncome(data, "2026-09");
    expect(result.total).toBeNull();
    expect(result.partialSum).toBe(70);
    expect(result.perPlatform.google).toMatchObject({ value: null, unknownProceeds: 1 });
    expect(result.unknownPlatforms).toEqual(["google"]);
  });

  it("keeps known KRW proceeds when only buyer-currency FX is missing", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate", { currency: "USD" })];
    expect(summarizeRevenueIncome(data, "2026-09").perPlatform.apple).toMatchObject({ basis: "estimate", value: 70, missingFx: 0 });
  });

  it("accepts reported zero proceeds without requiring an unsupported currency rate", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate", { gross: 0, proceeds: 0, currency: "AED", proceedsCurrency: "AED" })];
    expect(summarizeRevenueIncome(data, "2026-09")).toMatchObject({ total: 0, partialSum: 0, unknownPlatforms: [] });
  });

  it("keeps partial known rows separate when another row in the same store is unknown", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate"), row("apple", "estimate", { id: "missing-currency", proceedsCurrency: "USD" })];
    const result = summarizeRevenueIncome(data, "2026-09");
    expect(result.total).toBeNull();
    expect(result.partialSum).toBe(70);
    expect(result.perPlatform.apple).toMatchObject({ value: null, partialSum: 70, missingFx: 1 });
  });

  it("retains signed refund proceeds", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate", { gross: 0, refunds: 100, proceeds: -70, units: -1 })];
    expect(summarizeRevenueIncome(data, "2026-09").total).toBe(-70);
  });

  it("exposes the fiscal range when Apple final and Google calendar reports are combined", () => {
    const data = emptyData(); data.rows = [row("apple", "settled", { date: "2026-08-30", endDate: "2026-09-26" }), row("google", "settled", { date: "2026-08-31", endDate: undefined })];
    const result = summarizeRevenueIncome(data, "2026-09");
    expect(result.mixedPeriods).toBe(true);
    expect(result.hasFiscalPeriods).toBe(true);
    expect(result.perPlatform.apple.periodRanges).toEqual([{ start: "2026-08-30", end: "2026-09-26" }]);
    expect(result.perPlatform.google.periodRanges).toEqual([{ start: "2026-09-01", end: "2026-09-30" }]);
  });

  it("reuses coverage inference so a previously observed missing store prevents a full total", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate", { id: "old", period: "2026-08" }), row("google", "settled")];
    const result = summarizeRevenueIncome(data, "2026-09");
    expect(result.perPlatform.apple.basis).toBe("missing");
    expect(result.total).toBeNull();
    expect(result.partialSum).toBe(70);
    expect(result.unknownPlatforms).toEqual(["apple"]);
  });

  it("does not require Apple in a Google-only report scope and leaves an empty account unknown", () => {
    const data = emptyData(); data.rows = [row("google", "settled")];
    expect(summarizeRevenueIncome(data, "2026-09").total).toBe(70);
    expect(summarizeRevenueIncome(emptyData(), "2026-09").total).toBeNull();
  });

  it("does not double-count retained Apple daily rows after the monthly report arrives", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate", { id: "daily", reportKey: "apple-sales:2026-09-01", endDate: "2026-09-01", proceeds: 5 }), row("apple", "estimate", { id: "monthly", reportKey: "apple-sales-month:2026-09", proceeds: 70 })];
    const result = summarizeRevenueIncome(data, "2026-09");
    expect(result.total).toBe(70);
    expect(result.perPlatform.apple.rows).toHaveLength(1);
  });
});

describe("income across report periods", () => {
  it("blocks cumulative totals when a calendar estimate overlaps next month's Apple fiscal report", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate"), row("apple", "settled", { id: "oct-final", period: "2026-10", date: "2026-09-27", endDate: "2026-10-31" })];
    const result = summarizeRevenueIncomeRange(data, ["2026-09", "2026-10"]);
    expect(result.months.map((month) => month.total)).toEqual([70, 70]);
    expect(result.hasOverlappingPeriods).toBe(true);
    expect(result.total).toBeNull();
    expect(result.partialSum).toBeNull();
    expect(result.overlappingPeriods).toEqual([{ platform: "apple", firstMonth: "2026-09", secondMonth: "2026-10", start: "2026-09-27", end: "2026-09-30" }]);
  });

  it("sums non-overlapping fiscal periods without inventing calendar reallocation", () => {
    const data = emptyData(); data.rows = [row("apple", "settled", { date: "2026-08-30", endDate: "2026-09-26" }), row("apple", "settled", { id: "oct-final", period: "2026-10", date: "2026-09-27", endDate: "2026-10-31" })];
    expect(summarizeRevenueIncomeRange(data, ["2026-10", "2026-09", "2026-09"])).toMatchObject({ total: 140, partialSum: 140, hasOverlappingPeriods: false, incompleteMonths: [] });
  });

  it("does not flag normal Google month boundaries based on an older original transaction date", () => {
    const data = emptyData(); data.rows = [row("google", "settled"), row("google", "settled", { id: "oct", period: "2026-10", date: "2026-09-30", endDate: undefined })];
    expect(summarizeRevenueIncomeRange(data, ["2026-09", "2026-10"])).toMatchObject({ total: 140, partialSum: 140, hasOverlappingPeriods: false });
  });

  it("does not treat different stores' overlapping dates as duplicate income", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate"), row("google", "settled", { id: "oct-google", period: "2026-10", periodKind: "fiscal", date: "2026-09-27", endDate: "2026-10-31" })];
    const result = summarizeRevenueIncomeRange(data, ["2026-09", "2026-10"]);
    expect(result.hasOverlappingPeriods).toBe(false);
    expect(result.partialSum).toBe(140);
    expect(result.total).toBeNull();
    expect(result.incompleteMonths).toEqual(["2026-10"]);
  });

  it("preserves the known subtotal while current Google sales have no reported proceeds", () => {
    const data = emptyData(); data.rows = [row("google", "settled"), row("google", "estimate", { id: "oct-sales", period: "2026-10", date: "2026-10-01", endDate: "2026-10-08" })];
    const result = summarizeRevenueIncomeRange(data, ["2026-09", "2026-10"]);
    expect(result.total).toBeNull();
    expect(result.partialSum).toBe(70);
    expect(result.hasEstimates).toBe(true);
    expect(result.incompleteMonths).toEqual(["2026-10"]);
  });
});


describe("Google Orders provenance", () => {
  it("uses verified order proceeds but continues rejecting the old fee guess", () => {
    const data = emptyData();
    data.rows = [row("google", "estimate", { proceeds: 67, proceedsSource: "google-orders", proceedsFetchedAt: "2026-10-08T10:00:00Z" })];
    expect(summarizeRevenueIncome(data, "2026-09").total).toBe(67);
    data.rows[0].proceedsFetchedAt = "invalid";
    expect(summarizeRevenueIncome(data, "2026-09").total).toBeNull();
    delete data.rows[0].proceedsSource;
    delete data.rows[0].proceedsFetchedAt;
    expect(summarizeRevenueIncome(data, "2026-09").total).toBeNull();
  });
  it("does not subtract a refund twice from an order's current net proceeds", () => {
    const data = emptyData();
    data.rows = [row("google", "estimate", { proceeds: 35, proceedsSource: "google-orders", proceedsFetchedAt: "2026-10-08T10:00:00Z" }), row("google", "estimate", { id: "refund", gross: 0, refunds: 50, proceeds: 0, proceedsSource: "google-orders", proceedsFetchedAt: "2026-10-08T10:00:00Z" })];
    expect(summarizeRevenueIncome(data, "2026-09").total).toBe(35);
  });
});


describe("persisted order-proceeds provenance", () => {
  it("retains verified income after saving and reloading a browser snapshot", () => {
    const data = emptyData();
    data.rows = [row("google", "estimate", { proceeds: 67, proceedsSource: "google-orders", proceedsFetchedAt: "2026-10-08T10:00:00Z" })];
    const reloaded = validateBackup(JSON.parse(JSON.stringify(data)));
    expect(summarizeRevenueIncome(reloaded, "2026-09").total).toBe(67);
  });
  it("rejects malformed provenance instead of converting it to trusted income on reload", () => {
    const data = emptyData();
    data.rows = [row("google", "estimate", { proceeds: 67, proceedsSource: "google-orders", proceedsFetchedAt: "invalid" })];
    expect(() => validateBackup(data)).toThrow("잘못된 거래");
    data.rows[0].proceedsFetchedAt = "2026-10-08T10:00:00Z";
    data.rows[0].basis = "settled";
    expect(() => validateBackup(data)).toThrow("잘못된 거래");
  });
});
