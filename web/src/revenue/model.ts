import { hasUnverifiedGoogleProceeds, selectRevenueRows } from "./reportSelection";
import type { RevenueData, RevenueRow, TaxClass } from "./types";

export const platformName = { apple: "App Store", google: "Google Play" };
export const taxLabels: Record<TaxClass, string> = {
  unreviewed: "미분류",
  taxable: "과세 10%",
  zero: "영세율",
  exempt: "면세",
  excluded: "신고 제외",
};
export const money = (n: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(n);
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const currentMonth = () => localDate().slice(0, 7);
export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  return localDate(new Date(y, m - 1 + by, 1)).slice(0, 7);
};
export const monthLabel = (month: string) =>
  `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
export const emptyData = (): RevenueData => ({
  schema: 1,
  apps: [],
  rows: [],
  expenses: [],
  payouts: [],
  imports: [],
  logs: [],
  rates: {},
  goal: 0,
  business: { name: "", number: "", kind: "general", prepaid: {} },
  checklist: {},
  appGroups: [],
  meta: {},
});
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function rateFor(data: RevenueData, currency: string, month: string) {
  return currency === "KRW" ? 1 : data.rates[`${month}:${currency}`]?.value;
}
/** Preserve unknown provider values while identifying the native amounts used by accounting. */
function nativeAmounts(row: RevenueRow) {
  const unverified = hasUnverifiedGoogleProceeds(row);
  return {
    proceeds: unverified ? null : row.proceeds,
    fee: unverified ? null : row.fee,
    // Old Google tax guesses cannot be distinguished from source tax.
    tax: unverified && !row.source ? null : row.tax,
  };
}

/** Zero converts to zero without an exchange rate; unknown proceeds remain unknown. */
export function rowCurrenciesNeedingConversion(row: RevenueRow): string[] {
  const native = nativeAmounts(row);
  const currencies = new Set<string>();
  if (row.currency !== "KRW" &&
    [row.gross, row.refunds, native.fee, native.tax].some((value) => value !== null && value !== 0))
    currencies.add(row.currency);
  if (row.proceedsCurrency !== "KRW" && native.proceeds !== null && native.proceeds !== 0)
    currencies.add(row.proceedsCurrency);
  return [...currencies];
}

export function amounts(row: RevenueRow, data: RevenueData) {
  const rate = rateFor(data, row.currency, row.period);
  const proceedsRate = rateFor(data, row.proceedsCurrency, row.period);
  const native = nativeAmounts(row);
  const proceedsRaw = native.proceeds;
  const feeRaw = native.fee;
  const taxRaw = native.tax;
  const validRate = !!rate && Number.isFinite(rate) && rate > 0;
  const validProceedsRate = !!proceedsRate && Number.isFinite(proceedsRate) && proceedsRate > 0;
  const zeroSalesCurrency = [row.gross, row.refunds, feeRaw, taxRaw]
    .every((value) => value === null || value === 0);
  const grossAvailable = zeroSalesCurrency || validRate;
  const proceedsAvailable = proceedsRaw !== null && (proceedsRaw === 0 || validProceedsRate);
  if (!grossAvailable && !proceedsAvailable) return null;
  const salesFactor = validRate ? rate : 1;
  const proceedsFactor = validProceedsRate ? proceedsRate : 1;
  const gross = grossAvailable ? row.gross * salesFactor : 0;
  const refunds = grossAvailable ? row.refunds * salesFactor : 0;
  const fee = grossAvailable ? (feeRaw ?? 0) * salesFactor : 0;
  const tax = grossAvailable ? (taxRaw ?? 0) * salesFactor : 0;
  const proceeds = proceedsAvailable ? proceedsRaw! * proceedsFactor : 0;
  return {
    gross, refunds, fee, tax, proceeds,
    unallocated: grossAvailable && proceedsAvailable
      ? gross - refunds - fee - tax - proceeds : 0,
    grossAvailable,
    proceedsAvailable,
    missingGrossFx: !grossAvailable,
    missingProceedsFx: proceedsRaw !== null && !proceedsAvailable,
    unknownProceeds: proceedsRaw === null,
  };
}
export function summarize(rows: RevenueRow[], data: RevenueData) {
  const selection = selectRevenueRows(rows);
  const result = {
    gross: 0, refunds: 0, fee: 0, tax: 0, proceeds: 0, unallocated: 0,
    units: 0, missing: 0, unseparated: 0, unknownProceeds: 0,
    missingGrossFx: 0, missingProceedsFx: 0,
    estimatedRows: 0, settledRows: 0,
    excludedOverlapRows: selection.excludedOverlapRows,
    completeProceeds: true,
  };
  for (const row of selection.rows) {
    result.units += row.units;
    if (row.basis === "settled") result.settledRows++;
    else result.estimatedRows++;
    const unverified = hasUnverifiedGoogleProceeds(row);
    const unknown = row.proceeds === null || unverified;
    if (unknown) result.unknownProceeds++;
    if (row.fee === null || row.tax === null || unverified) result.unseparated++;
    const value = amounts(row, data);
    if (!value) {
      result.missing++;
      result.missingGrossFx++;
      if (!unknown) result.missingProceedsFx++;
      continue;
    }
    if (value.missingGrossFx) result.missingGrossFx++;
    if (value.missingProceedsFx) result.missingProceedsFx++;
    if (value.missingGrossFx || value.missingProceedsFx) result.missing++;
    for (const key of ["gross", "refunds", "fee", "tax", "proceeds", "unallocated"] as const)
      result[key] += value[key];
  }
  result.completeProceeds = result.unknownProceeds === 0 && result.missingProceedsFx === 0;
  return result;
}

/** The UI can explain exactly why a total is partial without showing zero income. */
export function revenueQuality(rows: RevenueRow[], data: RevenueData) {
  const totals = summarize(rows, data);
  return {
    missingGrossFx: totals.missingGrossFx,
    missingProceedsFx: totals.missingProceedsFx,
    unknownProceeds: totals.unknownProceeds,
    estimatedRows: totals.estimatedRows,
    settledRows: totals.settledRows,
    excludedOverlapRows: totals.excludedOverlapRows,
    completeProceeds: totals.completeProceeds,
  };
}
export function taxWorksheet(data: RevenueData, year: string, half: "1" | "2") {
  const start = `${year}-${half === "1" ? "01" : "07"}`,
    end = `${year}-${half === "1" ? "06" : "12"}`;
  // Only closed reports are eligible; estimates never silently become tax evidence.
  const rows = data.rows.filter(
    (r) =>
      r.basis === "settled" &&
      (r.taxDate || r.date).slice(0, 7) >= start &&
      (r.taxDate || r.date).slice(0, 7) <= end,
  );
  const expenses = data.expenses.filter(
    (e) => e.date.slice(0, 7) >= start && e.date.slice(0, 7) <= end,
  );
  const pending = rows.filter(
    (r) =>
      r.taxClass === "unreviewed" ||
      (r.taxClass !== "excluded" &&
        (!r.taxDate ||
          !r.evidence?.trim() ||
          r.supplyAmount === undefined ||
          (r.taxClass === "taxable" && r.outputVat === undefined))),
  );
  const eligible = rows.filter((r) => !pending.includes(r));
  const total = (category: TaxClass) =>
    eligible
      .filter((r) => r.taxClass === category)
      .reduce((n, r) => n + (r.supplyAmount ?? 0), 0);
  const output = eligible
    .filter((r) => r.taxClass === "taxable")
    .reduce((n, r) => n + (r.outputVat ?? 0), 0);
  const input = expenses
    .filter((e) => e.deductible && e.evidence.trim())
    .reduce((n, e) => n + e.inputVat, 0);
  const missingEvidence = expenses.filter(
    (e) => e.deductible && !e.evidence.trim(),
  ).length;
  const prepaid = data.business.prepaid[`${year}-${half}`] || 0;
  return {
    start,
    end,
    rows,
    pending,
    expenses,
    taxable: total("taxable"),
    zero: total("zero"),
    exempt: total("exempt"),
    output,
    input,
    prepaid,
    payable: output - input - prepaid,
    missingEvidence,
  };
}

// Excel must treat descriptions as text, not formulas.
export function csvString(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value ?? "");
            if (typeof value === "string" && /^[\s]*[=+\-@]/.test(s))
              s = `'${s}`;
            return `"${s.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export function download(
  name: string,
  content: string,
  mime = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportRows(rows: RevenueRow[], data: RevenueData) {
  return csvString([
    [
      "날짜",
      "기간",
      "앱",
      "스토어",
      "기준",
      "국가",
      "판매통화",
      "매출",
      "환불",
      "수수료",
      "스토어 세금",
      "수익통화",
      "개발자 수익",
      "원화 수익",
      "세무분류",
      "공급가액(원)",
      "매출세액(원)",
      "증빙",
    ],
    ...rows.map((r) => [
      r.date,
      r.period,
      r.appName,
      platformName[r.platform],
      r.basis === "settled" ? "확정" : "추정",
      r.country,
      r.currency,
      r.gross,
      r.refunds,
      r.fee ?? "미분리",
      r.tax ?? "미분리",
      r.proceedsCurrency,
      r.proceeds,
      amounts(r, data)?.proceedsAvailable ? amounts(r, data)!.proceeds : "수익 또는 환율 미확인",
      taxLabels[r.taxClass],
      r.supplyAmount,
      r.outputVat,
      r.evidence,
    ]),
  ]);
}

/** 유료 판매만 집계. Apple Units의 무료 다운로드는 제외. */
export function countPaidSales(rows: RevenueRow[]) {
  let sold = 0;
  let refunded = 0;
  let soldTx = 0;
  let refundTx = 0;
  for (const r of selectRevenueRows(rows).rows) {
    if (r.gross > 0 && r.refunds === 0) {
      soldTx += 1;
      sold += Math.max(0, r.units);
    } else if (r.refunds > 0) {
      refundTx += 1;
      refunded += Math.abs(r.units);
    }
  }
  return {
    sold,
    refunded,
    net: sold - refunded,
    soldTx,
    refundTx,
  };
}

/** 총매출 − 환불 − 개발자수익 에 해당하는 스토어 공제(수수료·세금·미분리). */
export function storeTake(totals: ReturnType<typeof summarize>) {
  const explicit = totals.fee + totals.tax + totals.unallocated;
  return {
    fee: totals.fee,
    tax: totals.tax,
    unallocated: totals.unallocated,
    // Refund-only months legitimately have negative deductions. Never force
    // reconciliation by rounding or clamping the signed report components.
    total: explicit,
    explicit,
    complete: totals.completeProceeds && totals.missingGrossFx === 0,
  };
}

export function appProfit(
  rows: RevenueRow[],
  data: RevenueData,
  expenses: number,
) {
  const totals = summarize(rows, data);
  const displayProceeds = totals.proceeds;
  return {
    ...totals,
    displayProceeds,
    net: displayProceeds - expenses,
    expenseShare: expenses,
  };
}

export function yearOverYear(
  data: RevenueData,
  month: string,
  match: (row: RevenueRow) => boolean,
) {
  const thisRows = data.rows.filter((r) => r.period === month && match(r));
  const prevYear = `${Number(month.slice(0, 4)) - 1}-${month.slice(5)}`;
  const prevRows = data.rows.filter((r) => r.period === prevYear && match(r));
  const cur = summarize(thisRows, data);
  const prev = summarize(prevRows, data);
  const curVal = cur.proceeds;
  const prevVal = prev.proceeds;
  if (!cur.completeProceeds || !prev.completeProceeds || !prevRows.length || prevVal === 0) {
    return { prevYear, curVal, prevVal, growth: null as number | null, hasPrev: prevRows.length > 0 };
  }
  return {
    prevYear,
    curVal,
    prevVal,
    growth: ((curVal - prevVal) / Math.abs(prevVal)) * 100,
    hasPrev: true,
  };
}

export function neededCurrencies(rows: RevenueRow[], month: string) {
  const set = new Set<string>();
  for (const r of rows.filter((x) => x.period === month)) {
    for (const currency of rowCurrenciesNeedingConversion(r)) set.add(currency);
  }
  return [...set].sort();
}
