import type { AppGroup, AppProduct, RevenueData, RevenueRow } from "./types";

export function normalizeAppGroups(data: RevenueData): RevenueData {
  if (data.appGroups?.length && data.meta) return data;
  return {
    ...data,
    appGroups: data.appGroups ?? [],
    meta: data.meta ?? {},
  };
}

export function suggestAppGroups(apps: AppProduct[]): AppGroup[] {
  const byKey = new Map<string, AppGroup>();
  for (const app of apps) {
    const key = app.name
      .replace(/^봄기출\s*/i, "")
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .trim()
      .slice(0, 40);
    if (!key) continue;
    const id = `group:${key.replace(/\s+/g, "-").toLowerCase()}`;
    let g = byKey.get(id);
    if (!g) {
      g = { id, name: key, appleAppIds: [], googlePackages: [] };
      byKey.set(id, g);
    }
    if (app.platform === "apple") {
      if (!g.appleAppIds.includes(app.id)) g.appleAppIds.push(app.id);
    } else {
      const pkg = app.bundleId || app.id.replace(/^google:/, "");
      if (pkg && !g.googlePackages.includes(pkg)) g.googlePackages.push(pkg);
    }
  }
  return [...byKey.values()].filter(
    (g) => g.appleAppIds.length + g.googlePackages.length > 1 || g.name.length > 2,
  );
}

export function appIdsInGroup(data: RevenueData, groupId: string): Set<string> {
  const g = data.appGroups?.find((x) => x.id === groupId);
  if (!g) return new Set();
  const ids = new Set<string>();
  for (const id of g.appleAppIds) ids.add(id);
  for (const pkg of g.googlePackages) ids.add(`google:${pkg}`);
  return ids;
}

export function rowMatchesGroup(data: RevenueData, row: RevenueRow, groupId: string) {
  if (groupId === "all") return true;
  return appIdsInGroup(data, groupId).has(row.appId);
}
