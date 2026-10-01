import { estimateGoogleDeveloperShare, isGoogleEstimatedShare, needsGoogleEstimatedShare } from "./googleFee";
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
export function amounts(row: RevenueRow, data: RevenueData) {
  const rate = rateFor(data, row.currency, row.period);
  const proceedsRate = rateFor(data, row.proceedsCurrency, row.period);
  if (!rate || !proceedsRate) return null;
  let feeRaw = row.fee;
  let taxRaw = row.tax;
  let proceedsRaw = row.proceeds;
  // Google 예상 매출: 수익 미기입 또는 요율 변경 시 수수료 추정
  if (needsGoogleEstimatedShare(row) || isGoogleEstimatedShare(row)) {
    const share = estimateGoogleDeveloperShare({
      gross: row.gross,
      refunds: row.refunds,
      tax: row.tax,
      country: row.country,
      currency: row.currency,
    });
    feeRaw = share.fee;
    taxRaw = share.tax;
    proceedsRaw = share.proceeds;
  }
  const gross = row.gross * rate,
    refunds = row.refunds * rate;
  const fee = (feeRaw ?? 0) * rate,
    tax = (taxRaw ?? 0) * rate;
  const proceeds = (proceedsRaw ?? 0) * proceedsRate;
  return {
    gross,
    refunds,
    fee,
    tax,
    proceeds,
    unallocated:
      proceedsRaw === null ? 0 : gross - refunds - fee - tax - proceeds,
  };
}
export function summarize(rows: RevenueRow[], data: RevenueData) {
  const result = {
    gross: 0,
    refunds: 0,
    fee: 0,
    tax: 0,
    proceeds: 0,
    unallocated: 0,
    units: 0,
    missing: 0,
    unseparated: 0,
    unknownProceeds: 0,
  };
  for (const row of rows) {
    const value = amounts(row, data);
    if (!value) {
      result.missing++;
      continue;
    }
    for (const key of [
      "gross",
      "refunds",
      "fee",
      "tax",
      "proceeds",
      "unallocated",
    ] as const)
      result[key] += value[key];
    result.units += row.units;
    const estimated = isGoogleEstimatedShare(row);
    if (!estimated && (row.fee === null || row.tax === null)) result.unseparated++;
    if (row.proceeds === null && !estimated) result.unknownProceeds++;
  }
  return result;
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
      amounts(r, data)?.proceeds ?? "환율 미입력",
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
  for (const r of rows) {
    if (r.gross > 0 && r.refunds === 0) {
      soldTx += 1;
      sold += r.units > 0 ? r.units : 1;
    } else if (r.refunds > 0) {
      refundTx += 1;
      refunded += r.units < 0 ? -r.units : r.units > 0 ? r.units : 1;
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
  // Apple은 fee가 null이라 미분리(unallocated)에 수수료가 들어감.
  // 화면 공제액은 항상 총매출−환불−개발자수익 잔차로 맞춰 식이 성립하게 한다.
  const residual = Math.max(0, Math.round(totals.gross - totals.refunds - totals.proceeds));
  const total =
    totals.unknownProceeds > 0 && totals.proceeds === 0 ? explicit : residual || explicit;
  return {
    fee: totals.fee,
    tax: totals.tax,
    unallocated: totals.unallocated,
    total,
    explicit,
  };
}

export function appProfit(
  rows: RevenueRow[],
  data: RevenueData,
  expenses: number,
) {
  const totals = summarize(rows, data);
  const displayProceeds =
    totals.unknownProceeds && !rows.some((r) => r.proceeds !== null)
      ? totals.gross
      : totals.proceeds;
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
  const curVal =
    cur.unknownProceeds && !thisRows.some((r) => r.proceeds !== null)
      ? cur.gross
      : cur.proceeds;
  const prevVal =
    prev.unknownProceeds && !prevRows.some((r) => r.proceeds !== null)
      ? prev.gross
      : prev.proceeds;
  if (!prevRows.length || prevVal === 0) {
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
    if (r.currency !== "KRW") set.add(r.currency);
    if (r.proceedsCurrency !== "KRW") set.add(r.proceedsCurrency);
  }
  return [...set].sort();
}
