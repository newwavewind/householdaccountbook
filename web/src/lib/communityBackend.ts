import { isCommunitySupabaseConfigured } from './communitySupabaseClient'

export type CommunityBackendMode = 'mock' | 'supabase' | 'prisma'

/**
 * - mock: 로컬 목업( localStorage 글·세션 )
 * - prisma: 로컬 API(`/api`, SQLite·Prisma 서버)
 * - supabase: 배포용 Auth·Postgres
 */
export function communityBackendMode(): CommunityBackendMode {
  const raw = import.meta.env.VITE_COMMUNITY_BACKEND?.trim().toLowerCase()
  if (raw === 'mock') return 'mock'
  if (raw === 'prisma') return 'prisma'
  if (raw === 'supabase') return 'supabase'
  if (isCommunitySupabaseConfigured()) return 'supabase'
  return 'mock'
}