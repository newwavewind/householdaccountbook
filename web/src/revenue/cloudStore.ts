import { getSupabase, isCloudSyncEnabled } from "../lib/supabaseClient";
import { emptyData } from "./model";
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

export function preferNewer(
  local: RevenueData,
  remote: RevenueData | null,
): RevenueData {
  if (!remote) return local;
  const localStamp = local.logs[0]?.at || "";
  const remoteStamp = remote.logs[0]?.at || "";
  if (!local.rows.length && remote.rows.length) return remote;
  if (remote.rows.length > local.rows.length * 1.05) return remote;
  if (
    remoteStamp &&
    localStamp &&
    remoteStamp > localStamp &&
    remote.rows.length >= local.rows.length
  )
    return remote;
  return local.rows.length ? local : remote || emptyData();
}
