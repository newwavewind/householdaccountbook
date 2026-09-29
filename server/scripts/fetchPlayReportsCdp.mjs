#!/usr/bin/env node
/** Fast Play financial report download via existing Chrome CDP. */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = resolve(root, '.revenue-cache/imports/google')
mkdirSync(outDir, { recursive: true, mode: 0o700 })
const bucket = 'pubsite_prod_8395006543503407944'
const cdp = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222'
const financialUrl = 'https://play.google.com/console/u/0/developers/8395006543503407944/download-reports/financial'

async function loadPlaywright() {
  const require = createRequire(import.meta.url)
  for (const p of [
    resolve(root, 'node_modules/playwright'),
    resolve(root, 'server/node_modules/playwright'),
    '/Users/newsang/englishbomgichul/node_modules/playwright',
  ]) {
    try {
      const mod = await import(pathToFileURL(join(p, 'index.js')).href)
      const chromium = mod.chromium || mod.default?.chromium
      if (chromium?.connectOverCDP) return { chromium }
    } catch {}
    try {
      const mod = require(p)
      const chromium = mod.chromium || mod.default?.chromium
      if (chromium?.connectOverCDP) return { chromium }
    } catch {}
  }
  throw new Error('playwright missing')
}

function isZip(buf) {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b
}

async function main() {
  console.error('[fetch] connect', cdp)
  const { chromium } = await loadPlaywright()
  const browser = await chromium.connectOverCDP(cdp)
  const context = browser.contexts()[0]
  if (!context) throw new Error('no chrome context')
  let page = context.pages().find((p) => p.url().includes('download-reports/financial'))
  if (!page) page = await context.newPage()
  console.error('[fetch] goto financial')
  await page.goto(financialUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(4000)
  // Expand all rows (sales / earnings lists)
  for (let i = 0; i < 80; i++) {
    const btn = page.locator('button[aria-label="행 펼치기"]').first()
    if (!(await btn.count())) break
    await btn.click({ timeout: 1500 }).catch(() => {})
    await page.waitForTimeout(80)
  }
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="storage.cloud.google.com"]')]
      .map((a) => a.href)
      .filter(Boolean),
  )
  console.error('[fetch] links', hrefs.length)
  const targets = [...new Set(hrefs.filter((h) => h.includes('/sales/') || h.includes('/earnings/')))]
  console.error('[fetch] targets', targets.length)
  const saved = []
  for (const url of targets) {
    try {
      const resp = await page.request.get(url, { timeout: 60000 })
      const buf = Buffer.from(await resp.body())
      if (!isZip(buf)) {
        console.error('[fetch] skip non-zip', url.slice(0, 120), 'status', resp.status())
        continue
      }
      const base = (url.split('?')[0].split('/').pop() || 'report.zip').replace(/[^\w.\-]+/g, '_')
      writeFileSync(join(outDir, base), buf, { mode: 0o600 })
      saved.push({ file: base, bytes: buf.length, kind: url.includes('/earnings/') ? 'earnings' : 'sales' })
      console.error('[fetch] saved', base, buf.length)
    } catch (e) {
      console.error('[fetch] fail', url.slice(0, 100), e.message)
    }
  }
  // Also try direct salesreport for last 24 months via cookie session
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const yyyymm = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    for (const [kind, name] of [['sales', `salesreport_${yyyymm}.zip`], ['earnings', `earnings_${yyyymm}.zip`]]) {
      if (saved.some((s) => s.file.startsWith(name.replace('.zip', '')))) continue
      const url = `https://storage.cloud.google.com/${bucket}/${kind}/${name}?authuser=0`
      try {
        const resp = await page.request.get(url, { timeout: 30000 })
        const buf = Buffer.from(await resp.body())
        if (!isZip(buf)) continue
        writeFileSync(join(outDir, name), buf, { mode: 0o600 })
        saved.push({ file: name, bytes: buf.length, kind })
        console.error('[fetch] direct', name, buf.length)
      } catch {}
    }
  }
  for (const name of readdirSync(outDir)) {
    if (!name.endsWith('.zip')) continue
    const p = join(outDir, name)
    const head = readFileSync(p).subarray(0, 80).toString('utf8')
    if (head.includes('<!DOCTYPE') || head.includes('<html')) unlinkSync(p)
  }
  console.log(JSON.stringify({ ok: true, saved: saved.length, files: saved }))
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  process.exit(1)
})
