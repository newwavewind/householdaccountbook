import { mergeReports, parseReport } from "./imports";
import { parseInstallReport, mergeInstallReports } from "./downloads";
import { enrichRowsWithApps } from "./appMatch";
import { withResolvedAppNames, looksLikePackageName } from "./appDisplayNames";
import { reconcileCorrectedApps } from "./reconcileApps";
import { suggestAppGroups } from "./appGroups";
import { formatSyncToast, syncLogStatus } from "./syncHelpers";
import type { RevenueData, SyncResult, InstallReport, RevenueRow, StoreDocument } from "./types";

/** Merge only provider reports; tax reviews, expenses, payouts and settings remain owner-managed. */
export async function mergeSharedRefresh(base: RevenueData, result: SyncResult, now = new Date().toISOString()) {
  if (result.state !== "done") throw new Error("보고서 수집이 아직 완료되지 않았습니다.");
  const id = `shared-refresh:${result.id}`;
  if (base.logs.some(log => log.id === id)) return base;
  const errors = [...result.errors];
  const parsed: {document: StoreDocument; rows: RevenueRow[]}[] = [];
  const installs: InstallReport[] = [];
  for (const document of result.documents) {
    try {
      const stored = base.imports.find(item => item.key === document.key);
      if (stored && Date.parse(stored.fetchedAt || stored.importedAt) > Date.parse(document.fetchedAt || now)) continue;
      if (document.key.startsWith("google-installs:")) { installs.push(parseInstallReport(document)); continue; }
      parsed.push({ document, rows: enrichRowsWithApps(await parseReport(document), result.apps) });
    } catch (e) { errors.push(`${document.name}: ${e instanceof Error ? e.message : "형식 확인 필요"}`); }
  }
  const next = reconcileCorrectedApps(mergeReports(base, parsed), result.apps);
  next.installReports = mergeInstallReports(base.installReports, installs);
  const apps = new Map(next.apps.map(app => [app.id,app]));
  for (const app of result.apps) {
    const old = apps.get(app.id);
    apps.set(app.id, {...app, favorite:old?.favorite,
      name:looksLikePackageName(app.name) && old?.name && !looksLikePackageName(old.name) ? old.name : app.name});
  }
  const resolved = withResolvedAppNames([...apps.values()]);
  return {...next, apps:resolved, rows:enrichRowsWithApps(next.rows,resolved),
    appGroups:next.appGroups?.length ? next.appGroups : suggestAppGroups(resolved),
    meta:{...next.meta,updatedAt:now,lastCloudAt:now},
    logs:[{id,at:now,status:syncLogStatus(parsed.length,result.apps.length,errors.length),
      message:formatSyncToast({apps:result.apps.length,documents:parsed.map(p=>p.document),errors}),
      detail:{errors,completed:result.completed,apps:result.apps.length,documents:parsed.length}},...next.logs].slice(0,50)};
}
