/** Private desktop connector. Never bind this service to a public interface. */
import express from 'express'
import { config } from 'dotenv'
import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { authenticateRevenueRequest, type RevenueAuth } from './revenue/auth.js'
import { getJobStore, persistJobProgress, type RevenueJob } from './revenue/jobs.js'
import { envPem, googleServiceAccount, isCloudRuntime } from './revenue/credentials.js'
import { appleMonthlyRetentionFrom, collectApplePeriods, currentMonth, partitionMissingReportMonths, syncMonths } from './revenue/reportPolicy.js'
import { collectGoogleReports, pushGoogleZipDocuments } from './revenue/googleReports.js'
import { enrichGoogleOrderProceeds } from './revenue/googleOrders.js'
import { downloadAppleFinanceReport, downloadAppleSalesReport } from './revenue/appleReports.js'

function rebuildGoogleReportBundleFromCache(): { files: number; sales: number; earnings: number } {
  mkdirSync(googleImportDir, { recursive: true, mode: 0o700 })
  const bundle: Record<string, string> = {}
  let sales = 0
  let earnings = 0
  for (const name of readdirSync(googleImportDir)) {
    if (!name.endsWith('.zip')) continue
    const buf = readFileSync(join(googleImportDir, name))
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) continue
    bundle[name] = buf.toString('base64')
    if (/sales/i.test(name)) sales++
    else if (/earning/i.test(name)) earnings++
  }
  const json = JSON.stringify(bundle)
  for (const p of [
    resolve(root, '.revenue-cache/google-report-bundle.json'),
    resolve(root, 'server/data/google-report-bundle.json'),
  ]) {
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, json, { mode: 0o600 })
  }
  return { files: Object.keys(bundle).length, sales, earnings }
}

function runNodeScript(scriptPath: string): Promise<{ ok: boolean; saved?: number; error?: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: root,
      env: { ...process.env, CHROME_CDP_URL: process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout?.on('data', (c) => { out += String(c) })
    child.stderr?.on('data', (c) => { err += String(c) })
    child.on('error', reject)
    child.on('close', (code) => {
      const line = out.trim().split('\n').filter(Boolean).pop() || ''
      try {
        const parsed = JSON.parse(line) as { ok: boolean; saved?: number; error?: string }
        if (code === 0 && parsed.ok) resolvePromise(parsed)
        else reject(new Error(parsed.error || err.trim() || `스크립트 종료 코드 ${code}`))
      } catch {
        reject(new Error(err.trim() || out.trim() || `스크립트 종료 코드 ${code}`))
      }
    })
  })
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
// src/ → repo root is ../.. ; dist/ → repo root is ../..
const root = resolve(moduleDir, '../..')
const startedAt = Date.now()
const cloudFs = Boolean(process.env.VERCEL || process.env.REVENUE_CLOUD === '1')
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
const tokenFile = cloudFs ? '/tmp/revenue-local-token' : resolve(root, '.revenue-local-token')
if (!existsSync(tokenFile)) writeFileSync(tokenFile, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' })
const localToken = readFileSync(tokenFile, 'utf8').trim()
const cacheDir = cloudFs ? '/tmp/revenue-cache' : resolve(root, '.revenue-cache')
mkdirSync(cacheDir, { recursive: true, mode: 0o700 })
const configFile = resolve(cacheDir, 'settings.json')
type Settings = { vendor: string; bucket: string; packages: string[] }
function settings(): Settings {
  let saved: Partial<Settings> = {}
  try { saved = JSON.parse(readFileSync(configFile, 'utf8')) } catch { /* first run */ }
  return { vendor: saved.vendor || process.env.ASC_VENDOR_NUMBER || '', bucket: saved.bucket || process.env.GOOGLE_PLAY_BUCKET || '', packages: saved.packages || (process.env.GOOGLE_PLAY_PACKAGES || '').split(',').filter(Boolean) }
}
const salesKeyPem = () => envPem('ASC_KEY_PEM', 'ASC_KEY_PATH')
const financeKeyPem = () => envPem('ASC_FINANCE_KEY_PEM', 'ASC_FINANCE_KEY_PATH') || salesKeyPem()
const appsKeyPem = () => envPem('ASC_APPS_KEY_PEM', 'ASC_APPS_KEY_PATH') || salesKeyPem()
const financeKeyId = process.env.ASC_FINANCE_KEY_ID || process.env.ASC_KEY_ID || ''
const appsKeyId = process.env.ASC_APPS_KEY_ID || process.env.ASC_KEY_ID || ''
const googleSa = () => googleServiceAccount()
function connectionStatus() {
  const s = settings()
  const a = [!process.env.ASC_KEY_ID && 'Apple Key ID', !process.env.ASC_ISSUER_ID && 'Apple Issuer ID', !salesKeyPem() && 'Apple API 키'].filter(Boolean) as string[]
  const g = [!googleSa() && 'Google 서비스 계정'].filter(Boolean) as string[]
  return {
    apple: { configured: a.length === 0, reports: a.length === 0 && !!s.vendor, missing: [...a, ...(!s.vendor ? ['Apple 판매자 번호'] : [])] },
    google: { configured: g.length === 0, reports: g.length === 0 && !!s.bucket, missing: [...g, ...(!s.bucket ? ['Google 보고서 버킷 ID'] : [])] },
    settings: s,
    connector: { online: true, uptimeMs: Date.now() - startedAt, port: Number(process.env.REVENUE_PORT) || 4001, apiVersion: 2, syncScopes: ['month', 'range', 'all'], currentMonth: currentMonth(), historyFrom: historyFromMonth() },
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
  if (googleSa()) {
    try {
      const key = googleSa() as { project_id?: string; client_email: string; private_key: string }
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
  if (!vendor && salesKeyPem() && process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID) {
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
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }, signal: init.signal ?? AbortSignal.timeout(25000), redirect: 'error' })
  if (!response.ok) throw new ProviderError(response.status, new URL(url).hostname.includes('apple') ? 'Apple 요청 실패' : 'Google 요청 실패')
  const size = Number(response.headers.get('content-length') || '0')
  if (size > 25 * 1024 * 1024) throw new Error('보고서가 25MB를 초과합니다. 기간을 줄여 주세요.')
  return response
}
function appleToken(id = process.env.ASC_KEY_ID || '', pem = salesKeyPem()) {
  if (!id || !pem) throw new Error('Apple API 키 설정이 없습니다.')
  return jwt.sign({}, pem, { algorithm: 'ES256', keyid: id, issuer: process.env.ASC_ISSUER_ID, audience: 'appstoreconnect-v1', expiresIn: '15m' })
}
function appleFinanceToken() {
  return appleToken(financeKeyId, financeKeyPem())
}
async function googleToken(scopes: string[]) {
  const key = googleSa()
  if (!key) throw new Error('Google 서비스 계정 설정이 없습니다.')
  const assertion = jwt.sign({ scope: scopes.join(' ') }, key.private_key, { algorithm: 'RS256', issuer: key.client_email, audience: 'https://oauth2.googleapis.com/token', expiresIn: '50m' })
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(25000) })
  if (!res.ok) throw new ProviderError(res.status, 'Google 인증 실패')
  return (await res.json() as { access_token: string }).access_token
}
type App = RevenueJob['apps'][number]
type Document = RevenueJob['documents'][number]
type Job = RevenueJob
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

function historyFromMonth(): string {
  const raw = (process.env.REVENUE_HISTORY_FROM || '2020-01').trim()
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : '2020-01'
}
function monthFromYyyymm(yyyymm: string): string | null {
  const m = /^(\d{4})(\d{2})$/.exec(yyyymm)
  if (!m) return null
  const month = `${m[1]}-${m[2]}`
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ? month : null
}

async function appleMonthlySales(job: Job, token: string, vendor: string, month: string) {
  job.progress = `Apple ${month} 월별 판매 보고서 확인 중`
  const text = await downloadAppleSalesReport({
    frequency: 'MONTHLY', date: month, vendor,
    request: url => request(url, token, { headers: { Accept: 'application/a-gzip' } }),
  })
  job.documents.push({ key: `apple-sales-month:${month}`, name: `Apple 월별 판매 ${month}`, text, period: month, source: 'api', fetchedAt: new Date().toISOString(), periodKind: 'calendar' })
}

async function appleDailySales(job: Job, token: string, vendor: string, month: string) {
  const [year, m] = month.split('-').map(Number)
  const today = new Date().toISOString().slice(0, 10)
  let count = 0, unavailable = 0
  for (let day = 1; day <= new Date(year, m, 0).getDate(); day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    if (date >= today) break
    job.progress = `Apple ${date} 일별 판매 보고서 확인 중`
    try {
      const text = await downloadAppleSalesReport({
        frequency: 'DAILY', date, vendor,
        request: url => request(url, token, { headers: { Accept: 'application/a-gzip' } }),
      })
      job.documents.push({ key: `apple-sales:${date}`, name: `Apple 판매 ${date}`, text, period: month, source: 'api', fetchedAt: new Date().toISOString(), periodKind: 'calendar' }); count++
    } catch (e) {
      if (e instanceof ProviderError && e.code === 404) unavailable++
      else if (e instanceof ProviderError && e.code === 403) {
        job.errors.push('Apple 판매: API 키에 「매출 및 보고서」 권한이 없습니다. App Store Connect → 사용자 및 액세스 → 키 권한을 확인해 주세요.')
        return { count, unavailable, fatal: true as const }
      } else { job.errors.push(`Apple 판매: ${message(e)}`); return { count, unavailable, fatal: true as const } }
    }
  }
  return { count, unavailable, fatal: false as const }
}

async function appleFinanceMonth(job: Job, token: string, vendor: string, month: string) {
  const financeToken = financeKeyId && financeKeyPem() ? appleFinanceToken() : token
  job.progress = `Apple ${month} 확정 재무 보고서 확인 중`
  const text = await downloadAppleFinanceReport({
    calendarMonth: month, vendor,
    request: url => request(url, financeToken, { headers: { Accept: 'application/a-gzip' } }),
  })
  job.documents.push({ key: `apple-finance:${month}`, name: `Apple 확정 재무 ${month} (Apple 회계기간)`, text, period: month, source: 'api', fetchedAt: new Date().toISOString(), periodKind: 'fiscal' })
}

async function appleReports(job: Job, token: string, months: string[]) {
  const vendor = settings().vendor
  if (!vendor) { job.errors.push('Apple 매출: 판매자 번호를 연결 설정에 입력해 주세요.'); return }
  const todayMonth = currentMonth()
  let monthlyOk = 0, financeOk = 0, expiredSales = 0
  const monthlyMiss: string[] = [], financeMiss: string[] = []
  await collectApplePeriods({
    months, todayMonth, oldestSalesMonth: appleMonthlyRetentionFrom(todayMonth),
    skippedSales: () => { expiredSales++ },
    monthly: async month => { await appleMonthlySales(job, token, vendor, month); monthlyOk++ },
    finance: async month => { await appleFinanceMonth(job, token, vendor, month); financeOk++ },
    daily: async month => {
      const daily = await appleDailySales(job, token, vendor, month)
      if (daily.count) job.completed.push(`Apple 일별 판매(당월) ${daily.count}개`)
      if (daily.unavailable) job.errors.push(`Apple 일별 보고서 ${daily.unavailable}일 미제공 · 무매출 또는 생성 지연일 수 있으며 0원으로 확정하지 않습니다.`)
    },
    failed: (kind, month, error) => {
      if (error instanceof ProviderError && error.code === 404) {
        if (kind === 'sales') monthlyMiss.push(month)
        else financeMiss.push(month)
      } else job.errors.push(`Apple ${kind === 'sales' ? '월별 판매' : '확정 재무'} ${month}: ${message(error)}`)
    },
    denied: error => error instanceof ProviderError && (error.code === 401 || error.code === 403),
  })
  if (expiredSales) job.completed.push(`안내 · Apple 오래된 월별 판매 ${expiredSales}개월은 1년 보존기간을 지나 API 재조회에서 제외했습니다. 기존 저장 자료는 유지하며 보관한 보고서를 가져올 수 있습니다.`)
  if (monthlyOk) job.completed.push(`Apple 월별 판매 ${monthlyOk}개월`)
  if (financeOk) job.completed.push(`Apple 확정 재무 ${financeOk}개월(Apple 회계월)`)
  for (const [prefix, title, missing] of [
    ['apple-sales', '월별 판매', monthlyMiss],
    ['apple-finance:', '확정 재무', financeMiss],
  ] as const) {
    const observed = job.documents.filter(document => document.key.startsWith(prefix)).map(document => document.period)
    const { beforeFirst, gaps } = partitionMissingReportMonths(missing, observed)
    if (beforeFirst.length) job.completed.push(`안내 · Apple ${title} ${beforeFirst[0]}~${beforeFirst[beforeFirst.length - 1]} 보고서는 확인되지 않았습니다. 최초 확인 기간 이전 자료를 0원으로 확정하지 않습니다.`)
    if (gaps.length) job.errors.push(`Apple ${title} ${gaps.length}개월 미제공 (${gaps.slice(0, 4).join(', ')}${gaps.length > 4 ? ' 외' : ''}) · 생성 지연·무매출 여부를 확인해 주세요. 0원으로 확정하지 않습니다.`)
  }

}
const GOOGLE_PACKAGE_LABELS: Record<string, string> = {
  'com.sanghyun.civillaw': '봄기출 공인중개사',
  'com.sanghyun.english': '봄기출 공무원영어',
  'com.sanghyun.gugeo': '봄기출 공무원국어',
  'com.sanghyun.publicofficial': '봄기출 공무원',
  'com.sanghyun.police': '봄기출 경찰공무원',
  'com.sanghyun.firefighter': '봄기출 소방공무원',
  'com.sanghyun.housing': '봄기출 주택관리사',
  'com.sanghyun.socialworker': '봄기출 사회복지사1급',
  'com.sanghyun.haengjung': '봄기출 행정사',
  'com.sanghyun.semusa': '봄기출 세무사',
  'com.sanghyun.nomusa': '봄기출 공인노무사',
  'com.sanghyun.sonhae': '봄기출 손해평가사',
  'com.sanghyun.tax': '봄기출 세무',
}
async function googleApps(job: Job, token: string) {
  const packages = new Map(settings().packages.map(p => [p, GOOGLE_PACKAGE_LABELS[p] || p]))
  try {
    let pageToken = ''
    do {
      const page = await (await request(`https://playdeveloperreporting.googleapis.com/v1beta1/apps:search?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, token)).json() as { apps?: { packageName: string; displayName: string }[]; nextPageToken?: string }
      for (const app of page.apps || []) packages.set(app.packageName, (app.displayName && app.displayName !== app.packageName ? app.displayName : GOOGLE_PACKAGE_LABELS[app.packageName]) || app.displayName || GOOGLE_PACKAGE_LABELS[app.packageName] || app.packageName)
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
function loadGoogleBundledReports(job: Job, months: string[]) {
  const candidates = [
    (process.env.GOOGLE_PLAY_REPORT_BUNDLE || '').trim(),
    resolve(root, '.revenue-cache/google-report-bundle.json'),
    resolve(root, 'server/data/google-report-bundle.json'),
    resolve(moduleDir, '../data/google-report-bundle.json'),
  ].filter(Boolean)
  let bundle: Record<string, string> | null = null
  for (const raw of candidates) {
    try {
      const text = raw.startsWith('{') ? raw : existsSync(raw) ? readFileSync(raw, 'utf8') : ''
      if (!text) continue
      const parsed = JSON.parse(text) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
      const entries = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      bundle = { ...entries, ...(bundle || {}) }
    } catch {
      // One corrupt or incomplete bundle must not hide other available reports.
    }
  }
  if (!bundle || !Object.keys(bundle).length) return { sales: 0, earnings: 0 }
  const wanted = new Set(months.map((m) => m.replace('-', '')))
  let sales = 0, earnings = 0
  for (const [file, b64] of Object.entries(bundle)) {
    const match = /^(salesreport|earnings)_(\d{6})/.exec(file)
    if (!match) continue
    if (wanted.size && !wanted.has(match[2])) continue
    const month = monthFromYyyymm(match[2])
    if (!month) continue
    try {
      const bytes = new Uint8Array(Buffer.from(b64, 'base64'))
      if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) continue
      const kind = match[1] === 'salesreport' ? 'sales' as const : 'earnings' as const
      const n = pushGoogleZipDocuments(job, month, kind, `bundle/${file}`, bytes, 'cache')
      if (kind === 'sales') sales += n
      else earnings += n
    } catch (e) {
      job.errors.push(`Google 번들 ${file}: ${message(e)}`)
    }
  }
  if (sales) job.completed.push(`Google 예상 매출 ${sales}개(캐시 번들)`)
  if (earnings) job.completed.push(`Google 확정 수익 ${earnings}개(캐시 번들)`)
  return { sales, earnings }
}

function loadGoogleLocalReports(job: Job, months: string[]) {
  mkdirSync(googleImportDir, { recursive: true, mode: 0o700 })
  if (!existsSync(googleImportDir)) return { sales: 0, earnings: 0 }
  const wanted = new Set(months.map((m) => m.replace('-', '')))
  let sales = 0, earnings = 0
  for (const file of readdirSync(googleImportDir)) {
    if (!file.endsWith('.zip')) continue
    const match = /^(salesreport|earnings)_(\d{6})/.exec(file)
    if (!match) continue
    if (wanted.size && !wanted.has(match[2])) continue
    const month = monthFromYyyymm(match[2])
    if (!month) continue
    const kind = match[1] === 'salesreport' ? 'sales' as const : 'earnings' as const
    try {
      const bytes = new Uint8Array(readFileSync(join(googleImportDir, file)))
      if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) continue
      const n = pushGoogleZipDocuments(job, month, kind, `local/${file}`, bytes, 'cache')
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
async function googleReports(job: Job, token: string, months: string[]) {
  await collectGoogleReports({
    job, months, bucket: settings().bucket,
    request: url => request(url, token),
    loadCaches: () => { loadGoogleLocalReports(job, months); loadGoogleBundledReports(job, months) },
    errorMessage: message,
  })
  await enrichGoogleOrderProceeds({ job, month: new Date().toISOString().slice(0, 7), request: (url, signal) => request(url, token, { signal }) })
}
async function run(job: Job, months: string[]) {
  const status = connectionStatus()
  const tasks: Promise<unknown>[] = []
  job.progress = `전체 ${months.length}개월(${months[0]}~${months[months.length - 1]}) 동기화 중`
  if (status.apple.configured) tasks.push((async () => {
    const salesToken = appleToken()
    const appsToken = (appsKeyId && appsKeyPem()) ? appleToken(appsKeyId, appsKeyPem()) : salesToken
    await Promise.allSettled([
      appleApps(job, appsToken).catch(e => job.errors.push(message(e))),
      appleReports(job, salesToken, months).catch(e => job.errors.push(message(e))),
    ])
  })().catch(e => job.errors.push(message(e))))
  else job.errors.push('Apple API 키 설정이 필요합니다.')
  if (status.google.configured) tasks.push((async () => {
    const token = await googleToken(['https://www.googleapis.com/auth/androidpublisher', 'https://www.googleapis.com/auth/playdeveloperreporting', 'https://www.googleapis.com/auth/devstorage.read_only'])
    await Promise.allSettled([
      googleApps(job, token).catch(e => job.errors.push(message(e))),
      googleReports(job, token, months).catch(e => job.errors.push(message(e))),
    ])
  })().catch(e => job.errors.push(message(e))))
  else job.errors.push('Google 서비스 계정 설정이 필요합니다.')
  await Promise.allSettled(tasks)
  job.state = 'done'
  const live = job.documents.filter(document => document.source !== 'cache').length
  const cached = job.documents.filter(document => document.source === 'cache').length
  job.progress = `${months[0]}~${months[months.length - 1]} (${months.length}개월) · 스토어 보고서 ${live}개${cached ? ` · 저장본 ${cached}개` : ''}${job.errors.length ? ` · 확인할 항목 ${job.errors.length}개` : ' · 동기화 완료'}`
}
const app = express()
app.disable('x-powered-by')
app.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  const origin = req.headers.origin
  const allowed = (process.env.REVENUE_ALLOWED_ORIGINS || 'http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4180,http://localhost:4180,https://householdaccountbook.vercel.app,https://newwavewind.github.io').split(',').map(s => s.trim()).filter(Boolean)
  const originAllowed = !origin || allowed.includes('*') || allowed.includes(origin) || /\.vercel\.app$/i.test(origin || '')
  if (origin && originAllowed) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Revenue-Local-Token')
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
    res.set('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    if (!originAllowed) return res.status(403).json({ error: '허용되지 않은 요청입니다.' })
    return res.status(204).end()
  }
  if (origin && !originAllowed) {
    return res.status(403).json({ error: '허용되지 않은 요청입니다.' })
  }
  const authResult = await authenticateRevenueRequest(req, localToken)
  if (!authResult.ok) return res.status(authResult.status).json({ error: authResult.error })
  ;(req as express.Request & { revenueAuth?: RevenueAuth }).revenueAuth = authResult.auth
  next()
})
app.use(express.json({ limit: '16kb' }))
function reqAuth(req: express.Request): RevenueAuth {
  return (req as express.Request & { revenueAuth: RevenueAuth }).revenueAuth
}
app.get('/api/app-revenue/status', (_req, res) => res.json(connectionStatus()))
app.post('/api/app-revenue/discover', async (req, res) => {
  try {
    const discovered = await discoverConnections()
    res.json({ ...connectionStatus(), discovered })
  } catch (e) {
    res.status(500).json({ error: message(e) })
  }
})
app.put('/api/app-revenue/settings', (req, res) => {
  const { vendor, bucket, packages } = req.body || {}
  if (typeof vendor !== 'string' || (vendor && !/^\d{4,20}$/.test(vendor)) || typeof bucket !== 'string' || (bucket && !/^pubsite_prod_(?:rev_)?[a-zA-Z0-9_-]+$/.test(bucket)) || !Array.isArray(packages) || packages.length > 100 || packages.some((p: unknown) => typeof p !== 'string' || !/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(p as string))) return res.status(400).json({ error: '판매자 번호·버킷 ID·패키지명 형식을 확인해 주세요.' })
  saveSettings({ vendor, bucket, packages })
  res.json(connectionStatus())
})
app.post('/api/app-revenue/sync', async (req, res) => {
  const todayMonth = currentMonth()
  let months: string[]
  try {
    months = syncMonths(req.body, todayMonth, historyFromMonth())
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : '동기화할 기간을 확인해 주세요.' })
  }
  const auth = reqAuth(req)
  const store = getJobStore()
  const active = await store.findRunning(auth)
  // Reattach after a reload/HMR instead of rejecting the caller or starting duplicate work.
  if (active) return res.json({ id: active.id, reused: true })
  const job: Job = {
    id: randomUUID(),
    state: 'running',
    progress: months.length > 1
      ? `전체 ${months.length}개월(${months[0]}~${months[months.length - 1]}) 연결 중`
      : '스토어에 연결 중',
    apps: [],
    documents: [],
    errors: [],
    completed: [],
    started: Date.now(),
    userId: auth.mode === 'user' ? auth.user.id : undefined,
  }
  await store.set(job, auth)
  const work = (async () => {
    try {
      const s = settings()
      if (!s.vendor || !s.bucket || !s.packages.length) {
        job.progress = '연결 정보 자동 감지 중…'
        await persistJobProgress(job, auth)
        try {
          const discovered = await discoverConnections()
          job.errors.push(...discovered.notes.filter(n => /실패|찾지|입력|후보|판매자/.test(n)))
        } catch (e) {
          job.errors.push(message(e))
        }
      }
      const progressTimer = setInterval(() => { void persistJobProgress(job, auth) }, 4000)
      try {
        await run(job, months)
      } finally {
        clearInterval(progressTimer)
      }
    } catch (e) {
      job.errors.push(message(e))
      job.state = 'done'
      job.progress = '확인할 항목이 있습니다.'
    }
    await store.set(job, auth)
  })()
  try {
    const { waitUntil } = await import('@vercel/functions')
    waitUntil(work)
  } catch {
    void work
  }
  res.json({ id: job.id, range: { from: months[0], to: months[months.length - 1], months: months.length } })
})
app.get('/api/app-revenue/sync/:id', async (req, res) => {
  const auth = reqAuth(req)
  const job = await getJobStore().get(req.params.id, auth)
  if (!job) return res.status(404).json({ error: '동기화 기록이 만료되었습니다.' })
  res.json(job.state === 'running' ? { ...job, documents: [], apps: [] } : job)
})
// Vercel catch-all under /api/app-revenue only matches a single segment, so polling uses /job?id=
app.get('/api/app-revenue/job', async (req, res) => {
  const auth = reqAuth(req)
  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!id) return res.status(400).json({ error: '동기화 ID가 필요합니다.' })
  const job = await getJobStore().get(id, auth)
  if (!job) return res.status(404).json({ error: '동기화 기록이 만료되었습니다.' })
  res.json(job.state === 'running' ? { ...job, documents: [], apps: [] } : job)
})
app.get('/api/app-revenue/google-setup', (_req, res) => {
  const sa = googleSa()
  const s = settings()
  const status = connectionStatus()
  const missing = status.google.missing ?? []
  res.json({
    saEmail: sa?.client_email || '',
    bucket: s.bucket,
    google: status.google,
    steps: [
      {
        id: 'api',
        title: 'Play Developer Reporting API',
        body: 'Cloud에서 API를 사용 설정합니다.',
        done: !missing.some((m) => /Reporting API|SERVICE_DISABLED/i.test(m)),
        link: 'https://console.cloud.google.com/apis/library/playdeveloperreporting.googleapis.com',
      },
      {
        id: 'sa',
        title: '서비스 계정 Play Console 권한',
        body: sa?.client_email ? `${sa.client_email} 에 재무·앱 조회 권한` : '서비스 계정 이메일 확인',
        done: Boolean(status.google.configured),
      },
      {
        id: 'bucket',
        title: 'GCS 버킷 ACL',
        body: s.bucket ? `${s.bucket} 읽기 권한` : '버킷 ID 입력',
        done: Boolean(status.google.reports && !missing.some((m) => /GCS|403|ACL/.test(m))),
      },
      {
        id: 'bundle',
        title: 'PC Chrome 번들(임시)',
        body: 'GCS 불가 시 PC에서 zip 갱신 후 배포',
        done: Boolean(status.google.reports),
      },
    ],
  })
})
app.post('/api/app-revenue/refresh-play-bundle', async (_req, res) => {
  if (isCloudRuntime()) {
    return res.status(403).json({ error: 'PC Chrome 번들 갱신은 로컬 커넥터에서만 실행할 수 있습니다.' })
  }
  try {
    const script = resolve(root, 'server/scripts/fetchPlayReportsCdp.mjs')
    if (!existsSync(script)) return res.status(500).json({ error: 'Play fetch 스크립트를 찾지 못했습니다.' })
    await runNodeScript(script)
    const rebuilt = rebuildGoogleReportBundleFromCache()
    res.json({ ok: true, ...rebuilt })
  } catch (e) {
    res.status(500).json({ error: message(e) })
  }
})

export { app as revenueApp }

if (!process.env.VERCEL && process.env.REVENUE_EXPORT_ONLY !== '1') {
  const host = process.env.REVENUE_BIND || '127.0.0.1'
  const port = Number(process.env.REVENUE_PORT) || 4001
  app.listen(port, host, () => console.log(`Private revenue connector ready on ${host}:${port}`))
}
