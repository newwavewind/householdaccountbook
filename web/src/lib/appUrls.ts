/**
 * GitHub Pages 등 `import.meta.env.BASE_URL` 서브패스 배포 시
 * 브라우저 경로·OAuth redirect_to 가 항상 맞도록 URL 조합.
 */

const viteBase = import.meta.env.BASE_URL

/** React Router basename (예: `/householdaccountbook`). 루트 배포면 `undefined`. */
export function routerBasename(): string | undefined {
  const trimmed = viteBase.replace(/\/$/, '')
  return trimmed === '' ? undefined : trimmed
}

/**
 * 라우팅되는 절대 경로 (항상 선행 `/`).
 * @param relativeSlug `auth/callback`, `/foo` 등
 */
export function appPath(relativeSlug: string): string {
  const slug = relativeSlug.replace(/^\//, '')
  const root = viteBase.endsWith('/') ? viteBase : `${viteBase}/`
  if (root === '/') return `/${slug}`
  return `${root.replace(/\/$/, '')}/${slug}`
}

/** 현재 오리진 + vite base 기준 풀 URL (OAuth `redirect_to` 용) */
export function appPublicUrl(relativeSlug: string): string {
  const path = appPath(relativeSlug)
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

/** Supabase Google OAuth 가 돌아올 앱 콜백 주소 */
export function oauthCallbackFullUrl(): string {
  return appPublicUrl('auth/callback')
}
