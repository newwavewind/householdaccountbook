import { getCommunitySupabase } from '../lib/communitySupabaseClient'
import { normalizeNickname } from '../lib/nickname'

export async function fetchProfileNickname(
  userId: string,
): Promise<string | null> {
  const client = getCommunitySupabase()
  if (!client) return null
  const { data, error } = await client
    .from('profiles')
    .select('nickname')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  const n = data?.nickname
  return typeof n === 'string' && n.trim() ? normalizeNickname(n) : null
}

export async function saveProfileNickname(
  userId: string,
  nickname: string,
): Promise<void> {
  const client = getCommunitySupabase()
  if (!client) throw new Error('Supabase가 설정되지 않았습니다.')
  const { error } = await client
    .from('profiles')
    .update({
      nickname: normalizeNickname(nickname),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}
