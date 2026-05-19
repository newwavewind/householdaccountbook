import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type YoutubeSearchItem = {
  videoId: string
  title: string
  author: string
  thumbnailUrl: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const FETCH_TIMEOUT_MS = 8_000

async function fetchTimed(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function thumbFor(videoId: string, thumb?: string): string {
  return thumb?.trim() ? thumb : `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}

function parseVideoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url, 'https://www.youtube.com')
    const v = u.searchParams.get('v')
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
  } catch {
    /* ignore */
  }
  const m = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

async function searchPiped(base: string, q: string): Promise<YoutubeSearchItem[] | null> {
  const res = await fetchTimed(`${base}/search?q=${encodeURIComponent(q)}&filter=videos`, {
    headers: { 'User-Agent': 'MJ-Household/1.0' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    items?: Array<{
      url?: string
      title?: string
      uploaderName?: string
      thumbnail?: string
      type?: string
    }>
  }
  const items: YoutubeSearchItem[] = []
  for (const i of data.items ?? []) {
    if (i.type !== 'stream' || !i.url) continue
    const videoId = parseVideoIdFromUrl(i.url)
    if (!videoId) continue
    items.push({
      videoId,
      title: i.title ?? '(제목 없음)',
      author: i.uploaderName ?? '',
      thumbnailUrl: thumbFor(videoId, i.thumbnail),
    })
    if (items.length >= 12) break
  }
  return items.length > 0 ? items : null
}

async function searchInvidious(base: string, q: string): Promise<YoutubeSearchItem[] | null> {
  const res = await fetchTimed(`${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video`, {
    headers: { 'User-Agent': 'MJ-Household/1.0' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as Array<{
    type?: string
    videoId?: string
    title?: string
    author?: string
    authorId?: string
    videoThumbnails?: { url?: string }[]
  }>
  if (!Array.isArray(data)) return null
  const items = data
    .filter((v) => v.type === 'video' && v.videoId)
    .slice(0, 12)
    .map((v) => ({
      videoId: v.videoId!,
      title: v.title ?? '(제목 없음)',
      author: v.author ?? v.authorId ?? '',
      thumbnailUrl: thumbFor(v.videoId!, v.videoThumbnails?.[0]?.url),
    }))
  return items.length > 0 ? items : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q) return json([])

  const pipedBases = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.adminforge.de',
  ]
  const invidiousBases = [
    'https://yewtu.be',
    'https://invidious.privacydev.net',
    'https://inv.nadeko.net',
  ]

  for (const base of pipedBases) {
    try {
      const items = await searchPiped(base, q)
      if (items) return json(items)
    } catch {
      /* try next */
    }
  }

  for (const base of invidiousBases) {
    try {
      const items = await searchInvidious(base, q)
      if (items) return json(items)
    } catch {
      /* try next */
    }
  }

  return json(
    { error: '\uc720\ud29c\ube0c \uac80\uc0c9\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4. URL\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.' },
    502,
  )
})
