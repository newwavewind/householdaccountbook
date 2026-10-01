import { summarize, shiftMonth } from "./model";
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
  const google = rows.filter((r) => r.platform === "google");

  if (!rows.length) {
    add({
      id: "no-rows-month",
      severity: "warn",
      title: "이번 달 보고서 없음",
      body: `${month} 데이터가 없습니다. 동기화 또는 파일 가져오기를 실행해 주세요.`,
    });
  }

  if (rows.length && !google.length && connection?.google.configured) {
    add({
      id: "google-empty-month",
      severity: "critical",
      title: "Google만 비어 있음",
      body: "Apple은 있는데 Google Play 매출이 없습니다. GCS·번들·Package ID를 확인해 주세요.",
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

  const prev = data.rows.filter((r) => r.period === shiftMonth(month, -1));
  const curSum = summarize(rows, data);
  const prevSum = summarize(prev, data);
  const curVal = curSum.proceeds || curSum.gross;
  const prevVal = prevSum.proceeds || prevSum.gross;
  if (prevVal > 0 && curVal < prevVal * 0.5) {
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

  if (curSum.missing > 0) {
    add({
      id: "fx-missing",
      severity: "warn",
      title: "환율 미입력",
      body: `${curSum.missing}건이 원화 환산되지 않았습니다.`,
    });
  }

  return out;
}
