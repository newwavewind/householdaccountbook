/**
 * Push Apple/Google revenue secrets + Supabase auth settings to Vercel Production.
 *
 *   node scripts/push-revenue-cloud-env.mjs
 *   node scripts/push-revenue-cloud-env.mjs --email you@example.com
 *
 * Reads:
 *   - .env.revenue.local (ASC_*, GOOGLE_PLAY_SA_JSON path, vendor via settings)
 *   - web/.env.local (VITE_SUPABASE_URL / ANON)
 *   - .revenue-cache/settings.json (vendor, bucket, packages)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseDotEnv(raw) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[k] = v
  }
  return out
}

function vercelEnvSet(name, value) {
  execFileSync(
    'vercel',
    ['env', 'add', name, 'production', '--yes', '--force', '--sensitive'],
    { cwd: root, input: value, stdio: ['pipe', 'pipe', 'inherit'] },
  )
  console.log(`  ✓ ${name}`)
}

function argEmail() {
  const i = process.argv.indexOf('--email')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1].trim().toLowerCase()
  return ''
}

const revenue = parseDotEnv(readFileSync(join(root, '.env.revenue.local'), 'utf8'))
const webEnv = existsSync(join(root, 'web/.env.local'))
  ? parseDotEnv(readFileSync(join(root, 'web/.env.local'), 'utf8'))
  : {}
const settings = existsSync(join(root, '.revenue-cache/settings.json'))
  ? JSON.parse(readFileSync(join(root, '.revenue-cache/settings.json'), 'utf8'))
  : {}

const supabaseUrl = webEnv.VITE_SUPABASE_URL || ''
const anon = webEnv.VITE_SUPABASE_ANON_KEY || ''
if (!supabaseUrl.startsWith('http') || !anon) {
  console.error('web/.env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요합니다.')
  process.exit(1)
}

const email = argEmail() || revenue.REVENUE_ALLOWED_EMAILS || ''
if (!email) {
  console.error('허용 이메일이 필요합니다: --email you@example.com 또는 .env.revenue.local 의 REVENUE_ALLOWED_EMAILS')
  process.exit(1)
}

function readPem(pathKey, pemKey) {
  if (revenue[pemKey]?.includes('BEGIN')) return revenue[pemKey].replace(/\\n/g, '\n')
  const p = revenue[pathKey]
  if (!p || !existsSync(p)) throw new Error(`키 파일 없음: ${pathKey}`)
  return readFileSync(p, 'utf8')
}

const salesPem = readPem('ASC_KEY_PATH', 'ASC_KEY_PEM')
const financePem = existsSync(revenue.ASC_FINANCE_KEY_PATH || '')
  ? readFileSync(revenue.ASC_FINANCE_KEY_PATH, 'utf8')
  : salesPem
const appsPem = existsSync(revenue.ASC_APPS_KEY_PATH || '')
  ? readFileSync(revenue.ASC_APPS_KEY_PATH, 'utf8')
  : salesPem
const saJson = revenue.GOOGLE_PLAY_SA_JSON_INLINE?.startsWith('{')
  ? revenue.GOOGLE_PLAY_SA_JSON_INLINE
  : readFileSync(revenue.GOOGLE_PLAY_SA_JSON, 'utf8')

const packages = Array.isArray(settings.packages) ? settings.packages.join(',') : revenue.GOOGLE_PLAY_PACKAGES || ''

console.log('Vercel Production env 업로드 중… (값은 출력하지 않습니다)')
const pairs = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: anon,
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: anon,
  ASC_KEY_ID: revenue.ASC_KEY_ID,
  ASC_ISSUER_ID: revenue.ASC_ISSUER_ID,
  ASC_KEY_PEM: salesPem,
  ASC_FINANCE_KEY_ID: revenue.ASC_FINANCE_KEY_ID || revenue.ASC_KEY_ID,
  ASC_FINANCE_KEY_PEM: financePem,
  ASC_APPS_KEY_ID: revenue.ASC_APPS_KEY_ID || revenue.ASC_KEY_ID,
  ASC_APPS_KEY_PEM: appsPem,
  ASC_VENDOR_NUMBER: settings.vendor || revenue.ASC_VENDOR_NUMBER || '',
  GOOGLE_PLAY_SA_JSON: saJson,
  GOOGLE_PLAY_BUCKET: settings.bucket || revenue.GOOGLE_PLAY_BUCKET || '',
  GOOGLE_PLAY_PACKAGES: packages,
  REVENUE_ALLOWED_EMAILS: email,
  REVENUE_DISABLE_CHROME: '1',
  REVENUE_CLOUD: '1',
  REVENUE_ALLOWED_ORIGINS:
    'https://householdaccountbook.vercel.app,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174',
}

for (const [k, v] of Object.entries(pairs)) {
  if (!v) {
    console.error(`비어 있음: ${k}`)
    process.exit(1)
  }
  vercelEnvSet(k, v)
}
console.log('완료. supabase migration 적용 후 vercel --prod 로 배포하세요.')
console.log('  npx supabase db push   # 또는 SQL 에디터에 migrations/20260929130000_app_revenue_jobs.sql')
