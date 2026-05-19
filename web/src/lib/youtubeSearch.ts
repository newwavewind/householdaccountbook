import { isCommunitySupabaseConfigured } from './communitySupabaseClient'

export type YoutubeSearchItem = {
  videoId: string
  title: string
  author: string
  thumbnailUrl: string
}

const SEARCH_TIMEOUT_MS = 22_000

function pickThumb(thumbnails?: { url?: string }[]): string {
  if (!thumbnails?.length) return ''
  return thumbnails[0]?.url ?? ''
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  ms = SEARCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('\uac80\uc0c9 \uc2dc\uac04\uc774 \ucd08\uacfc\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.')
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

function normalizeItem(item: YoutubeSearchItem): YoutubeSearchItem {
  return {
    ...item,
    thumbnailUrl: item.thumbnailUrl || youtubeThumbnailUrl(item.videoId),
  }
}

async function searchViaSupabaseProxy(q: string): Promise<YoutubeSearchItem[]> {
  if (!isCommunitySupabaseConfigured()) {
    throw new Error('\uc720\ud29c\ube0c \uac80\uc0c9 \uc124\uc815\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.')
  }
  const base = import.meta.env.VITE_SUPABASE_URL!.replace(/\/$/, '')
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY!
  const res = await fetchWithTimeout(
    `${base}/functions/v1/youtube-search?q=${encodeURIComponent(q)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    },
  )
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(errBody?.error ?? `\uac80\uc0c9 \uc2e4\ud328 (${res.status})`)
  }
  const data = (await res.json()) as YoutubeSearchItem[] | { error?: string }
  if (!Array.isArray(data)) {
    throw new Error(
      typeof data === 'object' && data && 'error' in data && data.error
        ? String(data.error)
        : '\uac80\uc0c9 \uacb0\uacfc \ud615\uc2dd \uc624\ub958',
    )
  }
  return data.map(normalizeItem)
}

async function searchViaLocalApi(q: string): Promise<YoutubeSearchItem[] | null> {
  try {
    const res = await fetchWithTimeout(`/api/youtube/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) return null
    const data = (await res.json()) as YoutubeSearchItem[]
    if (!Array.isArray(data)) return null
    return data.map(normalizeItem)
  } catch {
    return null
  }
}

async function searchDirectInvidious(q: string): Promise<YoutubeSearchItem[]> {
  const endpoints = [
    `https://yewtu.be/api/v1/search?q=${encodeURIComponent(q)}&type=video`,
    `https://invidious.privacydev.net/api/v1/search?q=${encodeURIComponent(q)}&type=video`,
  ]

  let lastErr: Error | null = null
  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url)
      if (!res.ok) throw new Error(`\uac80\uc0c9 \uc2e4\ud328 (${res.status})`)
      const data = (await res.json()) as Array<{
        type?: string
        videoId?: string
        title?: string
        author?: string
        authorId?: string
        videoThumbnails?: { url?: string }[]
      }>
      if (!Array.isArray(data)) throw new Error('\uac80\uc0c9 \uacb0\uacfc \ud615\uc2dd \uc624\ub958')
      return data
        .filter((v) => v.type === 'video' && v.videoId)
        .slice(0, 12)
        .map((v) =>
          normalizeItem({
            videoId: v.videoId!,
            title: v.title ?? '(\uc81c\ubaa9 \uc5c6\uc74c)',
            author: v.author ?? v.authorId ?? '',
            thumbnailUrl: pickThumb(v.videoThumbnails),
          }),
        )
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error('\uac80\uc0c9 \uc2e4\ud328')
    }
  }
  throw lastErr ?? new Error('\uc720\ud29c\ube0c \uac80\uc0c9\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.')
}

export async function searchYoutubeVideos(query: string): Promise<YoutubeSearchItem[]> {
  const q = query.trim()
  if (!q) return []

  if (isCommunitySupabaseConfigured()) {
    try {
      return await searchViaSupabaseProxy(q)
    } catch (supabaseErr) {
      if (import.meta.env.DEV) {
        const local = await searchViaLocalApi(q)
        if (local && local.length > 0) return local
      }
      throw supabaseErr
    }
  }

  if (import.meta.env.DEV) {
    const local = await searchViaLocalApi(q)
    if (local) return local
  }

  try {
    return await searchDirectInvidious(q)
  } catch (directErr) {
    const msg = directErr instanceof Error ? directErr.message : '\uac80\uc0c9 \uc2e4\ud328'
    if (msg.includes('fetch') || msg === 'Failed to fetch' || msg.includes('aborted')) {
      throw new Error(
        '\uac80\uc0c9 \uc11c\ubc84\uc5d0 \uc5f0\uacb0\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. URL \uc785\ub825\uc73c\ub85c \ub4f1\ub85d\ud558\uac70\ub098 \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.',
      )
    }
    throw directErr
  }
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
