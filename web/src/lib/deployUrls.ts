/** Vercel Production 고정 도메인 (북마크·문서·Supabase Redirect 등록용) */
export const VERCEL_PRODUCTION_ORIGIN = 'https://web-coral-eta-s5q4upi7il.vercel.app'

export const VERCEL_PRODUCTION_AUTH_CALLBACK = `${VERCEL_PRODUCTION_ORIGIN}/auth/callback`

/** Supabase → Authentication → URL Configuration 에 넣을 Redirect URL 목록 */
export const SUPABASE_REDIRECT_URLS = [
  'http://localhost:5173/auth/callback',
  VERCEL_PRODUCTION_AUTH_CALLBACK,
  'https://newwavewind.github.io/householdaccountbook/auth/callback',
] as const
