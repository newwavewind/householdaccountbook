import { type SupabaseClient } from '@supabase/supabase-js'
import {
  getCommunitySupabase,
  isCommunitySupabaseConfigured,
} from './communitySupabaseClient'

export function isCloudSyncEnabled(): boolean {
  return isCommunitySupabaseConfigured()
}

/**
 * 장부 DB 조작용 클라이언트.
 * communitySupabaseClient 와 동일한 인스턴스를 반환해 GoTrueClient 중복을 방지합니다.
 */
export function getSupabase(): SupabaseClient | null {
  return getCommunitySupabase()
}

/** 환경 변수로 지정한 장부 ID (prisma 모드 호환용) */
export function ledgerId(): string {
  const id = import.meta.env.VITE_LEDGER_ID
  if (typeof id === 'string' && id.trim().length > 0) return id.trim()
  return 'shared-household'
}
