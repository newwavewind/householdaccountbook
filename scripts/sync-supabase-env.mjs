/**
 * 로컬 Supabase(npx supabase start)가 떠 있을 때 API URL·anon 키를 web/.env.local 에 반영합니다.
 * 사용: Docker Desktop 실행 → 프로젝트 루트에서 npx supabase start → cd web && npm run sync-env:supabase
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, 'web', '.env.local')

process.chdir(root)

let status
try {
  const out = execSync('npx supabase status --output json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  status = JSON.parse(out)
} catch {
  console.error(
    '로컬 Supabase에 연결하지 못했습니다.\n' +
      '1) Docker Desktop 실행\n' +
      '2) 프로젝트 루트에서: npx supabase start\n' +
      '3) 다시: cd web && npm run sync-env:supabase\n' +
      '\n클라우드만 쓸 경우: Supabase 대시보드 → Project Settings → API 에서 URL·anon 키를 web/.env.local 에 직접 넣으세요.',
  )
  process.exit(1)
}

const api = status.API ?? status.api
const url = api?.url
const anon = api?.anon_key ?? api?.anonKey
if (!url || !anon) {
  console.error('supabase status JSON에서 url/anon_key 를 찾지 못했습니다.')
  process.exit(1)
}

function setEnvLine(text, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*\\n?`, 'm')
  if (re.test(text)) return text.replace(re, `${line}\n`)
  return `${text.replace(/\s*$/, '')}\n${line}\n`
}

let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
content = setEnvLine(content, 'VITE_SUPABASE_URL', url)
content = setEnvLine(content, 'VITE_SUPABASE_ANON_KEY', anon)
content = setEnvLine(content, 'VITE_COMMUNITY_BACKEND', 'supabase')

writeFileSync(envPath, content, 'utf8')
console.log('web/.env.local 을 갱신했습니다.')
console.log('VITE_SUPABASE_URL=', url)
console.log('다음: Google 콘솔에 Supabase 콜백 URL 등록 → Supabase Studio에서 Google Provider 설정')
