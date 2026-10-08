import { getSupabase, isCloudSyncEnabled } from "../lib/supabaseClient";
import { validateBackup } from "./storage";
import type { RevenueData } from "./types";

const TABLE = "app_revenue_snapshots";

export async function pullRevenueSnapshot(
  userId: string,
): Promise<{ data: RevenueData | null; updatedAt: string | null; error?: string }> {
  if (!isCloudSyncEnabled() || !userId || userId === "device") {
    return { data: null, updatedAt: null };
  }
  const sb = getSupabase();
  if (!sb) return { data: null, updatedAt: null, error: "Supabase 없음" };
  const { data, error } = await sb
    .from(TABLE)
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { data: null, updatedAt: null, error: error.message };
  if (!data?.payload) return { data: null, updatedAt: null };
  try {
    return {
      data: validateBackup(data.payload),
      updatedAt: data.updated_at || null,
    };
  } catch (e) {
    return {
      data: null,
      updatedAt: null,
      error: e instanceof Error ? e.message : "클라우드 자료 형식 오류",
    };
  }
}

export async function pushRevenueSnapshot(
  userId: string,
  payload: RevenueData,
): Promise<{ ok: boolean; error?: string }> {
  if (!isCloudSyncEnabled() || !userId || userId === "device") {
    return { ok: false, error: "로그인 후 클라우드 저장이 가능합니다." };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase 없음" };
  try {
    validateBackup(payload);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "저장 형식 오류",
    };
  }
  const { error } = await sb.from(TABLE).upsert({
    user_id: userId,
    payload,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function snapshotTimestamp(data: RevenueData): number | null {
  const value = data.meta?.updatedAt;
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isPristine(data: RevenueData): boolean {
  return !data.rows.length && !data.apps.length && !data.expenses.length &&
    !data.payouts.length && !data.imports.length && !data.logs.length &&
    !Object.keys(data.rates).length && !data.goal && !data.business.name &&
    !data.business.number && data.business.kind === "general" &&
    !Object.keys(data.business.prepaid).length && !Object.keys(data.checklist).length &&
    !data.appGroups?.length && !Object.keys(data.meta ?? {}).length;
}

export function preferNewer(
  local: RevenueData,
  remote: RevenueData | null,
): RevenueData {
  if (!remote) return local;
  if (isPristine(local)) return remote;
  const localStamp = snapshotTimestamp(local);
  const remoteStamp = snapshotTimestamp(remote);
  // Row counts and sync logs cannot prove freshness: deletion, tax edits,
  // expenses and payout edits can all change a snapshot without adding rows.
  if (localStamp !== null && remoteStamp !== null && remoteStamp > localStamp)
    return remote;
  return local;
}
