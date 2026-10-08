import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import { summarizePeriodCoverage, summarizeRangeCoverage } from "./completeness";
import type { Platform, RevenueRow } from "./types";

function row(platform: Platform, month: string, basis: RevenueRow["basis"], patch: Partial<RevenueRow> = {}): RevenueRow {
  return {
    id: `${platform}:${month}:${basis}`, reportKey: `${platform}:${basis}:${month}`,
    date: `${month}-01`, period: month, appId: `${platform}:app`, appName: "테스트",
    platform, country: "KR", currency: "KRW", proceedsCurrency: "KRW",
    gross: 100, refunds: 0, fee: 20, tax: 10, proceeds: 70, units: 1,
    basis, taxClass: "unreviewed", ...patch,
  };
}

describe("store and period coverage", () => {
  it("marks a two-store sales month incomplete when only Google final proceeds exist", () => {
    const data = emptyData();
    data.rows = [row("apple", "2026-09", "estimate"), row("google", "2026-09", "estimate"), row("google", "2026-09", "settled")];
    const coverage = summarizePeriodCoverage(data, "2026-09");
    expect(coverage.sales.gross).toBe(200);
    expect(coverage.settled.proceeds).toBe(70);
    expect(coverage.expectedPlatforms).toEqual(["apple", "google"]);
    expect(coverage.completeSales).toBe(true);
    expect(coverage.completeSettled).toBe(false);
    expect(coverage.missingSettledPlatforms).toEqual(["apple"]);
    expect(coverage.perPlatform.google.completeSettled).toBe(true);
  });

  it("does not require Apple for an account with only Google report evidence", () => {
    const data = emptyData();
    data.apps = [{ id: "apple:future", name: "Future app", platform: "apple", bundleId: "com.test", version: "", build: "", status: "", updatedAt: "", source: "api" }];
    data.rows = [row("google", "2026-09", "estimate"), row("google", "2026-09", "settled")];
    const coverage = summarizePeriodCoverage(data, "2026-09");
    expect(coverage.expectedPlatforms).toEqual(["google"]);
    expect(coverage.completeSettled).toBe(true);
    expect(coverage.missingSettledPlatforms).toEqual([]);
  });

  it("does not force a newly observed store into earlier historical months", () => {
    const data = emptyData();
    data.rows = [row("google", "2026-08", "settled"), row("apple", "2026-09", "estimate")];
    expect(summarizePeriodCoverage(data, "2026-08").expectedPlatforms).toEqual(["google"]);
    expect(summarizePeriodCoverage(data, "2026-08").completeSettled).toBe(true);
  });

  it("keeps a missing period after a store's first report unknown", () => {
    const data = emptyData();
    data.rows = [row("apple", "2026-07", "estimate"), row("google", "2026-08", "settled"), row("apple", "2026-09", "settled")];
    const coverage = summarizePeriodCoverage(data, "2026-08");
    expect(coverage.expectedPlatforms).toEqual(["apple", "google"]);
    expect(coverage.missingSettledPlatforms).toEqual(["apple"]);
    expect(coverage.completeSettled).toBe(false);
  });

  it("does not let Apple final proceeds in one month hide Apple's missing final report in another", () => {
    const data = emptyData();
    data.rows = [row("apple", "2026-08", "estimate"), row("google", "2026-08", "settled"), row("apple", "2026-09", "settled"), row("google", "2026-09", "settled")];
    const range = summarizeRangeCoverage(data, ["2026-09", "2026-08", "2026-09"]);
    expect(range.monthKeys).toEqual(["2026-08", "2026-09"]);
    expect(range.settled.proceeds).toBe(210);
    expect(range.completeSettled).toBe(false);
    expect(range.missingSettledPeriods).toEqual([{ month: "2026-08", platform: "apple" }]);
  });

  it("recognizes a reported zero as complete instead of treating it as no data", () => {
    const data = emptyData();
    data.rows = [row("google", "2026-09", "settled", { gross: 0, refunds: 0, fee: 0, tax: 0, proceeds: 0, currency: "AED", proceedsCurrency: "AED" })];
    const coverage = summarizePeriodCoverage(data, "2026-09");
    expect(coverage.settled.proceeds).toBe(0);
    expect(coverage.completeSettled).toBe(true);
    expect(coverage.perPlatform.google.hasSettled).toBe(true);
  });

  it("marks present reports with unknown proceeds or missing FX as incomplete", () => {
    const data = emptyData();
    data.rows = [row("google", "2026-09", "settled", { proceedsCurrency: "USD" })];
    let coverage = summarizePeriodCoverage(data, "2026-09");
    expect(coverage.completeSettled).toBe(false);
    expect(coverage.missingSettledPlatforms).toEqual([]);
    expect(coverage.settled.missingProceedsFx).toBe(1);
    data.rows = [row("google", "2026-09", "settled", { proceeds: null })];
    coverage = summarizePeriodCoverage(data, "2026-09");
    expect(coverage.completeSettled).toBe(false);
    expect(coverage.settled.unknownProceeds).toBe(1);
  });

  it("does not omit FX failures from the range's completeness just because every file exists", () => {
    const data = emptyData();
    data.rows = [row("google", "2026-08", "settled"), row("google", "2026-09", "settled", { proceedsCurrency: "USD" })];
    const coverage = summarizeRangeCoverage(data, ["2026-08", "2026-09"]);
    expect(coverage.missingSettledPeriods).toEqual([]);
    expect(coverage.incompleteSettledMonths).toEqual(["2026-09"]);
    expect(coverage.completeSettled).toBe(false);
  });

  it("keeps known KRW proceeds complete even when buyer-currency sales FX is missing", () => {
    const data = emptyData();
    data.rows = [row("apple", "2026-09", "estimate", { currency: "USD" }), row("apple", "2026-09", "settled", { currency: "USD" })];
    const coverage = summarizePeriodCoverage(data, "2026-09");
    expect(coverage.completeSales).toBe(false);
    expect(coverage.completeSettled).toBe(true);
    expect(coverage.settled.proceeds).toBe(70);
    expect(coverage.settled.missingGrossFx).toBe(1);
    expect(coverage.settled.missingProceedsFx).toBe(0);
  });

  it("lists the current unclosed month explicitly instead of manufacturing a settled amount", () => {
    const data = emptyData();
    data.rows = [row("google", "2026-09", "settled"), row("google", "2026-10", "estimate")];
    const coverage = summarizeRangeCoverage(data, ["2026-09", "2026-10"]);
    expect(coverage.missingSettledPeriods).toEqual([{ month: "2026-10", platform: "google" }]);
    expect(coverage.completeSettled).toBe(false);
    expect(coverage.months[1].settledRows).toHaveLength(0);
  });

  it("does not claim completeness for a blank account or empty range", () => {
    const data = emptyData();
    expect(summarizePeriodCoverage(data, "2026-09")).toMatchObject({ completeSales: false, completeSettled: false, expectedPlatforms: [] });
    expect(summarizeRangeCoverage(data, [])).toMatchObject({ completeSales: false, completeSettled: false });
  });

  it("respects the selected app/store scope rather than using unrelated account rows", () => {
    const data = emptyData();
    data.rows = [row("apple", "2026-09", "estimate"), row("google", "2026-09", "settled")];
    const googleRows = data.rows.filter((row) => row.platform === "google");
    const coverage = summarizePeriodCoverage(data, "2026-09", googleRows);
    expect(coverage.expectedPlatforms).toEqual(["google"]);
    expect(coverage.completeSettled).toBe(true);
  });

  it("can require a known store before its first successful import", () => {
    const coverage = summarizePeriodCoverage(emptyData(), "2026-09", [], ["google"]);
    expect(coverage.expectedPlatforms).toEqual(["google"]);
    expect(coverage.missingSettledPlatforms).toEqual(["google"]);
    expect(coverage.completeSettled).toBe(false);
  });
});
