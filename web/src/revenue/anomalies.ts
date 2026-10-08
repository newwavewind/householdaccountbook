import { summarize, shiftMonth, platformName } from "./model";
import { summarizePeriodCoverage } from "./completeness";
import type { ConnectorStatus, RevenueData } from "./types";

export type Anomaly = {
  id: string;
  severity: "info" | "warn" | "critical";
  title: string;
  body: string;
};

export function detectAnomalies(
  data: RevenueData,
  month: string,
  connection: ConnectorStatus | null,
  dismissed: string[] = [],
): Anomaly[] {
  const out: Anomaly[] = [];
  const add = (a: Anomaly) => {
    if (!dismissed.includes(a.id)) out.push(a);
  };

  const matchMonth = (r: { period: string }) => r.period === month;
  const rows = data.rows.filter(matchMonth);
  const coverage = summarizePeriodCoverage(data, month);

  if (!rows.length) {
    add({
      id: "no-rows-month",
      severity: "warn",
      title: "이번 달 보고서 없음",
      body: `${month} 데이터가 없습니다. 동기화 또는 파일 가져오기를 실행해 주세요.`,
    });
  }

  for (const platform of coverage.missingSettledPlatforms) {
    add({
      id: `settled-missing:${month}:${platform}`,
      severity: "warn",
      title: `${platformName[platform]} 확정 보고서 없음`,
      body: `${month} ${platformName[platform]} 확정 보고서가 미수집 또는 미발행 상태입니다. 이 달 전체 수익은 아직 확인되지 않았습니다.`,
    });
  }

  if (connection?.google.missing?.some((m) => /GCS|ACL|403|버킷/.test(m))) {
    add({
      id: "google-gcs",
      severity: "warn",
      title: "Google GCS 미연결",
      body: "Play Console 버킷 ACL 또는 PC Chrome 번들 갱신이 필요합니다.",
    });
  }

  // Compare the same sales basis and only stores present in both months.
  // Closed fiscal reports and calendar estimates must never be added together.
  const salesRows = rows.filter((r) => r.basis === "estimate");
  const prev = data.rows.filter((r) => r.period === shiftMonth(month, -1) && r.basis === "estimate");
  const comparableStores = ["apple", "google"].filter((platform) =>
    salesRows.some((r) => r.platform === platform) && prev.some((r) => r.platform === platform),
  );
  const curSum = summarize(salesRows, data);
  const curComparison = summarize(salesRows.filter((r) => comparableStores.includes(r.platform)), data);
  const prevSum = summarize(prev.filter((r) => comparableStores.includes(r.platform)), data);
  const curVal = curComparison.gross - curComparison.refunds;
  const prevVal = prevSum.gross - prevSum.refunds;
  if (comparableStores.length && !curComparison.missingGrossFx && !prevSum.missingGrossFx && prevVal > 0 && curVal < prevVal * 0.5) {
    add({
      id: "revenue-drop-50",
      severity: "warn",
      title: "전월 대비 매출 급감",
      body: `전월 대비 50% 이상 줄었습니다.`,
    });
  }

  if (curSum.refunds > 0 && curSum.gross > 0 && curSum.refunds / curSum.gross > 0.15) {
    add({
      id: "refund-spike",
      severity: "info",
      title: "환불 비중 높음",
      body: `매출의 ${((curSum.refunds / curSum.gross) * 100).toFixed(0)}%가 환불입니다.`,
    });
  }

  const missing = summarize(rows.filter((r) => r.basis === "settled"), data).missing + curSum.missing;
  if (missing > 0) {
    add({
      id: "fx-missing",
      severity: "warn",
      title: "환율 미입력",
      body: `${missing}건의 매출 또는 수익 환율을 확인해 주세요.`,
    });
  }

  return out;
}
