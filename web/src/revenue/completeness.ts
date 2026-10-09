import { summarize } from "./model";
import { reportScopeFromKey, reportSource, selectRevenueRows } from "./reportSelection";
import type { Platform, RevenueData, RevenueRow } from "./types";

const PLATFORMS: Platform[] = ["apple", "google"];
type Totals = ReturnType<typeof summarize>;

export interface PlatformPeriodCoverage {
  expected: boolean;
  hasSales: boolean;
  hasSettled: boolean;
  /** Supplemental Google earnings alone cannot establish the whole store total. */
  missingPrimarySettledReport: boolean;
  sales: Totals;
  settled: Totals;
  completeSales: boolean;
  completeSettled: boolean;
}

export interface PeriodCoverage {
  month: string;
  sales: Totals;
  settled: Totals;
  salesRows: RevenueRow[];
  settledRows: RevenueRow[];
  expectedPlatforms: Platform[];
  missingSalesPlatforms: Platform[];
  missingSettledPlatforms: Platform[];
  completeSales: boolean;
  completeSettled: boolean;
  perPlatform: Record<Platform, PlatformPeriodCoverage>;
}

/**
 * Pass the app/store-filtered rows BEFORE filtering by month, so an earlier
 * observed report establishes coverage in a later missing month. App catalog
 * entries alone never prove a store had revenue in a historical period.
 * Explicit expectations can add known stores with no report yet. Rows actually
 * present in the selected month are always included in the required coverage.
 */
export function summarizePeriodCoverage(
  data: RevenueData,
  month: string,
  rows: RevenueRow[] = data.rows,
  expectedPlatforms?: Platform[],
): PeriodCoverage {
  const period = rows.filter((row) => row.period === month);
  const inferred = PLATFORMS.filter((platform) => rows.some((row) =>
    row.platform === platform && row.period <= month,
  ));
  const expected = new Set<Platform>(expectedPlatforms ?? inferred);
  period.forEach((row) => expected.add(row.platform));
  const required = PLATFORMS.filter((platform) => expected.has(platform));
  const salesRows = selectRevenueRows(period, "estimate").rows;
  const settledRows = selectRevenueRows(period, "settled").rows;
  const sales = summarize(period.filter((row) => row.basis === "estimate"), data);
  const settled = summarize(period.filter((row) => row.basis === "settled"), data);
  const perPlatform = Object.fromEntries(PLATFORMS.map((platform) => {
    const storeSales = salesRows.filter((row) => row.platform === platform);
    const storeSettled = settledRows.filter((row) => row.platform === platform);
    const salesTotal = summarize(storeSales, data);
    const settledTotal = summarize(storeSettled, data);
    // Ordinary Google monthly archives also carry numeric, currency, or other
    // opaque suffixes. Only an explicit adjustment(s) token establishes a
    // supplemental file; an arbitrary suffix cannot prove the base is absent.
    const settledScopes = storeSettled.map((row) => row.reportScope || reportScopeFromKey(row.reportKey, reportSource(row)));
    const missingPrimarySettledReport = platform === "google" && settledScopes.length > 0 &&
      settledScopes.every((scope) => {
        const archive = /^google-earnings:(earnings_\d{6}[^:]*)\.zip:/i.exec(scope ?? "")?.[1];
        return archive !== undefined && /(?:^|[_-])adjustments?(?:[_-]|$)/i.test(archive);
      });
    const coverage: PlatformPeriodCoverage = {
      expected: expected.has(platform),
      hasSales: storeSales.length > 0,
      hasSettled: storeSettled.length > 0,
      missingPrimarySettledReport,
      sales: salesTotal,
      settled: settledTotal,
      completeSales: storeSales.length > 0 && salesTotal.missingGrossFx === 0,
      completeSettled: storeSettled.length > 0 && !missingPrimarySettledReport && settledTotal.completeProceeds,
    };
    return [platform, coverage];
  })) as Record<Platform, PlatformPeriodCoverage>;
  const missingSalesPlatforms = required.filter((platform) => !perPlatform[platform].hasSales);
  const missingSettledPlatforms = required.filter((platform) => !perPlatform[platform].hasSettled);
  return {
    month, sales, settled, salesRows, settledRows,
    expectedPlatforms: required,
    missingSalesPlatforms,
    missingSettledPlatforms,
    completeSales: required.length > 0 && required.every((platform) => perPlatform[platform].completeSales),
    completeSettled: required.length > 0 && required.every((platform) => perPlatform[platform].completeSettled),
    perPlatform,
  };
}

/** Each missing month/store pair prevents an apparently complete cumulative sum. */
export function summarizeRangeCoverage(
  data: RevenueData,
  months: string[],
  rows: RevenueRow[] = data.rows,
  expectedPlatforms?: Platform[],
) {
  const monthKeys = [...new Set(months)].sort();
  const periods = monthKeys.map((month) => summarizePeriodCoverage(data, month, rows, expectedPlatforms));
  const salesRows = periods.flatMap((period) => period.salesRows);
  const settledRows = periods.flatMap((period) => period.settledRows);
  const sales = summarize(salesRows, data);
  const settled = summarize(settledRows, data);
  const missingSalesPeriods = periods.flatMap((period) => period.missingSalesPlatforms.map((platform) => ({ month: period.month, platform })));
  const missingSettledPeriods = periods.flatMap((period) => period.missingSettledPlatforms.map((platform) => ({ month: period.month, platform })));
  return {
    months: periods,
    monthKeys,
    sales, settled, salesRows, settledRows,
    expectedPlatforms: PLATFORMS.filter((platform) => periods.some((period) => period.expectedPlatforms.includes(platform))),
    missingSalesPeriods,
    missingSettledPeriods,
    incompleteSalesMonths: periods.filter((period) => !period.completeSales).map((period) => period.month),
    incompleteSettledMonths: periods.filter((period) => !period.completeSettled).map((period) => period.month),
    completeSales: periods.length > 0 && periods.every((period) => period.completeSales),
    completeSettled: periods.length > 0 && periods.every((period) => period.completeSettled),
  };
}
