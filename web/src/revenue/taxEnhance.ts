import { csvString, taxWorksheet } from "./model";
import type { RevenueData, RevenueRow, TaxClass } from "./types";

export function suggestTaxClass(row: RevenueRow): TaxClass {
  if (row.taxClass !== "unreviewed") return row.taxClass;
  if (row.country === "KR" || row.currency === "KRW") return "taxable";
  if (row.basis === "estimate") return "unreviewed";
  return "zero";
}

export function applyTaxSuggestions(rows: RevenueRow[]): RevenueRow[] {
  return rows.map((r) => {
    if (r.taxClass !== "unreviewed") return r;
    const next = suggestTaxClass(r);
    if (next === "unreviewed") return r;
    const base = r.proceeds ?? r.gross;
    const supply = r.supplyAmount ?? Math.round(base / 1.1);
    const vat = r.outputVat ?? (next === "taxable" ? Math.round(supply * 0.1) : 0);
    return {
      ...r,
      taxClass: next,
      supplyAmount: supply,
      outputVat: vat,
      taxDate: r.taxDate || r.date,
      evidence: r.evidence || "스토어 보고서(자동 제안)",
    };
  });
}

export function exportTaxPackCsv(data: RevenueData, year: string, half: "1" | "2") {
  const tax = taxWorksheet(data, year, half);
  const summary = csvString([
    ["부가세 검토용 요약", `${year}년 ${half}기`],
    ["과세 공급가액", tax.taxable],
    ["매출세액", tax.output],
    ["매입세액", tax.input],
    ["미검토", tax.pending.length],
  ]);
  const lines = csvString([
    ["날짜", "귀속월", "앱", "스토어", "분류", "공급가액", "매출세액", "증빙"],
    ...tax.rows.map((r) => [
      r.taxDate || r.date,
      r.period,
      r.appName,
      r.platform,
      r.taxClass,
      r.supplyAmount ?? "",
      r.outputVat ?? "",
      r.evidence ?? "",
    ]),
  ]);
  return { summary, lines, filename: `부가세_검토_${year}_${half}기` };
}
