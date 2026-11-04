import { csvString, taxWorksheet } from "./model";
import type { RevenueData } from "./types";

export function exportTaxPackCsv(data: RevenueData, year: string, half: "1" | "2") {
  const tax = taxWorksheet(data, year, half);
  const summary = csvString([
    ["부가세 검토용 요약", `${year}년 ${half}기`],
    ["과세 공급가액", tax.taxable],
    ["매출세액", tax.output],
    ["매입세액", tax.input],
    ["미검토", tax.pending.length],
    ["집계 기준", "확정 보고서 중 귀속일·분류·금액·증빙을 입력한 자료만 포함. 자동 제안값과 미검토 자료 제외."],
  ]);
  const lines = csvString([
    ["날짜", "귀속월", "앱", "스토어", "분류", "공급가액", "매출세액", "증빙", "검토 상태"],
    ...tax.rows.map((r) => [
      r.taxDate || r.date,
      r.period,
      r.appName,
      r.platform,
      r.taxClass,
      r.supplyAmount ?? "",
      r.outputVat ?? "",
      r.evidence ?? "",
      tax.pending.includes(r) ? "검토 필요 · 합계 제외" : "입력 자료",
    ]),
  ]);
  return { summary, lines, filename: `부가세_검토_${year}_${half}기` };
}
