/**
 * 공지 가이드 글을 Supabase posts에 삽입합니다.
 * web/.env.local 의 SUPABASE_SERVICE_ROLE_KEY 또는 VITE_SUPABASE_* + service role 필요.
 * service role 없으면: node scripts/publish-community-guide-notice.mjs --print-sql
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const envPath = path.join(root, 'web', '.env.local')

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return {}
  const out = {}
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const env = { ...process.env, ...loadEnvFile(envPath) }
const printSql = process.argv.includes('--print-sql')

const AUTHOR_ID = 'cf985c51-f258-494f-8a29-8cdcd490ebd6'
const AUTHOR_NAME = '김상현'
const TITLE = '[공지] 우리 가계부·다이어리 — 전체 기능 사용 설명서'

const body = fs.readFileSync(
  path.join(__dirname, 'community-guide-notice-body.html'),
  'utf8',
)

function sqlLiteral(tag, text) {
  return `$${tag}$${text}$${tag}$`
}

const sql = `INSERT INTO public.posts (
  author_id,
  author_display_name,
  title,
  body,
  hidden,
  visibility,
  is_notice
) VALUES (
  '${AUTHOR_ID}',
  ${sqlLiteral('name', AUTHOR_NAME)},
  ${sqlLiteral('title', TITLE)},
  ${sqlLiteral('body', body)},
  false,
  'public',
  true
)
RETURNING id, title, is_notice, created_at;`

if (printSql) {
  const outPath = path.join(__dirname, '_guide-insert.sql')
  fs.writeFileSync(outPath, sql, 'utf8')
  console.log('Wrote', outPath)
  process.exit(0)
}

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const serviceKey =
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY

if (!url || !serviceKey) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY 와 URL이 필요합니다. --print-sql 로 SQL만 출력할 수 있습니다.',
  )
  process.exit(1)
}

const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
}).catch(() => null)

if (!res?.ok) {
  const insertRes = await fetch(`${url.replace(/\/$/, '')}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      author_id: AUTHOR_ID,
      author_display_name: AUTHOR_NAME,
      title: TITLE,
      body,
      hidden: false,
      visibility: 'public',
      is_notice: true,
    }),
  })
  const text = await insertRes.text()
  if (!insertRes.ok) {
    console.error('Insert failed:', insertRes.status, text)
    process.exit(1)
  }
  console.log('Posted:', text)
  process.exit(0)
}

console.log(await res.text())
