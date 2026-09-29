/** Private desktop connector. Never bind this service to a public interface. */
import express from 'express'
import { config } from 'dotenv'
import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { unzipSync, strFromU8 } from 'fflate'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const startedAt = Date.now()
config({ path: resolve(root, '.env.revenue.local'), override: true, quiet: true } as Parameters<typeof config>[0])
for (const key of [
  'ASC_KEY_PATH',
  'ASC_FINANCE_KEY_PATH',
  'ASC_APPS_KEY_PATH',
  'GOOGLE_PLAY_SA_JSON',
  'ASC_PRIVATE_KEY_PATH',
]) {
  const raw = process.env[key]
  if (raw && raw.length >= 2 && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))) {
    process.env[key] = raw.slice(1, -1)
  }
}
const tokenFile = resolve(root, '.revenue-local-token')
if (!existsSync(tokenFile)) writeFileSync(tokenFile, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' })
const localToken = readFileSync(tokenFile, 'utf8').trim()
const cacheDir = resolve(root, '.revenue-cache')
mkdirSync(cacheDir, { recursive: true, mode: 0o700 })
const configFile = resolve(cacheDir, 'settings.json')
type Settings = { vendor: string; bucket: string; packages: string[] }
function settings(): Settings {
  let saved: Partial<Settings> = {}
  try { saved = JSON.parse(readFileSync(configFile, 'utf8')) } catch { /* first run */ }
  return { vendor: saved.vendor || process.env.ASC_VENDOR_NUMBER || '', bucket: saved.bucket || process.env.GOOGLE_PLAY_BUCKET || '', packages: saved.packages || (process.env.GOOGLE_PLAY_PACKAGES || '').split(',').filter(Boolean) }
}
const keyPath = process.env.ASC_KEY_PATH || ''
const financeKeyPath = process.env.ASC_FINANCE_KEY_PATH || keyPath
const financeKeyId = process.env.ASC_FINANCE_KEY_ID || process.env.ASC_KEY_ID || ''
const appsKeyPath = process.env.ASC_APPS_KEY_PATH || keyPath
const appsKeyId = process.env.ASC_APPS_KEY_ID || process.env.ASC_KEY_ID || ''
const googlePath = process.env.GOOGLE_PLAY_SA_JSON || ''
function connectionStatus() {
  const s = settings()
  const a = [!process.env.ASC_KEY_ID && 'Apple Key ID', !process.env.ASC_ISSUER_ID && 'Apple Issuer ID', !(keyPath && existsSync(keyPath)) && 'Apple API 키 파일'].filter(Boolean) as string[]
  const g = [!(googlePath && existsSync(googlePath)) && 'Google 서비스 계정 파일'].filter(Boolean) as string[]
  return {
    apple: { configured: a.length === 0, reports: a.length === 0 && !!s.vendor, missing: [...a, ...(!s.vendor ? ['Apple 판매자 번호'] : [])] },
    google: { configured: g.length === 0, reports: g.length === 0 && !!s.bucket, missing: [...g, ...(!s.bucket ? ['Google 보고서 버킷 ID'] : [])] },
    settings: s,
    connector: { online: true, uptimeMs: Date.now() - startedAt, port: Number(process.env.REVENUE_PORT) || 4001 },
  }
}
function saveSettings(next: Settings) {
  writeFileSync(configFile, JSON.stringify(next), { mode: 0o600 })
}
/** Play 재무 버킷·패키지, Apple 판매자 번호를 가능한 범위에서 자동 찾는다. */
async function discoverConnections(): Promise<{ vendor: string; bucket: string; packages: string[]; notes: string[] }> {
  const notes: string[] = []
  let vendor = settings().vendor
  let bucket = settings().bucket
  let packages = [...settings().packages]
  if (googlePath && existsSync(googlePath)) {
    try {
      const key = JSON.parse(readFileSync(googlePath, 'utf8')) as { project_id?: string }
      const token = await googleToken([
        'https://www.googleapis.com/auth/devstorage.read_only',
        'https://www.googleapis.com/auth/playdeveloperreporting',
        'https://www.googleapis.com/auth/androidpublisher',
      ])
      if (!bucket && key.project_id) {
        const listed = await (await request(
          `https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(key.project_id)}&maxResults=200`,
          token,
        )).json() as { items?: { name: string }[] }
        const buckets = (listed.items || []).map(i => i.name).filter(n => /^pubsite_prod_(?:rev_)?[a-zA-Z0-9_-]+$/.test(n))
        if (buckets.length === 1) {
          bucket = buckets[0]
          notes.push(`Google 버킷 자동 감지: ${bucket}`)
        } else if (buckets.length > 1) {
          notes.push(`Google 버킷 후보 ${buckets.length}개: ${buckets.join(', ')} · 연결 설정에서 하나 선택해 주세요.`)
        } else {
          notes.push('Google pubsite 버킷을 찾지 못했습니다. Play Console → 수익 보고서의 Cloud Storage 버킷 ID를 입력해 주세요.')
        }
      }
      if (!packages.length) {
        try {
          let pageToken = ''
          const found: string[] = []
          do {
            const page = await (await request(
              `https://playdeveloperreporting.googleapis.com/v1beta1/apps:search?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
              token,
            )).json() as { apps?: { packageName: string }[]; nextPageToken?: string }
            for (const app of page.apps || []) found.push(app.packageName)
            pageToken = page.nextPageToken || ''
          } while (pageToken)
          if (found.length) {
            packages = found
            notes.push(`Google 앱 ${found.length}개 자동 감지`)
          }
        } catch (e) {
          notes.push(`Google 앱 목록 자동 검색 실패: ${message(e)}`)
        }
      }
    } catch (e) {
      notes.push(`Google 자동 감지 실패: ${message(e)}`)
    }
  }
  if (!vendor && keyPath && existsSync(keyPath) && process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID) {
    // ASC API 에는 판매자 번호 목록이 없다. 환경변수만 받고, 없으면 안내한다.
    if (process.env.ASC_VENDOR_NUMBER && /^\d{4,20}$/.test(process.env.ASC_VENDOR_NUMBER)) {
      vendor = process.env.ASC_VENDOR_NUMBER
      notes.push('Apple 판매자 번호를 환경변수에서 읽었습니다.')
    } else {
      notes.push('Apple 판매자 번호는 App Store Connect → 지불 및 재무 보고서 상단에 있습니다. 한 번만 연결 설정에 저장하면 됩니다.')
    }
  }
  if ((vendor && vendor !== settings().vendor) || (bucket && bucket !== settings().bucket) || (packages.length && packages.join() !== settings().packages.join())) {
    saveSettings({ vendor: vendor || settings().vendor, bucket: bucket || settings().bucket, packages: packages.length ? packages : settings().packages })
  }
  return { vendor: settings().vendor, bucket: settings().bucket, packages: settings().packages, notes }
}
class ProviderError extends Error { constructor(public code: number, label: string) { super(`${label} (${code})${code === 403 ? ' · 계정의 보고서 조회 권한을 확인해 주세요.' : code === 401 ? ' · 인증 설정을 확인해 주세요.' : ''}`) } }
async function request(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }, signal: AbortSignal.timeout(25000), redirect: 'error' })
  if (!response.ok) throw new ProviderError(response.status, new URL(url).hostname.includes('apple') ? 'Apple 요청 실패' : 'Google 요청 실패')
  const size = Number(response.headers.get('content-length') || '0')
  if (size > 25 * 1024 * 1024) throw new Error('보고서가 25MB를 초과합니다. 기간을 줄여 주세요.')
  return response
}
function appleToken(id = process.env.ASC_KEY_ID || '', path = keyPath) {
  if (!id || !path || !existsSync(path)) throw new Error('Apple API 키 설정이 없습니다.')
  return jwt.sign({}, readFileSync(path), { algorithm: 'ES256', keyid: id, issuer: process.env.ASC_ISSUER_ID, audience: 'appstoreconnect-v1', expiresIn: '15m' })
}
function appleFinanceToken() {
  return appleToken(financeKeyId, financeKeyPath)
}
async function googleToken(scopes: string[]) {
  const key = JSON.parse(readFileSync(googlePath, 'utf8')) as { client_email: string; private_key: string }
  const assertion = jwt.sign({ scope: scopes.join(' ') }, key.private_key, { algorithm: 'RS256', issuer: key.client_email, audience: 'https://oauth2.googleapis.com/token', expiresIn: '50m' })
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(25000) })
  if (!res.ok) throw new ProviderError(res.status, 'Google 인증 실패')
  return (await res.json() as { access_token: string }).access_token
}
type App = { id: string; name: string; platform: 'apple' | 'google'; bundleId: string; version: string; build: string; status: string; updatedAt: string; source: 'api' }
type Document = { key: string; name: string; text: string; period: string }
type Job = { id: string; state: 'running' | 'done'; progress: string; apps: App[]; documents: Document[]; errors: string[]; completed: string[]; started: number }
const jobs = new Map<string, Job>()
const message = (e: unknown) => e instanceof Error ? (e instanceof ProviderError ? e.message : e.message.includes('timeout') ? '연결 시간이 초과되었습니다. 다시 시도해 주세요.' : '연결에 실패했습니다. 키 파일과 네트워크 설정을 확인해 주세요.') : '연결 실패'
async function appleApps(job: Job, token: string) {
  let url: string | undefined = 'https://api.appstoreconnect.apple.com/v1/apps?limit=200'
  type Resource = { id: string; attributes: Record<string, string> }
  while (url) {
    if (!url.startsWith('https://api.appstoreconnect.apple.com/')) throw new Error('Unexpected pagination host')
    const page = await (await request(url, token)).json() as { data: Resource[]; links?: { next?: string } }
    for (const item of page.data) {
      const app: App = { id: `apple:${item.id}`, name: item.attributes.name, platform: 'apple', bundleId: item.attributes.bundleId, version: '', build: '', status: '상태 조회 중', updatedAt: new Date().toISOString(), source: 'api' }
      const detail = await Promise.allSettled([
        request(`https://api.appstoreconnect.apple.com/v1/apps/${item.id}/appStoreVersions?limit=10&filter[platform]=IOS`, token).then(r => r.json()),
        request(`https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${item.id}&sort=-uploadedDate&limit=1`, token).then(r => r.json()),
      ])
      if (detail[0].status === 'fulfilled') { const versions = detail[0].value.data as Resource[]; versions.sort((a,b) => b.attributes.createdDate.localeCompare(a.attributes.createdDate)); app.version = versions[0]?.attributes.versionString || ''; app.status = versions[0]?.attributes.appStoreState || '버전 없음' }
      else { app.status = '상태 확인 필요'; job.errors.push(`${app.name}: 버전 상태 조회 실패`) }
      if (detail[1].status === 'fulfilled') app.build = detail[1].value.data?.[0]?.attributes.version || ''
      else job.errors.push(`${app.name}: 빌드 조회 실패`)
      job.apps.push(app)
    }
    url = page.links?.next
  }
  job.completed.push('Apple 앱·빌드 목록')
}
async function appleReports(job: Job, token: string, month: string) {
  const vendor = settings().vendor
  if (!vendor) { job.errors.push('Apple 매출: 판매자 번호를 연결 설정에 입력해 주세요.'); return }
  const [year, m] = month.split('-').map(Number)
  const today = new Date().toISOString().slice(0, 10)
  let count = 0, unavailable = 0
  for (let day = 1; day <= new Date(year, m, 0).getDate(); day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    if (date >= today) break
    job.progress = `Apple ${date} 일별 판매 보고서 확인 중`
    const params = new URLSearchParams({ 'filter[frequency]': 'DAILY', 'filter[reportDate]': date, 'filter[reportType]': 'SALES', 'filter[reportSubType]': 'SUMMARY', 'filter[vendorNumber]': vendor, 'filter[version]': '1_0' })
    try {
      const response = await request(`https://api.appstoreconnect.apple.com/v1/salesReports?${params}`, token, { headers: { Accept: 'application/a-gzip' } })
      const bytes = Buffer.from(await response.arrayBuffer())
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: 25 * 1024 * 1024 }).toString('utf8') : bytes.toString('utf8')
      job.documents.push({ key: `apple-sales:${date}`, name: `Apple 판매 ${date}`, text, period: month }); count++
    } catch (e) {
      if (e instanceof ProviderError && e.code === 404) unavailable++
      else if (e instanceof ProviderError && e.code === 403) {
        job.errors.push('Apple 판매: API 키에 「매출 및 보고서」 권한이 없습니다. App Store Connect → 사용자 및 액세스 → 키 권한을 확인해 주세요.')
        break
      } else { job.errors.push(`Apple 판매: ${message(e)}`); break }
    }
  }
  if (count) job.completed.push(`Apple 일별 판매 ${count}개`)
  if (unavailable) job.errors.push(`Apple 일별 보고서 ${unavailable}일 미제공 · 무매출 또는 생성 지연일 수 있습니다.`)
  if (month < today.slice(0, 7)) {
    try {
      const financeToken = financeKeyId && financeKeyPath && existsSync(financeKeyPath) ? appleFinanceToken() : token
      const params = new URLSearchParams({ 'filter[reportDate]': month, 'filter[reportType]': 'FINANCIAL', 'filter[regionCode]': 'ZZ', 'filter[vendorNumber]': vendor })
      const response = await request(`https://api.appstoreconnect.apple.com/v1/financeReports?${params}`, financeToken, { headers: { Accept: 'application/a-gzip' } })
      const bytes = Buffer.from(await response.arrayBuffer())
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: 25 * 1024 * 1024 }).toString('utf8') : bytes.toString('utf8')
      job.documents.push({ key: `apple-finance:${month}`, name: `Apple 확정 재무 ${month} (회계월)`, text, period: month }); job.completed.push('Apple 확정 재무 보고서')
    } catch (e) { job.errors.push(`Apple 확정 재무: ${e instanceof ProviderError && e.code === 404 ? '보고서가 아직 제공되지 않습니다.' : message(e)}`) }
  }
}
async function googleApps(job: Job, token: string) {
  const packages = new Map(settings().packages.map(p => [p, p]))
  try {
    let pageToken = ''
    do {
      const page = await (await request(`https://playdeveloperreporting.googleapis.com/v1beta1/apps:search?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, token)).json() as { apps?: { packageName: string; displayName: string }[]; nextPageToken?: string }
      for (const app of page.apps || []) packages.set(app.packageName, app.displayName)
      pageToken = page.nextPageToken || ''
    } while (pageToken)
  } catch (e) { job.errors.push(`Google 앱 검색: ${message(e)}${packages.size ? ' · 등록된 패키지를 조회합니다.' : ' 연결 설정에 패키지명을 입력할 수 있습니다.'}`) }
  for (const [pkg, name] of packages) {
    if (!/^[A-Za-z0-9_.]+$/.test(pkg)) continue
    // Tracks require a temporary edit. It is discarded and NEVER committed.
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/edits`
    let edit = ''
    const app: App = { id: `google:${pkg}`, name, platform: 'google', bundleId: pkg, version: '', build: '', status: '상태 확인 필요', updatedAt: new Date().toISOString(), source: 'api' }
    try {
      edit = (await (await request(base, token, { method: 'POST', body: '{}' })).json() as { id: string }).id
      const tracks = await (await request(`${base}/${edit}/tracks`, token)).json() as { tracks?: { track: string; releases?: { name?: string; versionCodes?: string[]; status: string }[] }[] }
      const releases = (tracks.tracks || []).flatMap(t => (t.releases || []).map(r => ({ ...r, track: t.track }))).sort((a,b) => Math.max(...(b.versionCodes || ['0']).map(Number)) - Math.max(...(a.versionCodes || ['0']).map(Number)))
      const latest = releases[0]
      if (latest) { app.version = latest.name || ''; app.build = (latest.versionCodes || []).join(', '); app.status = `${latest.track} · ${latest.status}` }
      else app.status = '출시 트랙 없음'
    } catch (e) { job.errors.push(`${name}: ${message(e)}`) }
    finally { if (edit) { try { await request(`${base}/${edit}`, token, { method: 'DELETE' }) } catch { job.errors.push(`${name}: 임시 조회 세션이 자동 만료될 예정입니다.`) } } }
    job.apps.push(app)
  }
  if (packages.size) job.completed.push('Google 앱·출시 트랙 목록')
}
const googleImportDir = resolve(cacheDir, 'imports/google')
function pushGoogleZipDocuments(job: Job, month: string, kind: 'sales' | 'earnings', objectName: string, bytes: Uint8Array) {
  let total = 0
  const files = unzipSync(bytes, { filter: f => { total += f.originalSize; if (total > 25 * 1024 * 1024) throw new Error('Report too large'); return /\.csv$/i.test(f.name) } })
  let count = 0
  for (const [name, contents] of Object.entries(files)) {
    const text = contents[0] === 0xff && contents[1] === 0xfe ? new TextDecoder('utf-16le').decode(contents) : strFromU8(contents)
    job.documents.push({ key: `google:${objectName}:${name}`, name: `Google ${kind === 'sales' ? '예상 매출' : '확정 수익'} ${month}`, text, period: month })
    count++
  }
  return count
}
function loadGoogleLocalReports(job: Job, month: string) {
  mkdirSync(googleImportDir, { recursive: true, mode: 0o700 })
  if (!existsSync(googleImportDir)) return { sales: 0, earnings: 0 }
  const yyyymm = month.replace('-', '')
  let sales = 0, earnings = 0
  for (const file of readdirSync(googleImportDir)) {
    if (!file.endsWith('.zip')) continue
    const isSales = file.startsWith(`salesreport_${yyyymm}`)
    const isEarnings = file.startsWith(`earnings_${yyyymm}`)
    if (!isSales && !isEarnings) continue
    const kind = isSales ? 'sales' as const : 'earnings' as const
    try {
      const bytes = new Uint8Array(readFileSync(join(googleImportDir, file)))
      if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) continue
      const n = pushGoogleZipDocuments(job, month, kind, `local/${file}`, bytes)
      if (kind === 'sales') sales += n
      else earnings += n
    } catch (e) {
      job.errors.push(`Google 로컬 보고서 ${file}: ${message(e)}`)
    }
  }
  if (sales) job.completed.push(`Google 예상 매출 ${sales}개(로컬·Chrome)`)
  if (earnings) job.completed.push(`Google 확정 수익 ${earnings}개(로컬·Chrome)`)
  return { sales, earnings }
}
function refreshGoogleViaChrome(job: Job, month: string): Promise<boolean> {
  const script = resolve(root, 'server/scripts/refreshPlayReports.mjs')
  if (!existsSync(script)) {
    job.errors.push('Google Chrome 동기화 스크립트가 없습니다.')
    return Promise.resolve(false)
  }
  job.progress = `Google ${month} · 로그인된 Chrome으로 보고서 받는 중`
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, month], {
      cwd: root,
      env: { ...process.env, CHROME_CDP_URL: process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      job.errors.push('Google Chrome 동기화: 시간이 초과되었습니다.')
      resolve(false)
    }, 120_000)
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
    child.on('error', (e) => {
      clearTimeout(timer)
      job.errors.push(`Google Chrome 동기화 실패: ${message(e)}`)
      resolve(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const line = stdout.trim().split('\n').filter(Boolean).pop() || ''
      try {
        const parsed = JSON.parse(line) as { ok?: boolean; error?: string; saved?: unknown[] }
        if (!parsed.ok) {
          job.errors.push(`Google Chrome 동기화: ${parsed.error || '실패'}`)
          resolve(false)
          return
        }
        if (Array.isArray(parsed.saved) && parsed.saved.length) {
          job.completed.push(`Google Chrome에서 보고서 ${parsed.saved.length}개 갱신`)
          resolve(true)
          return
        }
        job.errors.push(`Google Chrome 동기화: ${month} 월 보고서를 UI에서 찾지 못했습니다.`)
        resolve(false)
      } catch {
        if (code !== 0) job.errors.push(`Google Chrome 동기화 실패: ${(stderr || stdout || '알 수 없는 오류').slice(0, 240)}`)
        resolve(false)
      }
    })
  })
}
async function googleReports(job: Job, token: string, month: string) {
  const bucket = settings().bucket
  if (!bucket) { job.errors.push('Google 매출: 재무 보고서 버킷 ID를 연결 설정에 입력해 주세요.'); return }
  let gcsDenied = false
  let gcsDocs = 0
  const pendingEmpty: string[] = []
  for (const kind of ['sales', 'earnings'] as const) {
    const prefix = `${kind}/${kind === 'sales' ? 'salesreport' : 'earnings'}_${month.replace('-', '')}`
    let pageToken = '', count = 0
    try {
      do {
        const params = new URLSearchParams({ prefix, ...(pageToken ? { pageToken } : {}) })
        const page = await (await request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${params}`, token)).json() as { items?: { name: string }[]; nextPageToken?: string }
        for (const item of page.items || []) {
          if (!item.name.endsWith('.zip')) continue
          job.progress = `Google ${month} ${kind === 'sales' ? '예상 매출' : '확정 수익'} 확인 중`
          const bytes = new Uint8Array(await (await request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(item.name)}?alt=media`, token)).arrayBuffer())
          count += pushGoogleZipDocuments(job, month, kind, item.name, bytes)
        }
        pageToken = page.nextPageToken || ''
      } while (pageToken)
      if (count) { job.completed.push(`Google ${kind === 'sales' ? '예상 매출' : '확정 수익'} ${count}개`); gcsDocs += count }
      else pendingEmpty.push(`Google ${kind === 'sales' ? '예상 매출' : '확정 수익'} ${month}: 제공된 보고서가 없습니다.`)
    } catch (e) {
      if (e instanceof ProviderError && e.code === 403) gcsDenied = true
      else job.errors.push(`Google ${kind}: ${message(e)}`)
    }
  }
  if (gcsDenied || gcsDocs === 0) {
    if (gcsDenied) job.errors.push('Google GCS 서비스 계정 버킷 ACL이 아직 반영되지 않아 Chrome·로컬 캐시로 받았습니다.')
    await refreshGoogleViaChrome(job, month)
    const local = loadGoogleLocalReports(job, month)
    if (!local.sales && !local.earnings) {
      job.errors.push(...pendingEmpty)
      if (gcsDenied) job.errors.push('Google 매출: Chrome(--remote-debugging-port=9222)에서 Play Console 로그인 후 다시 동기화해 주세요.')
    }
  } else if (pendingEmpty.length) {
    job.errors.push(...pendingEmpty)
  }
}
async function run(job: Job, month: string) {
  const status = connectionStatus()
  const tasks: Promise<unknown>[] = []
  if (status.apple.configured) tasks.push((async () => {
    const salesToken = appleToken()
    const appsToken = (appsKeyId && appsKeyPath && existsSync(appsKeyPath)) ? appleToken(appsKeyId, appsKeyPath) : salesToken
    await Promise.allSettled([
      appleApps(job, appsToken).catch(e => job.errors.push(message(e))),
      appleReports(job, salesToken, month).catch(e => job.errors.push(message(e))),
    ])
  })().catch(e => job.errors.push(message(e))))
  else job.errors.push('Apple API 키 설정이 필요합니다.')
  if (status.google.configured) tasks.push((async () => { const token = await googleToken(['https://www.googleapis.com/auth/androidpublisher', 'https://www.googleapis.com/auth/playdeveloperreporting', 'https://www.googleapis.com/auth/devstorage.read_only']); await Promise.allSettled([googleApps(job, token).catch(e => job.errors.push(message(e))), googleReports(job, token, month).catch(e => job.errors.push(message(e)))]) })().catch(e => job.errors.push(message(e))))
  else job.errors.push('Google 서비스 계정 설정이 필요합니다.')
  await Promise.allSettled(tasks)
  job.state = 'done'; job.progress = job.errors.length ? '확인할 항목이 있습니다.' : '동기화 완료'
}
const app = express()
app.disable('x-powered-by')
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  const origin = req.headers.origin
  const allowed = (process.env.REVENUE_ALLOWED_ORIGINS || 'http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4180,http://localhost:4180').split(',')
  if (origin && !allowed.includes(origin)) return res.status(403).json({ error: '허용되지 않은 요청입니다.' })
  const supplied = Buffer.from(req.get('X-Revenue-Local-Token') || '')
  if (supplied.length !== Buffer.byteLength(localToken) || !timingSafeEqual(supplied, Buffer.from(localToken))) return res.status(401).json({ error: '개인용 연결 서버 인증이 필요합니다.' })
  next()
})
app.use(express.json({ limit: '16kb' }))
app.get('/api/app-revenue/status', (_req, res) => res.json(connectionStatus()))
app.post('/api/app-revenue/discover', async (_req, res) => {
  try {
    const discovered = await discoverConnections()
    res.json({ ...connectionStatus(), discovered })
  } catch (e) {
    res.status(500).json({ error: message(e) })
  }
})
app.put('/api/app-revenue/settings', (req, res) => {
  const { vendor, bucket, packages } = req.body || {}
  if (typeof vendor !== 'string' || (vendor && !/^\d{4,20}$/.test(vendor)) || typeof bucket !== 'string' || (bucket && !/^pubsite_prod_(?:rev_)?[a-zA-Z0-9_-]+$/.test(bucket)) || !Array.isArray(packages) || packages.length > 100 || packages.some(p => typeof p !== 'string' || !/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(p))) return res.status(400).json({ error: '판매자 번호·버킷 ID·패키지명 형식을 확인해 주세요.' })
  saveSettings({ vendor, bucket, packages })
  res.json(connectionStatus())
})
app.post('/api/app-revenue/sync', (req, res) => {
  const month = req.body?.month
  if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || month > new Date().toISOString().slice(0, 7)) return res.status(400).json({ error: '동기화할 월을 확인해 주세요.' })
  for (const [id, job] of jobs) if (Date.now() - job.started > 30 * 60 * 1000) jobs.delete(id)
  const active = [...jobs.values()].find(j => j.state === 'running')
  if (active) return res.status(409).json({ error: '이미 동기화 중입니다. 완료 후 다시 시도해 주세요.' })
  const job: Job = { id: randomUUID(), state: 'running', progress: '스토어에 연결 중', apps: [], documents: [], errors: [], completed: [], started: Date.now() }
  jobs.set(job.id, job)
  void (async () => {
    try {
      const s = settings()
      if (!s.vendor || !s.bucket || !s.packages.length) {
        job.progress = '연결 정보 자동 감지 중…'
        try {
          const discovered = await discoverConnections()
          job.errors.push(...discovered.notes.filter(n => /실패|찾지|입력|후보|판매자/.test(n)))
        } catch (e) {
          job.errors.push(message(e))
        }
      }
      await run(job, month)
    } catch (e) {
      job.errors.push(message(e))
      job.state = 'done'
      job.progress = '확인할 항목이 있습니다.'
    }
  })()
  res.json({ id: job.id })
})
app.get('/api/app-revenue/sync/:id', (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job) return res.status(404).json({ error: '동기화 기록이 만료되었습니다.' })
  res.json(job.state === 'running' ? { ...job, documents: [], apps: [] } : job)
})
app.listen(Number(process.env.REVENUE_PORT) || 4001, '127.0.0.1', () => console.log('Private revenue connector ready on 127.0.0.1:4001'))
