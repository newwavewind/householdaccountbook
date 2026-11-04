import type { SyncLog } from "./types";

export function latestCollectedLog(logs: SyncLog[]): SyncLog | undefined {
  return logs.find(log => log.status !== "error" && (log.detail?.documents ?? 0) > 0);
}

export function collectionIssues(errors: string[]) {
  const groups = new Map<string, { title: string; description: string; count: number }>();
  for (const error of errors) {
    const issue = /Google.*설치 통계.*앱 미확인/.test(error)
      ? { key: "install-reports", title: "Google 설치 보고서 일부 미제공", description: "Google에서 일부 앱의 설치 보고서를 찾지 못했어요. 다음 수집 때 다시 조회합니다. 설치 통계 상태이며, 판매·수익 보고서와는 별도입니다. 미제공 설치 수는 0건으로 처리하지 않습니다." }
      : /Google.*API가 비활성화/.test(error)
      ? { key: "disabled-api", title: "Google 앱 목록 API 사용 설정", description: "앱 목록을 자동으로 찾는 API가 꺼져 있어요. Google Cloud에서 Google Play Developer Reporting API를 사용 설정해 주세요." }
      : /Google.*403/.test(error)
      ? { key: "permission", title: "Google 앱 목록 연결 확인", description: "앱 목록을 자동으로 찾지 못했어요. 등록된 앱의 자료는 별도로 가져옵니다. Google Cloud의 Reporting API 사용 설정과 Play Console의 서비스 계정 권한을 확인해 주세요." }
      : /Google.*404/.test(error)
      ? { key: "app", title: "등록된 앱 정보 확인", description: "일부 앱을 찾지 못했어요. 패키지명과 해당 계정에서 조회할 수 있는 앱인지 확인해 주세요." }
      : /주문.*미반영/.test(error)
      ? { key: "orders", title: "일부 주문 수익은 확인 중", description: "기간·통화·상태가 확인되지 않은 주문은 예상 수익에서 제외했어요. 확정 보고서와 함께 확인해 주세요." }
      : /미제공|생성 지연|발행 대기/.test(error)
      ? { key: "pending", title: "아직 제공되지 않은 보고서", description: "스토어가 보고서를 제공하면 다시 가져올 수 있어요. 자료가 없는 날을 매출 0원으로 처리하지 않습니다." }
      : { key: error, title: "추가 확인이 필요한 자료", description: error };
    const previous = groups.get(issue.key);
    groups.set(issue.key, { title: issue.title, description: issue.description, count: (previous?.count ?? 0) + 1 });
  }
  return [...groups.values()];
}

/** Keep the last successful cloud snapshot intact when hydration failed. */
export function canPublishRevenue(input: { readOnly: boolean; demo: boolean; owner: string; cloudReady: boolean; blocked: boolean }) {
  return !input.readOnly && !input.demo && input.owner !== "device" && input.cloudReady && !input.blocked;
}

/** Serialize writes so a slower old edit cannot overwrite a newer edit. */
export function createRevenueSaveQueue<T, R>(write: (value: T) => Promise<R>) {
  let tail: Promise<unknown> = Promise.resolve();
  return (value: T): Promise<R> => {
    const result = tail.then(() => write(value));
    tail = result.catch(() => undefined);
    return result;
  };
}
