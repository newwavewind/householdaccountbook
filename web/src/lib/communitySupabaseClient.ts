import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const storageKey = 'sb-community-session'

/** 커뮤니티·Auth 전용 클라이언트. 가계부용 [supabaseClient](supabaseClient.ts)와 저장소를 분리한다. */
let communityClient: SupabaseClient | null = null

export function isCommunitySupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  return typeof url === 'string' && url.startsWith('http') && typeof anon === 'string' && anon.length > 0
}

/** 세션 저장·프로바이더 콜백 처리. 미설정 시 null. */
export function getCommunitySupabase(): SupabaseClient | null {
  if (!isCommunitySupabaseConfigured()) return null
  if (!communityClient) {
    const url = import.meta.env.VITE_SUPABASE_URL!
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!
    communityClient = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        /** Provider와 콜백에서 getSession이 겹치며 code를 두 번 소비하는 것을 막기 위해, 교환은 AuthCallbackPage만 처리 */
        detectSessionInUrl: false,
        flowType: 'pkce',
        storageKey,
      },
    })
  }
  return communityClient
}
