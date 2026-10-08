import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addReportDocument, appleMonthlyRetentionFrom, collectApplePeriods, currentMonth, googleDocumentKey, googleEarningsPublicationWindow, missingGoogleReports, partitionMissingReportMonths, syncMonths, type ReportDocument } from './reportPolicy.js'

test('month selection and Korea midnight do not trigger an accidental full history sync', () => {
  assert.equal(currentMonth(new Date('2026-09-30T15:01:00Z')), '2026-10')
  assert.deepEqual(syncMonths({}, '2026-10', '2020-01'), ['2026-10'])
  assert.deepEqual(syncMonths({ scope: 'month', month: '2026-09' }, '2026-10', '2020-01'), ['2026-09'])
})

test('all and range requests cross a year boundary and never include a future month', () => {
  assert.deepEqual(syncMonths({ scope: 'all' }, '2026-02', '2025-12'), ['2025-12', '2026-01', '2026-02'])
  assert.deepEqual(syncMonths({ scope: 'range', from: '2025-12', to: '2026-01' }, '2026-02', '2020-01'), ['2025-12', '2026-01'])
  for (const body of [{ scope: 'typo' }, { scope: 'month', month: '2026-13' }, { scope: 'month', month: '2026-11' }, { scope: 'all', from: 'bad' }, { scope: 'range', from: '2026-09', to: '2026-08' }]) {
    assert.throws(() => syncMonths(body, '2026-10', '2020-01'))
  }
})

test('GCS, local and bundle copies have one stable report identity', () => {
  const expected = 'google:sales/salesreport_202609.zip:folder/salesreport_202609.csv'
  for (const prefix of ['sales', 'bundle', 'local']) {
    assert.equal(googleDocumentKey('sales', `${prefix}/salesreport_202609.zip`, 'folder/salesreport_202609.csv'), expected)
  }
  assert.notEqual(googleDocumentKey('earnings', 'earnings_202609_1.zip', 'data.csv'), googleDocumentKey('earnings', 'earnings_202609_2.zip', 'data.csv'))
  assert.notEqual(googleDocumentKey('earnings', 'earnings_202609.zip', 'part1/data.csv'), googleDocumentKey('earnings', 'earnings_202609.zip', 'part2/data.csv'))
})

test('cache fills missing reports without replacing or duplicating live reports', () => {
  const documents: ReportDocument[] = []
  const report: ReportDocument = { key: googleDocumentKey('sales', 'salesreport_202609.zip', 'data.csv'), name: 'sales', text: 'live', period: '2026-09', source: 'api' }
  assert.equal(addReportDocument(documents, report), true)
  assert.equal(addReportDocument(documents, { ...report, text: 'old cached', source: 'cache' }), false)
  assert.equal(documents.length, 1)
  assert.equal(documents[0].text, 'live')
  assert.deepEqual(missingGoogleReports(documents, ['2026-09', '2026-10'], 'sales'), ['2026-10'])
  assert.deepEqual(missingGoogleReports(documents, ['2026-09'], 'earnings'), ['2026-09'])
  addReportDocument(documents, { ...report, key: googleDocumentKey('earnings', 'earnings_202609.zip', 'data.csv'), source: 'cache' })
  assert.deepEqual(missingGoogleReports(documents, ['2026-09'], 'earnings'), [])
})

test('a later live report upgrades a cached report without adding a second copy', () => {
  const cached: ReportDocument = { key: 'google:sales/salesreport_202609.zip:data.csv', name: 'sales', text: 'cached', period: '2026-09', source: 'cache' }
  const documents = [cached]
  addReportDocument(documents, { ...cached, source: 'api', text: 'updated' })
  assert.equal(documents.length, 1)
  assert.equal(documents[0].text, 'updated')
})

test('Apple monthly and daily report collection never overlap for the current month', async () => {
  const requests: string[] = []
  await collectApplePeriods({
    months: ['2026-09', '2026-10'], todayMonth: '2026-10',
    monthly: async m => { requests.push(`monthly:${m}`) },
    finance: async m => { requests.push(`finance:${m}`) },
    daily: async m => { requests.push(`daily:${m}`) },
    failed: () => assert.fail('Unexpected provider failure'), denied: () => false,
  })
  assert.deepEqual(requests, ['monthly:2026-09', 'finance:2026-09', 'daily:2026-10'])
})

test('a denied Apple sales key does not prevent a separately authorized finance key from collecting', async () => {
  const requests: string[] = [], failures: string[] = []
  await collectApplePeriods({
    months: ['2026-08', '2026-09', '2026-10'], todayMonth: '2026-10',
    monthly: async m => { requests.push(`monthly:${m}`); throw new Error('403') },
    finance: async m => { requests.push(`finance:${m}`) },
    daily: async m => { requests.push(`daily:${m}`) },
    failed: (kind, month) => { failures.push(`${kind}:${month}`) },
    denied: e => e instanceof Error && e.message === '403',
  })
  assert.deepEqual(requests, ['monthly:2026-08', 'finance:2026-08', 'finance:2026-09'])
  assert.deepEqual(failures, ['sales:2026-08'])
})

test('one unpublished Apple report does not prevent later reports from being collected', async () => {
  const requests: string[] = []
  await collectApplePeriods({
    months: ['2026-08', '2026-09'], todayMonth: '2026-10',
    monthly: async m => { requests.push(`monthly:${m}`); if (m === '2026-08') throw new Error('404') },
    finance: async m => { requests.push(`finance:${m}`) },
    daily: async () => assert.fail('No current month requested'),
    failed: () => {}, denied: () => false,
  })
  assert.deepEqual(requests, ['monthly:2026-08', 'finance:2026-08', 'monthly:2026-09', 'finance:2026-09'])
})

test('full-history sync skips expired monthly sales but still requests historical finance', async () => {
  const requests: string[] = [], skipped: string[] = []
  assert.equal(appleMonthlyRetentionFrom('2026-10'), '2025-09')
  await collectApplePeriods({
    months: ['2020-01', '2025-09', '2026-09', '2026-10'], todayMonth: '2026-10', oldestSalesMonth: appleMonthlyRetentionFrom('2026-10'),
    skippedSales: month => { skipped.push(month) },
    monthly: async m => { requests.push(`monthly:${m}`) }, finance: async m => { requests.push(`finance:${m}`) }, daily: async m => { requests.push(`daily:${m}`) },
    failed: () => assert.fail('Unexpected provider failure'), denied: () => false,
  })
  assert.deepEqual(skipped, ['2020-01'])
  assert.deepEqual(requests, ['finance:2020-01', 'monthly:2025-09', 'finance:2025-09', 'monthly:2026-09', 'finance:2026-09', 'daily:2026-10'])
})

test('Google current-month earnings waits through the fifth of next month, including December rollover', () => {
  assert.deepEqual(googleEarningsPublicationWindow('2026-10', new Date('2026-10-08T12:00:00Z')), { pending: true, expectedBy: '2026-11-05' })
  assert.equal(googleEarningsPublicationWindow('2026-10', new Date('2026-11-05T14:59:59Z')).pending, true)
  assert.equal(googleEarningsPublicationWindow('2026-10', new Date('2026-11-05T15:00:00Z')).pending, false)
  assert.deepEqual(googleEarningsPublicationWindow('2026-12', new Date('2027-01-04T12:00:00Z')), { pending: true, expectedBy: '2027-01-05' })
})

test('unobserved earlier history is distinct from a gap after a known report and never assumes zero sales', () => {
  assert.deepEqual(partitionMissingReportMonths(['2020-01', '2026-06', '2026-08'], ['2026-07', '2026-09']), { beforeFirst: ['2020-01', '2026-06'], gaps: ['2026-08'] })
  assert.deepEqual(partitionMissingReportMonths(['2026-09'], []), { beforeFirst: [], gaps: ['2026-09'] })
})
