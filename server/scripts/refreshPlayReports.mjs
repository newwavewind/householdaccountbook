#!/usr/bin/env node
/** Refresh Google Play sales/earnings zips via logged-in Chrome CDP (port 9222). */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = resolve(root, '.revenue-cache/imports/google')
mkdirSync(outDir, { recursive: true, mode: 0o700 })

const month = process.argv[2] || new Date().toISOString().slice(0, 7)
if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
  console.error(JSON.stringify({ ok: false, error: 'invalid month' }))
  process.exit(2)
}
const yyyymm = month.replace('-', '')
const bucket = (() => {
  try {
    return JSON.parse(readFileSync(resolve(root, '.revenue-cache/settings.json'), 'utf8')).bucket
  } catch {
    return process.env.GOOGLE_PLAY_BUCKET || ''
  }
})() || 'pubsite_prod_8395006543503407944'
const cdp = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222'

async function loadPlaywright() {
  const require = createRequire(import.meta.url)
  const candidates = [
    resolve(root, 'node_modules/playwright'),
    resolve(root, 'server/node_modules/playwright'),
    '/Users/newsang/englishbomgichul/node_modules/playwright',
    '/Users/newsang/ox-quiz-app/node_modules/playwright',
  ]
  for (const p of candidates) {
    try {
      const mod = await import(pathToFileURL(join(p, 'index.js')).href)
      const chromium = mod.chromium || mod.default?.chromium
      if (chromium?.connectOverCDP) return { chromium }
    } catch { /* next */ }
    try {
      const mod = require(p)
      const chromium = mod.chromium || mod.default?.chromium
      if (chromium?.connectOverCDP) return { chromium }
    } catch { /* next */ }
  }
  throw new Error('playwright 모듈을 찾지 못했습니다. Chrome CDP 동기화에 playwright가 필요합니다.')
}

function isZip(buf) {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b
}

async function main() {
  const { chromium } = await loadPlaywright()
  let browser
  try {
    browser = await chromium.connectOverCDP(cdp)
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: `Chrome CDP(${cdp}) 연결 실패: ${e.message}. Chrome을 --remote-debugging-port=9222 로 실행해 주세요.` }))
    process.exit(3)
  }
  const context = browser.contexts()[0]
  if (!context) {
    console.error(JSON.stringify({ ok: false, error: 'Chrome 컨텍스트가 없습니다.' }))
    process.exit(3)
  }
  let page = context.pages().find((p) => p.url().includes('play.google.com/console'))
  if (!page) page = await context.newPage()
  const financialUrl = 'https://play.google.com/console/u/0/developers/8395006543503407944/download-reports/financial'
  if (!page.url().includes('download-reports/financial')) {
    await page.goto(financialUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(3500)
  }
  for (let i = 0; i < 40; i++) {
    const btn = page.locator('button[aria-label="행 펼치기"]').first()
    if (!(await btn.count())) break
    await btn.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(180)
  }
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="storage.cloud.google.com"]')]
      .map((a) => a.href)
      .filter(Boolean),
  )
  const wanted = hrefs.filter((h) => h.includes(yyyymm) && (h.includes('/sales/') || h.includes('/earnings/')))
  const extras = [
    `https://storage.cloud.google.com/${bucket}/sales/salesreport_${yyyymm}.zip?authuser=0`,
  ]
  const targets = [...new Set([...wanted, ...extras])]
  const saved = []
  for (const url of targets) {
    try {
      const resp = await page.request.get(url)
      const buf = Buffer.from(await resp.body())
      if (!isZip(buf)) continue
      const base = (url.split('?')[0].split('/').pop() || `report_${yyyymm}.zip`).replace(/[^\w.\-]+/g, '_')
      writeFileSync(join(outDir, base), buf, { mode: 0o600 })
      saved.push({ file: base, bytes: buf.length, kind: url.includes('/earnings/') ? 'earnings' : 'sales' })
    } catch { /* skip */ }
  }
  for (const name of readdirSync(outDir)) {
    if (!name.endsWith('.zip')) continue
    const p = join(outDir, name)
    const head = readFileSync(p).subarray(0, 80).toString('utf8')
    if (head.includes('<!DOCTYPE') || head.includes('<html')) unlinkSync(p)
  }
  console.log(JSON.stringify({ ok: true, month, saved, scanned: targets.length }))
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  process.exit(1)
})
