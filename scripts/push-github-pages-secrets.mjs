/**
 * web/.env.local 에서 Pages 빌드용 값을 읽어 GitHub Actions Repository secrets 로 올립니다.
 * 사전: GitHub CLI 설치 후 `gh auth login` (repo 권한)
 *
 *   node scripts/push-github-pages-secrets.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, 'web', '.env.local')

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
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function ghSecretSet(name, body) {
  execFileSync('gh', ['secret', 'set', name, '-b', body], {
    stdio: ['ignore', 'inherit', 'inherit'],
    cwd: root,
  })
}

try {
  execFileSync('gh', ['--version'], { stdio: 'pipe', cwd: root })
} catch {
  console.error(
    'GitHub CLI(gh)가 없거나 PATH 에 없습니다. https://cli.github.com/ 에서 설치한 뒤 `gh auth login` 하세요.',
  )
  process.exit(1)
}

if (!existsSync(envPath)) {
  console.error(`파일이 없습니다: ${envPath}`)
  process.exit(1)
}

const env = parseDotEnv(readFileSync(envPath, 'utf8'))

const url = env.VITE_SUPABASE_URL?.trim()
const anon = env.VITE_SUPABASE_ANON_KEY?.trim()
const google =
  env.VITE_GOOGLE_CLIENT_ID?.trim() || ''

if (!url?.startsWith('http')) {
  console.error('web/.env.local 에 VITE_SUPABASE_URL=https://... 형태가 필요합니다.')
  process.exit(1)
}
if (!anon) {
  console.error('web/.env.local 에 VITE_SUPABASE_ANON_KEY 가 필요합니다.')
  process.exit(1)
}

console.log('Repository secrets 업로드 중… (값은 출력하지 않습니다)')
ghSecretSet('VITE_SUPABASE_URL', url)
ghSecretSet('VITE_SUPABASE_ANON_KEY', anon)
if (google) {
  ghSecretSet('VITE_GOOGLE_CLIENT_ID', google)
  console.log('  + VITE_GOOGLE_CLIENT_ID')
} else {
  console.log('  (건너뜀) VITE_GOOGLE_CLIENT_ID 없음 — GIS 팝업만 쓰면 Supabase 리다이렉트만으로도 로그인 가능')
}

console.log('완료. 이제 main 에 푸시하면 Actions 가 Supabase 환경으로 빌드합니다.')
