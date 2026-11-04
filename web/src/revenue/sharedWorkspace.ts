import { getSupabase } from "../lib/supabaseClient";
import { pullRevenueSnapshot } from "./cloudStore";
import { emptyData } from "./model";
import type { RevenueData } from "./types";

export type SharedRevenueWorkspace = {
  ownerId: string;
  canRefresh: boolean;
  data: RevenueData;
  updatedAt: string | null;
};

/** Both the grant and the snapshot are checked by RLS on every refresh. */
export async function readSharedRevenueWorkspace(viewerId: string): Promise<SharedRevenueWorkspace | null> {
  const sb = getSupabase();
  if (!sb || viewerId === "device") return null;
  const { data: grant, error } = await sb.from("app_revenue_viewers")
    .select("owner_id,can_refresh").eq("viewer_id", viewerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!grant) return null;
  const snapshot = await pullRevenueSnapshot(grant.owner_id);
  if (snapshot.error) throw new Error(snapshot.error);
  return { ownerId: grant.owner_id, canRefresh: grant.can_refresh === true, data: snapshot.data ?? emptyData(), updatedAt: snapshot.updatedAt };
}

export async function publishSharedRefresh(jobId: string): Promise<{ message?: string; errors?: string[] }> {
  const sb = getSupabase();
  if (!sb) throw new Error("로그인 상태를 확인해 주세요.");
  const { data, error } = await sb.functions.invoke("app-revenue-refresh", { body: { jobId } });
  if (error || !data?.ok) throw new Error(data?.error || error?.message || "공유 자료 저장에 실패했습니다. 다시 시도해 주세요.");
  return data;
}
