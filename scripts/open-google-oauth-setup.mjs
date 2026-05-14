/**
 * web/.env.local 의 VITE_SUPABASE_URL 로 Supabase OAuth 콜백 URI를 만들고
 * 클립보드에 복사한 뒤, Google Cloud 사용자 인증 정보 페이지를 브라우저로 엽니다.
 *
 * (Google 콘솔에 URI를 넣는 것은 계정 권한이 필요해 API로 대신할 수 없습니다.)
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const envPath = path.join(repoRoot, 'web', '.env.local')

function readEnvLocal() {
  if (!fs.existsSync(envPath)) {
    console.error('web/.env.local 파일이 없습니다. VITE_SUPABASE_URL 을 넣은 뒤 다시 실행하세요.')
    process.exit(1)
  }
  return fs.readFileSync(envPath, 'utf8')
}

function parseEnv(text) {
  const pick = (key) => {
    const m = text.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return {
    supabaseUrl: pick('VITE_SUPABASE_URL'),
    clientId: pick('GOOGLE_OAUTH_CLIENT_ID'),
  }
}

function supabaseAuthCallback(base) {
  const b = base.replace(/\/$/, '')
  if (!b.startsWith('http')) return null
  return `${b}/auth/v1/callback`
}

function projectNumberFromClientId(clientId) {
  const first = clientId.split('-')[0]
  return /^\d+$/.test(first) ? first : null
}

function copyToClipboard(text) {
  if (process.platform === 'win32') {
    execSync('clip', { input: text, stdio: ['pipe', 'ignore', 'ignore'] })
    return true
  }
  if (process.platform === 'darwin') {
    execSync('pbcopy', { input: text, stdio: ['pipe', 'ignore', 'ignore'] })
    return true
  }
  try {
    execSync('xclip -selection clipboard', {
      input: text,
      stdio: ['pipe', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    execSync(`start "" "${url}"`, { shell: true })
  } else if (process.platform === 'darwin') {
    execSync(`open "${url}"`)
  } else {
    execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
  }
}

const raw = readEnvLocal()
const { supabaseUrl, clientId } = parseEnv(raw)
const callback = supabaseAuthCallback(supabaseUrl)

if (!callback) {
  console.error('VITE_SUPABASE_URL 이 올바르지 않습니다.')
  process.exit(1)
}

const copied = copyToClipboard(callback)
const proj = projectNumberFromClientId(clientId)
const gcpUrl = proj
  ? `https://console.cloud.google.com/apis/credentials?project=${proj}`
  : 'https://console.cloud.google.com/apis/credentials'

console.log('승인된 리디렉션 URI (Supabase 콜백):')
console.log(callback)
console.log('')
if (copied) {
  console.log('→ 위 주소를 클립보드에 복사해 두었습니다.')
} else {
  console.log('→ 이 환경에서는 클립보드 복사를 건너뜁니다. 위 한 줄을 직접 복사하세요.')
}
console.log('')
console.log(
  'Google Cloud에서: 해당 OAuth 2.0 클라이언트(ID가 Supabase에 넣은 것과 동일)를 연 뒤',
)
console.log(
  '「승인된 리디렉션 URI」에 붙여 넣고 저장하세요. 〈 〉나 한글 설명은 URI에 넣지 마세요.',
)
console.log('')

openBrowser(gcpUrl)
console.log('브라우저에서 사용자 인증 정보 페이지를 열었습니다.')
