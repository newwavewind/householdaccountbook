import type { ConnectorStatus, RevenueData, SyncLog } from "./types";

export type MonthCloseItem = {
  id: string;
  label: string;
  done: boolean;
  auto: boolean;
  hint?: string;
};

export function buildMonthCloseChecklist(
  data: RevenueData,
  month: string,
  connection: ConnectorStatus | null,
  lastLog: SyncLog | undefined,
): MonthCloseItem[] {
  const rows = data.rows.filter((r) => r.period === month);
  const hasApple = rows.some((r) => r.platform === "apple");
  const hasGoogle = rows.some((r) => r.platform === "google");
  const fxOk = rows.every((r) => {
    if (r.currency === "KRW" && r.proceedsCurrency === "KRW") return true;
    return (
      (r.currency === "KRW" || data.rates[`${month}:${r.currency}`]) &&
      (r.proceedsCurrency === "KRW" || data.rates[`${month}:${r.proceedsCurrency}`])
    );
  });
  const syncedRecently =
    lastLog &&
    Date.now() - Date.parse(lastLog.at) < 7 * 86400000 &&
    (lastLog.status === "success" || lastLog.status === "partial");
  const manual = data.checklist;

  return [
    {
      id: "sync",
      label: "스토어 동기화(또는 파일) 완료",
      done: Boolean(syncedRecently || rows.length),
      auto: true,
      hint: lastLog ? new Date(lastLog.at).toLocaleString("ko-KR") : undefined,
    },
    { id: "apple-sales", label: "Apple 매출 반영", done: hasApple, auto: true },
    { id: "google-sales", label: "Google Play 매출 반영", done: hasGoogle, auto: true },
    {
      id: "fx",
      label: "외화 환율 확정",
      done: fxOk || !rows.some((r) => r.currency !== "KRW"),
      auto: true,
    },
    {
      id: "google-gcs",
      label: "Google GCS 또는 PC 번들",
      done: Boolean(connection?.google.reports && !connection?.google.missing?.length),
      auto: true,
    },
    {
      id: "tax-review",
      label: "부가세 분류·증빙 검토",
      done: Boolean(manual[`${month}:tax-review`]),
      auto: false,
    },
    {
      id: "payout-check",
      label: "입금 예정·실입금 대조",
      done: Boolean(manual[`${month}:payout-check`]),
      auto: false,
    },
  ];
}

export function monthCloseProgress(items: MonthCloseItem[]) {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, pct: items.length ? (done / items.length) * 100 : 0 };
}
