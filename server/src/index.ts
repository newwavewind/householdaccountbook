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

function extractInnerTubeText(field: unknown): string {
  if (!field || typeof field !== 'object') return ''
  const f = field as { simpleText?: string; runs?: { text?: string }[] }
  if (typeof f.simpleText === 'string') return f.simpleText
  if (Array.isArray(f.runs)) return f.runs.map((r) => r.text ?? '').join('')
  return ''
}

async function searchInnerTube(q: string): Promise<YoutubeSearchItem[]> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
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
          clientVersion: '2.20250218.01.00',
        },
      },
      query: q,
    }),
  })
  if (!res.ok) throw new Error(`InnerTube 검색 실패 (${res.status})`)
  const data: unknown = await res.json()
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
        title: extractInnerTubeText(vr.title) || '(제목 없음)',
        author:
          extractInnerTubeText(vr.ownerText) ||
          extractInnerTubeText(vr.longBylineText) ||
          '',
        thumbnailUrl:
          thumbs?.thumbnails?.[0]?.url ??
          `https://i.ytimg.com/vi/${vr.videoId}/mqdefault.jpg`,
      })
    }
    for (const v of Object.values(obj)) walk(v)
  }
  walk(data)
  if (items.length === 0) throw new Error('검색 결과가 없습니다.')
  return items
}

async function serverYoutubeSearch(q: string): Promise<YoutubeSearchItem[]> {
  return searchInnerTube(q)
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
function profilePublicName(profile: {
  nickname: string | null
  displayName: string | null
}): string {
  return profile.nickname?.trim() || profile.displayName?.trim() || ''
}

app.post('/api/auth/dev', async (req, res) => {
  const emailRaw = req.body?.email
  const displayNameRaw = req.body?.displayName
  const nicknameRaw = req.body?.nickname
  const roleRaw = req.body?.role === 'admin' ? 'admin' : 'user'
  const email =
    typeof emailRaw === 'string' && emailRaw.trim().length > 0
      ? emailRaw.trim()
      : `user-${randomUUID()}@local.dev`
  const nickname =
    typeof nicknameRaw === 'string' && nicknameRaw.trim().length > 0
      ? nicknameRaw.trim()
      : typeof displayNameRaw === 'string' && displayNameRaw.trim().length > 0
        ? displayNameRaw.trim()
        : '맑은고양이42'

  let profile = await prisma.profile.findUnique({ where: { email } })
  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email,
        displayName: null,
        nickname,
        role: roleRaw,
      },
    })
  } else {
    profile = await prisma.profile.update({
      where: { id: profile.id },
      data: { nickname, role: roleRaw },
    })
  }

  const token = signToken(profile.id, profile.role)
  const publicName = profilePublicName(profile)
  res.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      displayName: publicName,
      nickname: profile.nickname ?? '',
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
  const publicName = profilePublicName(profile)
  res.json({
    id: profile.id,
    email: profile.email,
    displayName: publicName,
    nickname: profile.nickname ?? '',
    avatarUrl: profile.avatarUrl ?? undefined,
    role: profile.role,
  })
})

app.patch('/api/me/nickname', async (req, res) => {
  const auth = authRequired(req, res)
  if (!auth) return
  const raw = req.body?.nickname
  if (typeof raw !== 'string' || raw.trim().length < 2 || raw.trim().length > 24) {
    return res.status(400).json({ error: '닉네임은 2~24자여야 합니다.' })
  }
  const nickname = raw.trim().replace(/\s+/g, ' ')
  if (nickname.includes('@')) {
    return res.status(400).json({ error: '이메일 형식은 닉네임으로 쓸 수 없습니다.' })
  }
  const profile = await prisma.profile.update({
    where: { id: auth.userId },
    data: { nickname },
  })
  res.json({
    id: profile.id,
    email: profile.email,
    displayName: profilePublicName(profile),
    nickname: profile.nickname ?? '',
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

  const display = profilePublicName(profile) || '익명'

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
