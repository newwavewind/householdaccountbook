import type { AppProduct } from "./types";

const PACKAGE_LABELS: Record<string, string> = {
  "com.sanghyun.civillaw": "봄기출 공인중개사",
  "com.sanghyun.english": "봄기출 공무원영어",
  "com.sanghyun.gugeo": "봄기출 공무원국어",
  "com.sanghyun.publicofficial": "봄기출 공무원",
  "com.sanghyun.police": "봄기출 경찰공무원",
  "com.sanghyun.firefighter": "봄기출 소방공무원",
  "com.sanghyun.housing": "봄기출 주택관리사",
  "com.sanghyun.socialworker": "봄기출 사회복지사1급",
  "com.sanghyun.haengjung": "봄기출 행정사",
  "com.sanghyun.semusa": "봄기출 세무사",
  "com.sanghyun.nomusa": "봄기출 공인노무사",
  "com.sanghyun.sonhae": "봄기출 손해평가사",
  "com.sanghyun.tax": "봄기출 세무",
};

export function looksLikePackageName(name: string | undefined | null) {
  if (!name) return true;
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(name.trim());
}

export function resolveAppDisplayName(app: AppProduct, catalog: AppProduct[]) {
  if (!looksLikePackageName(app.name)) return app.name;
  const appleTwin = catalog.find(
    (a) =>
      a.platform === "apple" &&
      a.bundleId === app.bundleId &&
      !looksLikePackageName(a.name),
  );
  if (appleTwin?.name) return appleTwin.name;
  return PACKAGE_LABELS[app.bundleId] || app.name;
}

export function withResolvedAppNames(apps: AppProduct[]): AppProduct[] {
  return apps.map((app) => {
    const name = resolveAppDisplayName(app, apps);
    return name === app.name ? app : { ...app, name };
  });
}
