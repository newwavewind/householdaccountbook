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

const FETCH_TIMEOUT_MS = 12_000
const INNERTUBE_CLIENT_VERSION = '2.20250218.01.00'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

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

function extractText(field: unknown): string {
  if (!field || typeof field !== 'object') return ''
  const f = field as { simpleText?: string; runs?: { text?: string }[] }
  if (typeof f.simpleText === 'string') return f.simpleText
  if (Array.isArray(f.runs)) return f.runs.map((r) => r.text ?? '').join('')
  return ''
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

/** YouTube InnerTube (공식 웹 API, API 키 불필요) */
async function searchInnerTube(q: string): Promise<YoutubeSearchItem[] | null> {
  const res = await fetchTimed('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      context: {
        client: {
          hl: 'ko',
          gl: 'KR',
          clientName: 'WEB',
          clientVersion: INNERTUBE_CLIENT_VERSION,
        },
      },
      query: q,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const items: YoutubeSearchItem[] = []
  const seen = new Set<string>()

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || items.length >= 12) return
    if (Array.isArray(node)) {
      for (const x of node) walk(x)
      return
    }
    const obj = node as Record<string, unknown>
    const vr = obj.videoRenderer as Record<string, unknown> | undefined
    if (vr && typeof vr.videoId === 'string' && !seen.has(vr.videoId)) {
      seen.add(vr.videoId)
      const thumbs = vr.thumbnail as { thumbnails?: { url?: string }[] } | undefined
      items.push({
        videoId: vr.videoId,
        title: extractText(vr.title) || '(제목 없음)',
        author:
          extractText(vr.ownerText) ||
          extractText(vr.longBylineText) ||
          extractText(vr.shortBylineText) ||
          '',
        thumbnailUrl: thumbFor(vr.videoId, thumbs?.thumbnails?.[0]?.url),
      })
    }
    for (const v of Object.values(obj)) walk(v)
  }

  walk(data)
  return items.length > 0 ? items : null
}

/** YouTube Data API v3 (선택: YOUTUBE_API_KEY 시크릿) */
async function searchYoutubeDataApi(q: string, apiKey: string): Promise<YoutubeSearchItem[] | null> {
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(q)}&key=${apiKey}`
  const res = await fetchTimed(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string }
      snippet?: {
        title?: string
        channelTitle?: string
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
      }
    }>
  }
  const items: YoutubeSearchItem[] = []
  for (const row of data.items ?? []) {
    const id = row.id?.videoId
    if (!id) continue
    items.push({
      videoId: id,
      title: row.snippet?.title ?? '(제목 없음)',
      author: row.snippet?.channelTitle ?? '',
      thumbnailUrl: thumbFor(
        id,
        row.snippet?.thumbnails?.medium?.url ?? row.snippet?.thumbnails?.default?.url,
      ),
    })
  }
  return items.length > 0 ? items : null
}

async function searchPiped(base: string, q: string): Promise<YoutubeSearchItem[] | null> {
  const res = await fetchTimed(`${base}/search?q=${encodeURIComponent(q)}&filter=videos`, {
    headers: { 'User-Agent': 'MJ-Household/1.0' },
  })
  if (!res.ok) return null
  const text = await res.text()
  if (text.includes('shutdown') || text.includes('Shutdown')) return null
  let data: { items?: Array<{ url?: string; title?: string; uploaderName?: string; thumbnail?: string; type?: string }> }
  try {
    data = JSON.parse(text)
  } catch {
    return null
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q) return json([])

  const apiKey = Deno.env.get('YOUTUBE_API_KEY')?.trim()

  try {
    if (apiKey) {
      const apiItems = await searchYoutubeDataApi(q, apiKey)
      if (apiItems) return json(apiItems)
    }

    const inner = await searchInnerTube(q)
    if (inner) return json(inner)

    const pipedBases = [
      'https://pipedapi.tokhmi.xyz',
      'https://api.piped.projectsegfau.lt',
    ]
    for (const base of pipedBases) {
      try {
        const items = await searchPiped(base, q)
        if (items) return json(items)
      } catch {
        /* next */
      }
    }

    return json(
      { error: '검색 결과가 없습니다. 다른 검색어를 시도하거나 URL로 등록해 주세요.' },
      404,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : '검색 실패'
    return json({ error: `유튜브 검색 오류: ${msg}` }, 502)
  }
})
