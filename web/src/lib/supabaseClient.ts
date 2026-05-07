import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

/** URL·anon 키가 있으면 Supabase 동기화 사용 */
export function isCloudSyncEnabled(): boolean {
  return typeof url === 'string' && url.length > 0 && url.startsWith('http') &&
    typeof anon === 'string' && anon.length > 0
}

export function getSupabase(): SupabaseClient | null {
  if (!isCloudSyncEnabled()) return null
  if (!client) {
    client = createClient(url!, anon!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return client
}

/** 한 가계 공유용 행 ID. Vercel 환경 변수에 같은 값을 넣어 두 사람이 동일 장부를 봅니다. */
export function ledgerId(): string {
  const id = import.meta.env.VITE_LEDGER_ID
  if (typeof id === 'string' && id.trim().length > 0) return id.trim()
  return 'shared-household'
}
