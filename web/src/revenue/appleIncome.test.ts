import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import { summarizeRevenueIncome, summarizeRevenueIncomeRange } from "./revenueIncome";
import { selectRevenueRows } from "./reportSelection";
import type { RevenueRow } from "./types";

function apple(date: string, endDate: string, period: string, proceeds: number, basis: "estimate" | "settled" = "estimate", key?: string): RevenueRow {
  return { id: `${basis}:${date}:${endDate}`, reportKey: key || `apple-${basis === "settled" ? "finance" : "sales"}:${date}`, source: basis === "settled" ? "apple-finance" : "apple-sales", date, endDate, period, periodKind: basis === "settled" ? "fiscal" : "calendar", appId: "apple:example", appName: "Example", platform: "apple", country: "KR", currency: "KRW", proceedsCurrency: "KRW", gross: proceeds * 2, refunds: 0, fee: null, tax: null, proceeds, units: 1, basis, taxClass: "unreviewed" };
}
const tail = () => [27, 28, 29, 30].map(day => apple(`2026-09-${day}`, `2026-09-${day}`, "2026-09", 10));

describe("Apple open fiscal income", () => {
  it("checks daily holes even when the fiscal close matches the calendar month end", () => {
    const data = emptyData(); data.rows = [apple("2026-09-01", "2026-09-30", "2026-09", 70, "settled"), apple("2026-10-01", "2026-10-01", "2026-10", 10), apple("2026-10-03", "2026-10-03", "2026-10", 20)];
    expect(summarizeRevenueIncome(data, "2026-10").perPlatform.apple).toMatchObject({ value: null, partialSum: 30, periodKind: "calendar", missingReportDates: ["2026-10-02"] });
  });
  it("does not omit an entirely missing month from the cumulative completeness check", () => {
    const data = emptyData(); data.rows = [apple("2026-07-01", "2026-07-31", "2026-07", 70, "settled"), apple("2026-09-01", "2026-09-30", "2026-09", 80, "settled")];
    expect(summarizeRevenueIncomeRange(data, ["2026-07", "2026-09"])).toMatchObject({ total: null, partialSum: 150, incompleteMonths: ["2026-08"], monthKeys: ["2026-07", "2026-08", "2026-09"] });
  });
  it("adds the September daily tail to October income once while preserving calendar sales", () => {
    const data = emptyData();
    data.rows = [apple("2026-08-30", "2026-09-26", "2026-09", 70, "settled"), apple("2026-09-01", "2026-09-30", "2026-09", 100, "estimate", "apple-sales-month:2026-09"), ...tail(), apple("2026-10-01", "2026-10-01", "2026-10", 20)];
    const october = summarizeRevenueIncome(data, "2026-10");
    expect(october.perPlatform.apple).toMatchObject({ value: 60, basis: "estimate", includesPreviousMonth: true, periodKind: "fiscal", missingReportDates: [], periodRanges: [{ start: "2026-09-27", end: "2026-10-01" }] });
    expect(summarizeRevenueIncomeRange(data, ["2026-09", "2026-10"])).toMatchObject({ total: 130, hasOverlappingPeriods: false });
    expect(selectRevenueRows(data.rows.filter(row => row.period === "2026-09"), "estimate").rows).toHaveLength(1);
    expect(selectRevenueRows(data.rows.filter(row => row.period === "2026-10"), "estimate").rows).toHaveLength(1);
  });
  it("does not pretend a missing boundary report is a zero-revenue day", () => {
    const data = emptyData(); data.rows = [apple("2026-08-30", "2026-09-26", "2026-09", 70, "settled"), ...tail().filter(row => row.date !== "2026-09-29"), apple("2026-10-01", "2026-10-01", "2026-10", 20)];
    expect(summarizeRevenueIncome(data, "2026-10").perPlatform.apple).toMatchObject({ value: null, partialSum: 50, missingReportDates: ["2026-09-29"] });
    expect(summarizeRevenueIncomeRange(data, ["2026-09", "2026-10"])).toMatchObject({ total: null, partialSum: 120 });
  });
  it("replaces all of the open fiscal estimate when its final report arrives", () => {
    const data = emptyData(); data.rows = [apple("2026-08-30", "2026-09-26", "2026-09", 70, "settled"), ...tail(), apple("2026-10-01", "2026-10-01", "2026-10", 20), apple("2026-09-27", "2026-10-31", "2026-10", 58, "settled")];
    expect(summarizeRevenueIncomeRange(data, ["2026-09", "2026-10"])).toMatchObject({ total: 128, hasEstimates: false, hasOverlappingPeriods: false });
  });
  it("excludes sales already included in a fiscal period that ends inside the next calendar month", () => {
    const data = emptyData(); data.rows = [apple("2026-08-31", "2026-10-03", "2026-09", 70, "settled"), apple("2026-10-01", "2026-10-31", "2026-10", 100, "estimate", "apple-sales-month:2026-10"), apple("2026-10-03", "2026-10-03", "2026-10", 10), apple("2026-10-04", "2026-10-04", "2026-10", 20)];
    const income = summarizeRevenueIncome(data, "2026-10");
    expect(income.perPlatform.apple.partialSum).toBe(20);
    expect(income.perPlatform.apple.rows.map(row => row.date)).toEqual(["2026-10-04"]);
    expect(income.total).toBeNull(); // the rest of the monthly aggregate cannot be prorated
  });
  it("keeps the original FX month on boundary rows", () => {
    const data = emptyData(); data.rows = [apple("2026-08-30", "2026-09-26", "2026-09", 70, "settled"), ...tail().map(row => ({ ...row, proceeds: 1, proceedsCurrency: "USD" })), apple("2026-10-01", "2026-10-01", "2026-10", 20)];
    data.rates = { "2026-09:USD": { value: 1000, note: "manual" }, "2026-10:USD": { value: 2000, note: "manual" } };
    expect(summarizeRevenueIncome(data, "2026-10").total).toBe(4020);
  });
  it("does not turn a Google adjustment-only file into a full final monthly amount", () => {
    const data = emptyData(); data.rows = [{ ...apple("2026-09-01", "2026-09-01", "2026-09", -5, "settled"), platform: "google", source: "google-earnings", reportKey: "google:earnings/earnings_202609_adjustment.zip:earnings_202609.csv" }];
    expect(summarizeRevenueIncome(data, "2026-09")).toMatchObject({ total: null, partialSum: -5 });
  });
});
