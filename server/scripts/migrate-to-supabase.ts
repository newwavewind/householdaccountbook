/**
 * 로컬 Prisma(SQLite) → Supabase(Postgres) 데이터 이전
 * - household_ledgers: PostgREST upsert (anon RLS 허용 정책)
 * - profiles / posts: auth.users FK로 자동 삽입 불가 → migration-export/*.json 백업만
 * 사용: cd server && npx tsx scripts/migrate-to-supabase.ts
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

const repoRoot = join(__dirname, '..', '..')
const envLocal = join(repoRoot, 'web', '.env.local')

function parseEnvLocal(): { supabaseUrl: string; supabaseAnon: string } {
  if (!existsSync(envLocal)) {
    throw new Error('web/.env.local 파일이 없습니다.')
  }
  const text = readFileSync(envLocal, 'utf8')
  let supabaseUrl = ''
  let supabaseAnon = ''
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith('#') || !t) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim()
    if (key === 'VITE_SUPABASE_URL') supabaseUrl = val
    if (key === 'VITE_SUPABASE_ANON_KEY') supabaseAnon = val
  }
  if (!supabaseUrl?.startsWith('http') || !supabaseAnon) {
    throw new Error('web/.env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요합니다.')
  }
  return { supabaseUrl, supabaseAnon }
}

async function upsertLedger(
  url: string,
  anon: string,
  row: { id: string; payload: unknown; updatedAt: Date },
) {
  const base = url.replace(/\/$/, '')
  const endpoint = `${base}/rest/v1/household_ledgers?on_conflict=id`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: row.id,
      payload: row.payload,
      updated_at: row.updatedAt.toISOString(),
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`household_ledgers upsert 실패 (${res.status}): ${err}`)
  }
}

function setEnvLocalLedgerBackendSupabase() {
  let text = readFileSync(envLocal, 'utf8')
  if (/^VITE_LEDGER_BACKEND=/m.test(text)) {
    text = text.replace(/^VITE_LEDGER_BACKEND=.*$/m, 'VITE_LEDGER_BACKEND=supabase')
  } else {
    text = `${text.replace(/\s*$/, '\n')}VITE_LEDGER_BACKEND=supabase\n`
  }
  writeFileSync(envLocal, text, 'utf8')
}

const prisma = new PrismaClient()

async function main() {
  const { supabaseUrl, supabaseAnon } = parseEnvLocal()

  const ledgers = await prisma.householdLedger.findMany()
  console.log(`household_ledgers ${ledgers.length}행 → Supabase 업로드…`)
  for (const r of ledgers) {
    await upsertLedger(supabaseUrl, supabaseAnon, r)
    console.log(`  ✓ ${r.id}`)
  }
  if (ledgers.length === 0) {
    console.log('(로컬에 household_ledgers 행이 없습니다. 빈 장부로 Supabase만 사용합니다.)')
  }

  const posts = await prisma.post.findMany()
  const profiles = await prisma.profile.findMany()
  if (posts.length > 0 || profiles.length > 0) {
    const backupDir = join(repoRoot, 'migration-export')
    mkdirSync(backupDir, { recursive: true })
    writeFileSync(
      join(backupDir, 'profiles.json'),
      JSON.stringify(profiles, null, 2),
      'utf8',
    )
    writeFileSync(
      join(backupDir, 'posts.json'),
      JSON.stringify(posts, null, 2),
      'utf8',
    )
    console.log(
      `\n커뮤니티(프로필/글)는 Supabase의 profiles → auth.users FK 때문에 자동 이전하지 않았습니다.`,
    )
    console.log(`백업: ${backupDir}/profiles.json, posts.json`)
  }

  setEnvLocalLedgerBackendSupabase()
  console.log('\nweb/.env.local → VITE_LEDGER_BACKEND=supabase 적용됨.')
  console.log('Vite 개발 서버를 재시작하세요. 로컬 API(server)는 장부에 더 이상 필요 없습니다.')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
