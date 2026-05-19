export type YoutubeSearchItem = {
  videoId: string
  title: string
  author: string
  thumbnailUrl: string
}

function pickThumb(thumbnails?: { url?: string }[]): string {
  if (!thumbnails?.length) return ''
  return thumbnails[0]?.url ?? ''
}

/** Invidious 공개 API로 유튜브 검색 (API 키 불필요) */
export async function searchYoutubeVideos(query: string): Promise<YoutubeSearchItem[]> {
  const q = query.trim()
  if (!q) return []

  const endpoints = [
    `https://yewtu.be/api/v1/search?q=${encodeURIComponent(q)}&type=video`,
    `https://invidious.privacydev.net/api/v1/search?q=${encodeURIComponent(q)}&type=video`,
  ]

  let lastErr: Error | null = null
  for (const url of endpoints) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`검색 실패 (${res.status})`)
      const data = (await res.json()) as Array<{
        type?: string
        videoId?: string
        title?: string
        author?: string
        authorId?: string
        videoThumbnails?: { url?: string }[]
      }>
      if (!Array.isArray(data)) throw new Error('검색 결과 형식 오류')
      return data
        .filter((v) => v.type === 'video' && v.videoId)
        .slice(0, 12)
        .map((v) => ({
          videoId: v.videoId!,
          title: v.title ?? '(제목 없음)',
          author: v.author ?? v.authorId ?? '',
          thumbnailUrl: pickThumb(v.videoThumbnails),
        }))
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error('검색 실패')
    }
  }
  throw lastErr ?? new Error('유튜브 검색에 실패했습니다.')
}

export function parseYoutubeVideoId(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(t)) return t
  try {
    const u = new URL(t)
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '')
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
      const m = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/)
      if (m) return m[1]
    }
  } catch {
    return null
  }
  return null
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}
