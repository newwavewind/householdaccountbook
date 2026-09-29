import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

export type RevenueAuth =
  | { mode: 'local' }
  | { mode: 'user'; user: User; accessToken: string }

function header(req: IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()]
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] || '' : ''
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function allowedEmails(): string[] {
  return (process.env.REVENUE_ALLOWED_EMAILS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function allowedUserIds(): string[] {
  return (process.env.REVENUE_ALLOWED_USER_IDS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function isUserAllowed(user: User): boolean {
  const emails = allowedEmails()
  const ids = allowedUserIds()
  if (!emails.length && !ids.length) {
    // Fail closed in cloud/production; open for local dual-auth testing when unset + local token path.
    return process.env.REVENUE_ALLOW_ANY_AUTH_USER === '1'
  }
  const email = (user.email || '').toLowerCase()
  if (ids.includes(user.id)) return true
  if (email && emails.includes(email)) return true
  return false
}

export async function authenticateRevenueRequest(
  req: IncomingMessage,
  localToken: string,
): Promise<{ ok: true; auth: RevenueAuth } | { ok: false; status: number; error: string }> {
  const local = header(req, 'x-revenue-local-token')
  if (local && safeEqual(local, localToken)) {
    return { ok: true, auth: { mode: 'local' } }
  }

  const authHeader = header(req, 'authorization')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!bearer) {
    return {
      ok: false,
      status: 401,
      error: '로그인이 필요하거나 로컬 커넥터 토큰이 없습니다.',
    }
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url.startsWith('http') || !anon) {
    return {
      ok: false,
      status: 503,
      error: '클라우드 동기화 설정(SUPABASE_URL / ANON KEY)이 없습니다.',
    }
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  })
  const { data, error } = await supabase.auth.getUser(bearer)
  if (error || !data.user) {
    return { ok: false, status: 401, error: '세션이 만료되었습니다. 다시 로그인해 주세요.' }
  }
  if (!isUserAllowed(data.user)) {
    return {
      ok: false,
      status: 403,
      error: '이 계정은 앱 수익 동기화 허용 목록에 없습니다.',
    }
  }
  return { ok: true, auth: { mode: 'user', user: data.user, accessToken: bearer } }
}

export function userSupabase(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
