import assert from 'node:assert/strict'
import { test } from 'node:test'
import { zipSync, strToU8 } from 'fflate'
import { collectGoogleReports, pushGoogleZipDocuments } from './googleReports.js'
import type { ReportDocument } from './reportPolicy.js'
import { syncMonths } from './reportPolicy.js'

const fixture = (text: string, name = 'report.csv') => zipSync({ [name]: strToU8(text) })
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
function job() { return { documents: [] as ReportDocument[], errors: [] as string[], completed: [] as string[], progress: '' } }

test('paginated API collection survives one failed ZIP and fills only missing reports from cache', async () => {
  const result = job(), requests: string[] = []
  const live = fixture('Package ID,Item Price\ncom.example.app,100'), cached = fixture('Package ID,Item Price\ncom.example.app,90')
  await collectGoogleReports({
    job: result, now: new Date('2026-11-06T12:00:00Z'), bucket: 'fixture-bucket', months: ['2026-09', '2026-10'],
    request: async raw => {
      requests.push(raw)
      const url = new URL(raw), prefix = url.searchParams.get('prefix')
      if (prefix === 'sales/' && !url.searchParams.has('pageToken')) return response({ items: [{ name: 'sales/salesreport_202609.zip' }, { name: 'sales/salesreport_202601.zip' }], nextPageToken: 'page-two' })
      if (prefix === 'sales/' && url.searchParams.get('pageToken') === 'page-two') return response({ items: [{ name: 'sales/salesreport_202610.zip' }] })
      if (prefix === 'earnings/') return response({ items: [{ name: 'earnings/earnings_202609.zip' }, { name: 'earnings/earnings_202609_adjustment.zip' }] })
      if (url.pathname.includes('salesreport_202610')) throw new Error('503 fixture')
      return new Response(live)
    },
    loadCaches: () => {
      pushGoogleZipDocuments(result, '2026-09', 'sales', 'local/salesreport_202609.zip', cached, 'cache')
      pushGoogleZipDocuments(result, '2026-10', 'sales', 'local/salesreport_202610.zip', cached, 'cache')
      pushGoogleZipDocuments(result, '2026-10', 'sales', 'bundle/salesreport_202610.zip', cached, 'cache')
    },
    errorMessage: error => (error as Error).message,
  })
  assert.equal(result.documents.length, 4)
  assert.equal(result.documents.filter(d => d.source === 'api').length, 3)
  assert.equal(result.documents.filter(d => d.source === 'cache').length, 1)
  assert.ok(result.documents.find(d => d.key.includes('salesreport_202609'))?.text.includes(',100'))
  assert.ok(result.documents.some(d => d.key.includes('_adjustment.zip')))
  assert.ok(result.errors.some(e => e.includes('503 fixture')))
  assert.ok(result.errors.some(e => e.includes('최신 여부')))
  assert.ok(result.errors.some(e => e.includes('확정 수익 1개월 미확인 (2026-10)')))
  assert.ok(!result.errors.some(e => e.includes('예상 매출 1개월 미확인')))
  assert.ok(requests.some(raw => raw.includes('pageToken=page-two')))
  assert.ok(!requests.some(raw => raw.includes('salesreport_202601.zip')))
})

test('GCS permissions errors remain visible with cached sales and missing earnings', async () => {
  const result = job()
  let requests = 0, caches = 0
  await collectGoogleReports({
    job: result, now: new Date('2026-11-06T12:00:00Z'), bucket: 'fixture-bucket', months: ['2026-09'],
    request: async () => { requests++; throw new Error('403 fixture') },
    loadCaches: () => { caches++; pushGoogleZipDocuments(result, '2026-09', 'sales', 'local/salesreport_202609.zip', fixture('cached'), 'cache') },
    errorMessage: error => (error as Error).message,
  })
  assert.equal(requests, 2)
  assert.equal(caches, 1)
  assert.equal(result.documents.length, 1)
  assert.equal(result.errors.filter(e => e.includes('403 fixture')).length, 2)
  assert.ok(result.errors.some(e => e.includes('확정 수익 1개월 미확인')))
  assert.equal(result.completed.length, 0)
})

test('an unavailable provider and empty cache finish as missing data without launching another transport', async () => {
  const result = job()
  let requests = 0
  await collectGoogleReports({ job: result, now: new Date('2026-11-06T12:00:00Z'), bucket: 'fixture-bucket', months: ['2026-09'], request: async () => { requests++; throw new Error('403 fixture') }, loadCaches: () => {}, errorMessage: error => (error as Error).message })
  assert.equal(requests, 2)
  assert.equal(result.documents.length, 0)
  assert.equal(result.completed.length, 0)
  assert.equal(result.errors.length, 4)
})

test('full history summarizes the unobserved early period and reports gaps after the first listed report', async () => {
  const result = job()
  await collectGoogleReports({
    job: result, now: new Date('2026-11-06T12:00:00Z'), bucket: 'fixture-bucket', months: syncMonths({ scope: 'all' }, '2026-10', '2020-01'),
    request: async raw => {
      const url = new URL(raw)
      if (url.searchParams.get('prefix') === 'sales/') return response({ items: [{ name: 'sales/salesreport_202608.zip' }, { name: 'sales/salesreport_202609.zip' }] })
      if (url.searchParams.get('prefix') === 'earnings/') return response({ items: [] })
      if (url.pathname.includes('202608')) throw new Error('503 fixture')
      return new Response(fixture('synthetic sales'))
    },
    loadCaches: () => {}, errorMessage: error => (error as Error).message,
  })
  assert.ok(result.completed.some(e => e.includes('2026-01~2026-07 보고서는 확인되지 않았습니다')))
  // August must remain a known gap even though its download failed.
  assert.ok(result.errors.some(e => e.includes('예상 매출 2개월 미확인 (2026-08, 2026-10)')))
  assert.ok(result.errors.some(e => e.includes('확정 수익 3개월 미확인 (2026-08, 2026-09, 2026-10)')))
})

test('current-month earnings not yet published is informational after a successful provider check', async () => {
  const result = job()
  await collectGoogleReports({
    job: result, now: new Date('2026-10-08T12:00:00Z'), bucket: 'fixture-bucket', months: ['2026-10'],
    request: async raw => {
      const url = new URL(raw)
      if (url.searchParams.get('prefix') === 'sales/') return response({ items: [{ name: 'sales/salesreport_202610.zip' }] })
      if (url.searchParams.get('prefix') === 'earnings/') return response({ items: [] })
      return new Response(fixture('synthetic sales'))
    },
    loadCaches: () => {}, errorMessage: error => (error as Error).message,
  })
  assert.equal(result.errors.length, 0)
  assert.ok(result.completed.some(info => info.includes('2026-10 확정 수익은 발행 대기')))
  assert.ok(result.completed.some(info => info.includes('2026-11-05')))
})

test('an expected publication window never hides a real 403 API error', async () => {
  const result = job()
  await collectGoogleReports({
    job: result, now: new Date('2026-10-08T12:00:00Z'), bucket: 'fixture-bucket', months: ['2026-10'],
    request: async raw => {
      const url = new URL(raw)
      if (url.searchParams.get('prefix') === 'sales/') return response({ items: [{ name: 'sales/salesreport_202610.zip' }] })
      if (url.searchParams.get('prefix') === 'earnings/') throw new Error('403 fixture')
      return new Response(fixture('synthetic sales'))
    },
    loadCaches: () => {}, errorMessage: error => (error as Error).message,
  })
  assert.equal(result.errors.length, 1)
  assert.ok(result.errors[0].includes('403 fixture'))
  assert.ok(result.completed.some(info => info.includes('발행 대기')))
})
