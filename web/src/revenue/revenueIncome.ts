import { summarizePeriodCoverage } from "./completeness";
import { summarize } from "./model";
import { reportSource } from "./reportSelection";
import type { Platform, RevenueData, RevenueRow } from "./types";

type IncomePeriodKind = "calendar" | "fiscal" | "mixed" | "unknown";
export interface IncomePeriodRange { start: string; end: string }
export interface StoreRevenueIncome {
  basis: "settled" | "estimate" | "missing";
  value: number | null;
  /** Known rows only; never presented as the full store total when value is null. */
  partialSum: number;
  missingFx: number;
  unknownProceeds: number;
  rows: RevenueRow[];
  periodKind: IncomePeriodKind;
  periodRanges: IncomePeriodRange[];
}
export interface RevenueIncome {
  month: string;
  expectedPlatforms: Platform[];
  perPlatform: Record<Platform, StoreRevenueIncome>;
  total: number | null;
  partialSum: number;
  unknownPlatforms: Platform[];
  hasEstimates: boolean;
  mixedPeriods: boolean;
  hasFiscalPeriods: boolean;
}

const PLATFORMS: Platform[] = ["apple", "google"];
function rowPeriodKind(row: RevenueRow): Exclude<IncomePeriodKind, "mixed"> {
  if (row.periodKind) return row.periodKind;
  const source = reportSource(row);
  if (source === "apple-finance") return "fiscal";
  if (["apple-sales", "google-sales", "google-earnings"].includes(source)) return "calendar";
  return "unknown";
}
function calendarRange(month: string): IncomePeriodRange {
  const [year, monthNumber] = month.split("-").map(Number);
  return { start: `${month}-01`, end: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10) };
}
function periodMetadata(rows: RevenueRow[], month: string) {
  const kinds = new Set(rows.map(rowPeriodKind));
  const periodKind: IncomePeriodKind = kinds.size > 1 ? "mixed" : [...kinds][0] || "unknown";
  const ranges = new Map<string, IncomePeriodRange>();
  for (const row of rows) {
    // Calendar reports are attributed by report month, not an order's original
    // transaction date. Apple financial reports carry an explicit fiscal range.
    const range = rowPeriodKind(row) === "calendar" ? calendarRange(month) :
      { start: row.date, end: row.endDate || row.date };
    ranges.set(`${range.start}:${range.end}`, range);
  }
  return { periodKind, periodRanges: [...ranges.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)) };
}

/**
 * Report-based income including estimates. Prefer final rows per store/month;
 * otherwise use proceeds actually present in the sales report. This is NEVER a
 * final-income total. Google sales may be enriched with explicitly attributed
 * Orders API proceeds. No assumed service fee or tax manufactures missing net.
 */
export function summarizeRevenueIncome(
  data: RevenueData,
  month: string,
  rows: RevenueRow[] = data.rows,
  expectedPlatforms?: Platform[],
): RevenueIncome {
  const coverage = summarizePeriodCoverage(data, month, rows, expectedPlatforms);
  const perPlatform = Object.fromEntries(PLATFORMS.map((platform) => {
    const finalRows = coverage.settledRows.filter((row) => row.platform === platform);
    const estimateRows = coverage.salesRows.filter((row) => row.platform === platform);
    // A present final report with an unavailable FX rate remains incomplete:
    // silently falling back to a different estimate would conceal that issue.
    const selected = finalRows.length ? finalRows : estimateRows;
    const basis: StoreRevenueIncome["basis"] = finalRows.length ? "settled" : estimateRows.length ? "estimate" : "missing";
    const totals = summarize(selected, data);
    const value = selected.length && totals.completeProceeds ? totals.proceeds : null;
    const result: StoreRevenueIncome = {
      basis, value, partialSum: totals.proceeds,
      missingFx: totals.missingProceedsFx,
      unknownProceeds: totals.unknownProceeds,
      rows: selected,
      ...periodMetadata(selected, month),
    };
    return [platform, result];
  })) as Record<Platform, StoreRevenueIncome>;
  const required = coverage.expectedPlatforms;
  const unknownPlatforms = required.filter((platform) => perPlatform[platform].value === null);
  const partialSum = required.reduce((sum, platform) => sum + perPlatform[platform].partialSum, 0);
  const kinds = new Set(required.filter((platform) => perPlatform[platform].rows.length).map((platform) => perPlatform[platform].periodKind));
  return {
    month,
    expectedPlatforms: required,
    perPlatform,
    total: required.length && !unknownPlatforms.length ? partialSum : null,
    partialSum,
    unknownPlatforms,
    hasEstimates: required.some((platform) => perPlatform[platform].basis === "estimate"),
    mixedPeriods: kinds.size > 1 || kinds.has("mixed"),
    hasFiscalPeriods: required.some((platform) => perPlatform[platform].rows.some((row) => rowPeriodKind(row) === "fiscal")),
  };
}

export interface IncomePeriodOverlap {
  platform: Platform;
  firstMonth: string;
  secondMonth: string;
  start: string;
  end: string;
}

/**
 * Never sum calendar and fiscal rows across overlapping periods for one store.
 * Monthly results remain available for inspection when a cumulative total is
 * blocked. Unknown proceeds in any required month also prevent a full total.
 */
export function summarizeRevenueIncomeRange(
  data: RevenueData,
  months: string[],
  rows: RevenueRow[] = data.rows,
  expectedPlatforms?: Platform[],
) {
  const monthKeys = [...new Set(months)].sort();
  const periods = monthKeys.map((month) => summarizeRevenueIncome(data, month, rows, expectedPlatforms));
  const overlaps = new Map<string, IncomePeriodOverlap>();
  for (let left = 0; left < periods.length; left++) {
    for (let right = left + 1; right < periods.length; right++) {
      for (const platform of PLATFORMS) {
        for (const a of periods[left].perPlatform[platform].periodRanges) {
          for (const b of periods[right].perPlatform[platform].periodRanges) {
            const start = a.start > b.start ? a.start : b.start;
            const end = a.end < b.end ? a.end : b.end;
            if (start > end) continue;
            const overlap = { platform, firstMonth: periods[left].month, secondMonth: periods[right].month, start, end };
            overlaps.set(`${platform}:${overlap.firstMonth}:${overlap.secondMonth}:${start}:${end}`, overlap);
          }
        }
      }
    }
  }
  const overlappingPeriods = [...overlaps.values()];
  const hasOverlappingPeriods = overlappingPeriods.length > 0;
  const incompleteMonths = periods.filter((period) => period.total === null).map((period) => period.month);
  const knownSum = periods.reduce((sum, period) => sum + period.partialSum, 0);
  return {
    months: periods,
    monthKeys,
    total: periods.length && !incompleteMonths.length && !hasOverlappingPeriods ? knownSum : null,
    partialSum: hasOverlappingPeriods ? null : knownSum,
    hasEstimates: periods.some((period) => period.hasEstimates),
    incompleteMonths,
    hasOverlappingPeriods,
    overlappingPeriods,
    mixedPeriods: periods.some((period) => period.mixedPeriods) ||
      new Set(periods.flatMap((period) => period.expectedPlatforms.filter((platform) => period.perPlatform[platform].rows.length).map((platform) => period.perPlatform[platform].periodKind))).size > 1,
  };
}
