import type { AppProduct, RevenueRow } from "./types";

/** Apple 판매 보고서 SKU → bundleId (Parent Identifier 비어 있을 때) */
const SKU_TO_BUNDLE: Record<string, string> = {
  "bomgichul-police": "com.sanghyun.police",
  "bomgichul-gongmuwon": "com.sanghyun.publicofficial",
  "bomgichul-housing": "com.sanghyun.housing",
  "bomgichul-socialworker": "com.sanghyun.socialworker",
  bomgichul001: "com.sanghyun.civillaw",
  "bomgichul-english": "com.sanghyun.english",
  "bomgichul-gugeo": "com.sanghyun.gugeo",
  "bomgichul-firefighter": "com.sanghyun.firefighter",
  "bomgichul-haengjung": "com.sanghyun.haengjung",
  "bomgichul-semusa": "com.sanghyun.semusa",
  "bomgichul-nomusa": "com.sanghyun.nomusa",
  "bomgichul-sonhae": "com.sanghyun.sonhae",
  "bomgichul-tax": "com.sanghyun.tax",
};

function stripPrefix(id: string) {
  return id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
}

export function resolveAppleReportAppKey(get: (...keys: string[]) => string): string {
  const parent = (get("Parent Identifier", "Parent Apple Identifier") || "").trim();
  const appleId = (get("Apple Identifier", "Apple ID") || "").trim();
  const sku = (get("SKU", "SKU ID") || "").trim();
  // 앱 단위 숫자 ID 우선
  if (/^\d{6,}$/.test(parent)) return parent;
  // IAP 행에서 Parent가 앱 ID인 경우
  if (/^\d{6,}$/.test(appleId) && !sku) return appleId;
  if (/^\d{6,}$/.test(parent)) return parent;
  // Parent가 비면 SKU로 두고 enrich 단계에서 앱에 연결
  return parent || appleId || sku;
}

export function findAppForRowKey(
  keyOrId: string,
  apps: AppProduct[],
  platform?: string,
): AppProduct | undefined {
  const key = stripPrefix(keyOrId).toLowerCase();
  const list = platform ? apps.filter((a) => a.platform === platform) : apps;
  const byId = list.find((a) => a.id === keyOrId || stripPrefix(a.id).toLowerCase() === key);
  if (byId) return byId;
  const byBundle = list.find((a) => a.bundleId.toLowerCase() === key);
  if (byBundle) return byBundle;
  const mapped = SKU_TO_BUNDLE[key];
  if (mapped) {
    const hit = list.find((a) => a.bundleId.toLowerCase() === mapped);
    if (hit) return hit;
  }
  // bomgichul-police → police, bomgichul001 already mapped
  const slug = key.replace(/^bomgichul[-_]?/, "");
  if (slug && slug !== key) {
    const hit = list.find(
      (a) =>
        a.platform === "apple" &&
        (a.bundleId.toLowerCase().endsWith(`.${slug}`) ||
          a.bundleId.toLowerCase().includes(slug) ||
          a.name.toLowerCase().includes(slug)),
    );
    if (hit) return hit;
  }
  return undefined;
}

export function enrichRowsWithApps(rows: RevenueRow[], apps: AppProduct[]): RevenueRow[] {
  if (!apps.length) return rows;
  return rows.map((row) => {
    const direct = apps.find((a) => a.id === row.appId);
    if (direct) return { ...row, appName: direct.name || row.appName };
    const matched = findAppForRowKey(row.appId, apps, row.platform);
    if (matched)
      return {
        ...row,
        appId: matched.id,
        appName: matched.name || row.appName,
      };
    // Google: google:com.x already matches; also try bare package
    if (row.platform === "google") {
      const pkg = stripPrefix(row.appId);
      const g = apps.find(
        (a) => a.platform === "google" && (a.bundleId === pkg || a.id === `google:${pkg}`),
      );
      if (g) return { ...row, appId: g.id, appName: g.name || row.appName };
    }
    return row;
  });
}

/** 포트폴리오 카드용: 앱 ID·번들·SKU 별칭이 같은 매출 행 */
export function rowsForApp(app: AppProduct, rows: RevenueRow[]): RevenueRow[] {
  const aliases = new Set<string>([app.id, `apple:${app.bundleId}`, `google:${app.bundleId}`]);
  for (const [sku, bundle] of Object.entries(SKU_TO_BUNDLE)) {
    if (bundle === app.bundleId) {
      aliases.add(`apple:${sku}`);
      aliases.add(sku);
    }
  }
  const bundle = app.bundleId.toLowerCase();
  return rows.filter((r) => {
    if (r.platform !== app.platform) return false;
    if (r.appId === app.id || aliases.has(r.appId)) return true;
    const key = stripPrefix(r.appId).toLowerCase();
    if (key === bundle) return true;
    if (SKU_TO_BUNDLE[key] === app.bundleId) return true;
    return false;
  });
}
