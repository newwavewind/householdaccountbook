import { platformName } from "./model";
import { summarizePeriodCoverage } from "./completeness";
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
  const coverage = summarizePeriodCoverage(data, month);
  const hasAllReports = coverage.expectedPlatforms.length > 0 && coverage.missingSettledPlatforms.length === 0;
  const missingStores = coverage.missingSettledPlatforms.map((platform) => platformName[platform]);
  const manual = data.checklist;

  return [
    {
      id: "sync",
      label: "선택한 달의 확정 보고서 반영",
      done: hasAllReports,
      auto: true,
      hint: missingStores.length ? `${missingStores.join(" · ")} 확정 보고서 없음` :
        lastLog ? new Date(lastLog.at).toLocaleString("ko-KR") : undefined,
    },
    ...coverage.expectedPlatforms.map((platform) => ({
      id: `${platform}-sales`,
      label: platform === "apple" ? "Apple 확정 재무 확인" : "Google Play 확정 수익 확인",
      done: coverage.perPlatform[platform].hasSettled,
      auto: true,
    })),
    {
      id: "fx",
      label: "확정 수익의 원화 환산 확인",
      done: coverage.completeSettled,
      auto: true,
    },
    ...(coverage.expectedPlatforms.includes("google") ? [{
      id: "google-gcs",
      label: "Google 보고서 연결 설정",
      done: Boolean(connection?.google.reports && !connection?.google.missing?.length),
      auto: true,
    }] : []),
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
