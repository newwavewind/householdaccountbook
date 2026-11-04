import type { AppProduct, RevenueData } from "./types";

// These two configured identifiers were verified against the owner's Play app list.
const correctedPackages: Record<string, string> = {
  "com.sanghyun.haengjung": "com.sanghyun.haengjeongsa",
  "com.sanghyun.tax": "com.sanghyun.semusa",
};

export function reconcileCorrectedApps(data: RevenueData, incoming: AppProduct[]): RevenueData {
  const apps = new Map(data.apps.map(app => [app.id, app]));
  const retired = new Map<string, string>();
  for (const old of data.apps) {
    const replacement = incoming.find(app => app.platform === "google" && app.source === "api" && app.bundleId === correctedPackages[old.bundleId]);
    if (old.platform !== "google" || old.source !== "api" || !replacement || data.rows.some(row => row.appId === old.id)) continue;
    const existing = apps.get(replacement.id);
    apps.set(replacement.id, { ...replacement, favorite: existing?.favorite ?? old.favorite });
    apps.delete(old.id);
    retired.set(old.bundleId, replacement.bundleId);
  }
  if (!retired.size) return data;
  return { ...data, apps: [...apps.values()], appGroups: data.appGroups?.map(group => ({ ...group,
    googlePackages: [...new Set(group.googlePackages.map(pkg => retired.get(pkg) ?? pkg))],
  })) };
}
