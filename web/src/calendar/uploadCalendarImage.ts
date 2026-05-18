import { getSupabase, isCloudSyncEnabled } from '../lib/supabaseClient'

export const CALENDAR_MEDIA_BUCKET = 'calendar-media'

/** Storage 버킷 file_size_limit 과 동일 */
export const CALENDAR_IMAGE_MAX_BYTES = 10 * 1024 * 1024

export async function uploadCalendarImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 올릴 수 있어요.')
  }
  if (file.size > CALENDAR_IMAGE_MAX_BYTES) {
    throw new Error('사진은 10MB 이하로 올려 주세요.')
  }
  if (!isCloudSyncEnabled()) {
    throw new Error('사진 업로드는 Supabase가 연결된 환경에서만 가능해요.')
  }

  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase 연결이 필요합니다.')
  }

  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) {
    throw new Error(
      '사진을 올리려면 로그인이 필요합니다.\n오른쪽 상단 "로그인" 버튼을 눌러 주세요.',
    )
  }

  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const ext = /^(jpe?g|png|gif|webp|avif|heic|heif)$/.test(rawExt) ? rawExt : 'jpg'
  const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await sb.storage.from(CALENDAR_MEDIA_BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (error) {
    if (
      error.message.includes('row-level security') ||
      error.message.includes('Unauthorized')
    ) {
      throw new Error('업로드 권한이 없습니다. 로그인 상태를 확인해 주세요.')
    }
    throw new Error(error.message)
  }

  const { data: urlData } = sb.storage.from(CALENDAR_MEDIA_BUCKET).getPublicUrl(path)
  return urlData.publicUrl
}
