import type { StoreDocument, SyncResult } from "./types";

const AUTO_PREFIX = "revenue-auto-sync-day:";

export type ConnectorHealth = "online" | "offline" | "checking";

export function autoSyncStorageKey(owner: string) {
  return `${AUTO_PREFIX}${owner || "device"}`;
}

export function shouldAutoSync(owner: string, today: string): boolean {
  try {
    return localStorage.getItem(autoSyncStorageKey(owner)) !== today;
  } catch {
    return false;
  }
}

export function markAutoSynced(owner: string, today: string) {
  try {
    localStorage.setItem(autoSyncStorageKey(owner), today);
  } catch {
    /* private mode */
  }
}

export function countDocsByStore(documents: StoreDocument[]) {
  let apple = 0;
  let google = 0;
  for (const doc of documents) {
    if (doc.key.startsWith("apple")) apple += 1;
    else if (doc.key.startsWith("google")) google += 1;
  }
  return { apple, google };
}

/** Short toast — never dump raw provider error walls. */
export function formatSyncToast(input: {
  apps: number;
  documents: StoreDocument[];
  errors: string[];
  completed?: string[];
  auto?: boolean;
}): string {
  const { apple, google } = countDocsByStore(input.documents);
  const parts: string[] = [];
  if (apple) parts.push(`Apple ${apple}`);
  if (google) parts.push(`Google ${google}`);
  if (!parts.length && input.apps) parts.push(`앱 ${input.apps}`);
  if (!parts.length) parts.push("수집된 보고서 없음");
  const fail = input.errors.length;
  const prefix = input.auto ? "자동 · " : "";
  if (fail) return `${prefix}${parts.join(" · ")} · 확인 ${fail}`;
  if (!input.documents.length) return `${prefix}${parts.join(" · ")} · 수익 확인 필요`;
  return `${prefix}${parts.join(" · ")} · 완료`;
}

export function connectorDownMessage(statusCode?: number) {
  if (statusCode === 502 || statusCode === 504)
    return "로컬 수익 커넥터가 응답하지 않습니다. 터미널에서 npm run revenue:connector 를 실행해 주세요.";
  return "연결 서버가 실행되지 않았습니다. npm run revenue:connector 로 시작한 뒤 다시 시도해 주세요.";
}

export function syncLogStatus(
  docs: number,
  apps: number,
  errors: number,
): "success" | "partial" | "error" {
  if (!errors && docs) return "success";
  if (docs || apps || !errors) return "partial";
  return "error";
}

export function summarizeJobForLog(result: SyncResult, parsedCount: number) {
  const { apple, google } = countDocsByStore(result.documents);
  return {
    apple,
    google,
    apps: result.apps.length,
    parsed: parsedCount,
    errors: result.errors.length,
  };
}
