import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const app = express()
const PORT = Number(process.env.PORT) || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret'

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '12mb' }))

type JwtPayload = { sub: string; role: string }

function signToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role } satisfies JwtPayload, JWT_SECRET, {
    expiresIn: '60d',
  })
}

function verifyToken(token: string): JwtPayload | null {
  try {
    const v = jwt.verify(token, JWT_SECRET)
    if (typeof v === 'string' || !v || typeof v !== 'object') return null
    const sub = (v as JwtPayload).sub
    const role = (v as JwtPayload).role
    if (typeof sub !== 'string' || typeof role !== 'string') return null
    return { sub, role }
  } catch {
    return null
  }
}

function getBearer(req: express.Request): string | null {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return null
  return h.slice(7).trim() || null
}

function authOptional(
  req: express.Request,
): { userId: string; role: string } | null {
  const t = getBearer(req)
  if (!t) return null
  const p = verifyToken(t)
  if (!p) return null
  return { userId: p.sub, role: p.role }
}

function authRequired(
  req: express.Request,
  res: express.Response,
): { userId: string; role: string } | null {
  const a = authOptional(req)
  if (!a) {
    res.status(401).json({ error: '인증이 필요합니다.' })
    return null
  }
  return a
}

function serializePost(p: {
  id: string
  authorId: string
  authorDisplayName: string
  title: string
  body: string
  hidden: boolean
  isNotice: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: p.id,
    authorId: p.authorId,
    authorDisplayName: p.authorDisplayName,
    title: p.title,
    body: p.body,
    hidden: p.hidden,
    isNotice: p.isNotice,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    viewCount: 0,
    todayViewCount: 0,
  }
}

function canSeePost(
  p: { hidden: boolean; authorId: string },
  auth: { userId: string; role: string } | null,
): boolean {
  if (!p.hidden) return true
  if (!auth) return false
  if (auth.role === 'admin') return true
  return p.authorId === auth.userId
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

type YoutubeSearchItem = {
  videoId: string
  title: string
  author: string
  thumbnailUrl: string
}

function parseVideoIdFromPipedUrl(url: string): string | null {
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

async function serverYoutubeSearch(q: string): Promise<YoutubeSearchItem[]> {
  const pipedBases = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfau.lt',
  ]
  for (const base of pipedBases) {
    try {
      const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}&filter=videos`)
      if (!res.ok) continue
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
        const videoId = parseVideoIdFromPipedUrl(i.url)
        if (!videoId) continue
        items.push({
          videoId,
          title: i.title ?? '(제목 없음)',
          author: i.uploaderName ?? '',
          thumbnailUrl: i.thumbnail ?? '',
        })
        if (items.length >= 12) break
      }
      if (items.length > 0) return items
    } catch {
      /* next */
    }
  }

  const invidiousBases = ['https://yewtu.be', 'https://invidious.privacydev.net']
  for (const base of invidiousBases) {
    try {
      const res = await fetch(
        `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video`,
      )
      if (!res.ok) continue
      const data = (await res.json()) as Array<{
        type?: string
        videoId?: string
        title?: string
        author?: string
        authorId?: string
        videoThumbnails?: { url?: string }[]
      }>
      if (!Array.isArray(data)) continue
      const items = data
        .filter((v) => v.type === 'video' && v.videoId)
        .slice(0, 12)
        .map((v) => ({
          videoId: v.videoId!,
          title: v.title ?? '(제목 없음)',
          author: v.author ?? v.authorId ?? '',
          thumbnailUrl: v.videoThumbnails?.[0]?.url ?? '',
        }))
      if (items.length > 0) return items
    } catch {
      /* next */
    }
  }
  throw new Error('유튜브 검색에 실패했습니다.')
}

app.get('/api/youtube/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.json([])
  try {
    const items = await serverYoutubeSearch(q)
    res.json(items)
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : '검색 실패',
    })
  }
})

// ── Ledger (로컬에선 인증 없음 — 운영 Supabase 단계에서 RLS·키로 보호)
app.get('/api/ledgers/:id', async (req, res) => {
  const row = await prisma.householdLedger.findUnique({
    where: { id: req.params.id },
  })
  if (!row) return res.status(404).json({ error: 'not found' })
  res.json({
    payload: row.payload,
    updatedAt: row.updatedAt.toISOString(),
  })
})

app.put('/api/ledgers/:id', async (req, res) => {
  const payload = req.body?.payload
  if (payload === undefined) {
    return res.status(400).json({ error: 'payload가 필요합니다.' })
  }
  try {
    await prisma.householdLedger.upsert({
      where: { id: req.params.id },
      create: { id: req.params.id, payload },
      update: { payload },
    })
    res.status(204).send()
  } catch {
    res.status(400).json({ error: 'payload 형식을 저장할 수 없습니다.' })
  }
})

// ── Dev auth (로컬 전용 — 이후 Supabase Auth 로 교체)
app.post('/api/auth/dev', async (req, res) => {
  const emailRaw = req.body?.email
  const displayNameRaw = req.body?.displayName
  const roleRaw = req.body?.role === 'admin' ? 'admin' : 'user'
  const email =
    typeof emailRaw === 'string' && emailRaw.trim().length > 0
      ? emailRaw.trim()
      : `user-${randomUUID()}@local.dev`
  const displayName =
    typeof displayNameRaw === 'string' && displayNameRaw.trim().length > 0
      ? displayNameRaw.trim()
      : '로컬 사용자'

  let profile = await prisma.profile.findUnique({ where: { email } })
  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email,
        displayName,
        role: roleRaw,
      },
    })
  } else {
    profile = await prisma.profile.update({
      where: { id: profile.id },
      data: { displayName, role: roleRaw },
    })
  }

  const token = signToken(profile.id, profile.role)
  res.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName ?? '',
      avatarUrl: profile.avatarUrl ?? undefined,
      role: profile.role,
    },
  })
})

app.get('/api/me', async (req, res) => {
  const auth = authRequired(req, res)
  if (!auth) return
  const profile = await prisma.profile.findUnique({
    where: { id: auth.userId },
  })
  if (!profile) return res.status(401).json({ error: '프로필이 없습니다.' })
  res.json({
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName ?? '',
    avatarUrl: profile.avatarUrl ?? undefined,
    role: profile.role,
  })
})

const CONCEPT_LIKE_THRESHOLD = 5

function postMatchesSearch(
  p: { title: string; body: string },
  search: string,
  scope: string,
): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const plain = p.body.replace(/<[^>]+>/g, ' ')
  const inTitle = p.title.toLowerCase().includes(q)
  const inBody = plain.toLowerCase().includes(q)
  if (scope === 'title') return inTitle
  if (scope === 'content') return inBody
  return inTitle || inBody
}

// ── Posts
app.get('/api/posts', async (req, res) => {
  const auth = authOptional(req)
  const includeHidden = req.query.includeHidden === '1'
  const tab = String(req.query.tab ?? 'all')
  const search = String(req.query.search ?? '')
  const searchScope = String(req.query.searchScope ?? 'both')
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSizeRaw = Number(req.query.pageSize)
  const pageSize =
    pageSizeRaw === 10 || pageSizeRaw === 30 || pageSizeRaw === 50 || pageSizeRaw === 100
      ? pageSizeRaw
      : 30
  const paged = req.query.page != null || req.query.pageSize != null || req.query.tab != null || search

  const list = await prisma.post.findMany({
    orderBy: [{ isNotice: 'desc' }, { createdAt: 'desc' }],
  })
  let visible = list.filter((p) => includeHidden || canSeePost(p, auth))

  if (tab === 'notice') visible = visible.filter((p) => p.isNotice)
  else if (tab === 'concept') {
    // Prisma 백엔드에는 추천 수 컬럼이 없어 개념글 탭은 비어 있습니다.
    visible = []
  }

  if (search) visible = visible.filter((p) => postMatchesSearch(p, search, searchScope))

  const total = visible.length
  let slice = visible
  if (paged) {
    const start = (page - 1) * pageSize
    slice = visible.slice(start, start + pageSize)
  }

  const items = slice.map((p, index) => ({
    ...serializePost(p),
    listNumber: paged ? total - (page - 1) * pageSize - index : undefined,
  }))

  res.json({ items, total })
})

app.get('/api/posts/:id', async (req, res) => {
  const auth = authOptional(req)
  const p = await prisma.post.findUnique({ where: { id: req.params.id } })
  if (!p) return res.status(404).json({ error: '글을 찾을 수 없습니다.' })
  if (!canSeePost(p, auth)) return res.status(404).json({ error: '글을 찾을 수 없습니다.' })
  res.json(serializePost(p))
})

app.post('/api/posts', async (req, res) => {
  const auth = authRequired(req, res)
  if (!auth) return
  const title = req.body?.title
  const body = req.body?.body
  if (typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: '제목이 필요합니다.' })
  }
  const bodyText = typeof body === 'string' ? body : ''

  const profile = await prisma.profile.findUnique({ where: { id: auth.userId } })
  if (!profile) return res.status(401).json({ error: '프로필이 없습니다.' })

  const display =
    profile.displayName?.trim() ||
    profile.email?.split('@')[0] ||
    '작성자'

  const row = await prisma.post.create({
    data: {
      authorId: auth.userId,
      authorDisplayName: display,
      title: title.trim(),
      body: bodyText,
    },
  })
  res.status(201).json(serializePost(row))
})

app.patch('/api/posts/:id', async (req, res) => {
  const auth = authRequired(req, res)
  if (!auth) return
  const existing = await prisma.post.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: '글을 찾을 수 없습니다.' })
  const isAdmin = auth.role === 'admin'
  if (existing.authorId !== auth.userId && !isAdmin) {
    return res.status(403).json({ error: '수정할 수 없습니다.' })
  }
  const title = req.body?.title
  const body = req.body?.body
  if (typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: '제목이 필요합니다.' })
  }
  const bodyText = typeof body === 'string' ? body : ''
  await prisma.post.update({
    where: { id: req.params.id },
    data: { title: title.trim(), body: bodyText },
  })
  res.status(204).send()
})

app.delete('/api/posts/:id', async (req, res) => {
  const auth = authRequired(req, res)
  if (!auth) return
  const existing = await prisma.post.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: '글을 찾을 수 없습니다.' })
  const isAdmin = auth.role === 'admin'
  if (existing.authorId !== auth.userId && !isAdmin) {
    return res.status(403).json({ error: '삭제할 수 없습니다.' })
  }
  await prisma.post.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

app.patch('/api/posts/:id/hidden', async (req, res) => {
  const auth = authRequired(req, res)
  if (!auth) return
  if (auth.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 숨김 처리할 수 있습니다.' })
  }
  const hidden = req.body?.hidden
  if (typeof hidden !== 'boolean') {
    return res.status(400).json({ error: 'hidden(boolean)이 필요합니다.' })
  }
  const existing = await prisma.post.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: '글을 찾을 수 없습니다.' })
  await prisma.post.update({
    where: { id: req.params.id },
    data: { hidden },
  })
  res.status(204).send()
})

app.patch('/api/posts/:id/notice', async (req, res) => {
  const auth = authRequired(req, res)
  if (!auth) return
  if (auth.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 공지 설정할 수 있습니다.' })
  }
  const isNotice = req.body?.isNotice
  if (typeof isNotice !== 'boolean') {
    return res.status(400).json({ error: 'isNotice(boolean)이 필요합니다.' })
  }
  const existing = await prisma.post.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: '글을 찾을 수 없습니다.' })
  await prisma.post.update({
    where: { id: req.params.id },
    data: { isNotice },
  })
  res.status(204).send()
})

app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}`)
})
