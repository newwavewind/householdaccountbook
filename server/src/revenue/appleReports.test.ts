import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { appleDailyReportDates, appleFinancialReportRange, appleFinanceReportUrl, appleFiscalPeriod, appleSalesReportUrl, downloadAppleFinanceReport, downloadAppleSalesReport } from './appleReports.js'
import { collectApplePeriods } from './reportPolicy.js'

test('monthly sales uses YYYY-MM and decodes the returned gzip fixture', async () => {
  const fixture = 'Provider\tUnits\tDeveloper Proceeds\nAPPLE\t1\t100\n'
  let calls = 0
  const result = await downloadAppleSalesReport({
    frequency: 'MONTHLY', date: '2026-09', vendor: 'fixture-vendor',
    request: async raw => {
      calls++
      const url = new URL(raw)
      assert.equal(url.origin + url.pathname, 'https://api.appstoreconnect.apple.com/v1/salesReports')
      assert.equal(url.searchParams.get('filter[frequency]'), 'MONTHLY')
      assert.equal(url.searchParams.get('filter[reportDate]'), '2026-09')
      assert.equal(url.searchParams.get('filter[reportType]'), 'SALES')
      assert.equal(url.searchParams.get('filter[reportSubType]'), 'SUMMARY')
      assert.equal(url.searchParams.get('filter[version]'), '1_0')
      assert.equal(url.searchParams.get('filter[vendorNumber]'), 'fixture-vendor')
      return new Response(gzipSync(fixture))
    },
  })
  assert.equal(calls, 1)
  assert.equal(result, fixture)
})

test('daily sales keeps YYYY-MM-DD while invalid frequency/date combinations fail before a request', () => {
  const url = new URL(appleSalesReportUrl('DAILY', '2026-09-01', 'fixture-vendor'))
  assert.equal(url.searchParams.get('filter[reportDate]'), '2026-09-01')
  assert.throws(() => appleSalesReportUrl('MONTHLY', '2026-09-01', 'fixture-vendor'))
  assert.throws(() => appleSalesReportUrl('DAILY', '2026-09', 'fixture-vendor'))
})

test('finance converts calendar labels to Apple fiscal period numbers across year boundaries', () => {
  assert.equal(appleFiscalPeriod('2026-09'), '2026-12')
  assert.equal(appleFiscalPeriod('2026-10'), '2027-01')
  assert.equal(appleFiscalPeriod('2026-01'), '2026-04')
  assert.equal(appleFiscalPeriod('2026-12'), '2027-03')
  assert.equal(appleFiscalPeriod('2027-01'), '2027-04')
  assert.throws(() => appleFiscalPeriod('2026-13'))
  const url = new URL(appleFinanceReportUrl('2026-09', 'fixture-vendor'))
  assert.equal(url.searchParams.get('filter[reportDate]'), '2026-12')
  assert.equal(url.searchParams.get('filter[reportType]'), 'FINANCIAL')
  assert.equal(url.searchParams.get('filter[regionCode]'), 'ZZ')
})

test('finance request fetches the requested fiscal month and preserves the true dates from its report', async () => {
  const fixture = 'Start Date\tEnd Date\tQuantity\tExtended Partner Share\n08/30/2026\t09/26/2026\t1\t100\n'
  let requests = 0
  const result = await downloadAppleFinanceReport({ calendarMonth: '2026-09', vendor: 'fixture-vendor', request: async raw => {
    requests++
    const url = new URL(raw)
    assert.equal(url.pathname, '/v1/financeReports')
    assert.equal(url.searchParams.get('filter[reportDate]'), '2026-12')
    return new Response(gzipSync(fixture))
  } })
  assert.equal(requests, 1)
  assert.equal(result, fixture)
})

test('consolidated financial period parsing accepts reordered repeated headers and ignores summary tables', () => {
  const text = 'Start Date\tEnd Date\tQuantity\n08/30/2026\t09/26/2026\t1\nEnd Date\tQuantity\tStart Date\n09/26/2026\t2\t08/30/2026\nTotal_Rows\t2\nCountry Of Sale\tPartner Share Currency\tQuantity\nKR\tKRW\t3'
  assert.deepEqual(appleFinancialReportRange(text), { start: '2026-08-30', end: '2026-09-26' })
  assert.equal(appleFinancialReportRange('Start Date\tEnd Date\n02/30/2026\t03/01/2026'), null)
  assert.equal(appleFinancialReportRange('Start Date\tEnd Date\n08/30/2026\t09/26/2026\n08/30/2026\t09/27/2026'), null)
  assert.equal(appleFinancialReportRange('Start Date\tEnd Date'), null)
})

test('open fiscal daily collection includes prior calendar tail and excludes current unpublished day', () => {
  const plan = appleDailyReportDates({ month: '2026-10', today: '2026-10-09', financialRanges: [{ start: '2026-08-30', end: '2026-09-26' }] })
  assert.equal(plan.dates[0], '2026-09-27')
  assert.equal(plan.dates.at(-1), '2026-10-08')
  assert.equal(plan.dates.length, 12)
  assert.equal(plan.dates.filter(date => date.startsWith('2026-09')).length, 4)
  assert.equal(plan.omitted, undefined)
})

test('the latest actual fiscal end controls year rollover and avoids overlapping settled days', () => {
  const plan = appleDailyReportDates({ month: '2027-01', today: '2027-01-08', financialRanges: [{ start: '2026-10-25', end: '2026-11-21' }, { start: '2026-11-22', end: '2026-12-26' }] })
  assert.equal(plan.dates[0], '2026-12-27')
  assert.equal(plan.dates.at(-1), '2027-01-07')
  assert.equal(plan.dates.includes('2026-12-26'), false)
})

test('stale finance bounds cannot generate an unbounded historical daily crawl', () => {
  const plan = appleDailyReportDates({ month: '2026-10', today: '2026-10-09', financialRanges: [{ start: '2020-01-01', end: '2020-01-31' }] })
  assert.equal(plan.dates.length, 62)
  assert.equal(plan.omitted?.start, '2026-01-01')
  assert.equal(new Date(`${plan.omitted!.end}T00:00:00Z`).getTime() + 86400000, Date.parse(`${plan.dates[0]}T00:00:00Z`))
  assert.equal(plan.dates.at(-1), '2026-10-08')
})

test('daily fiscal bridging never requests dates before the confirmed 2026 launch year', () => {
  const plan = appleDailyReportDates({ month: '2026-01', today: '2026-01-08', financialRanges: [{ start: '2025-11-23', end: '2025-12-27' }] })
  assert.equal(plan.dates[0], '2026-01-01')
  assert.equal(plan.dates.at(-1), '2026-01-07')
  assert.equal(plan.dates.length, 7)
  assert.equal(plan.omitted, undefined)
})

test('without a valid closed financial period only current calendar dates are requested', () => {
  const plan = appleDailyReportDates({ month: '2026-10', today: '2026-10-09', financialRanges: [{ start: 'invalid', end: '2026-09-26' }, { start: '2026-10-01', end: '2026-10-31' }] })
  assert.equal(plan.dates[0], '2026-10-01')
  assert.equal(plan.dates.length, 8)
})

test('monthly orchestration downloads fiscal-boundary daily fixtures with original calendar identities', async () => {
  const documents: Array<{ key: string; period: string; text: string }> = []
  const dailyRequests: string[] = []
  const financialFixture = 'Start Date\tEnd Date\tQuantity\tExtended Partner Share\n08/30/2026\t09/26/2026\t1\t100\n'
  await collectApplePeriods({
    months: ['2026-09', '2026-10'], todayMonth: '2026-10',
    monthly: async () => {},
    finance: async month => {
      const text = await downloadAppleFinanceReport({ calendarMonth: month, vendor: 'fixture-vendor', request: async () => new Response(gzipSync(financialFixture)) })
      documents.push({ key: `apple-finance:${month}`, period: month, text })
    },
    daily: async month => {
      const financialRanges = documents.flatMap(document => { const range = appleFinancialReportRange(document.text); return range ? [range] : [] })
      for (const date of appleDailyReportDates({ month, today: '2026-10-09', financialRanges }).dates) {
        const text = await downloadAppleSalesReport({ frequency: 'DAILY', date, vendor: 'fixture-vendor', request: async raw => {
          const url = new URL(raw)
          assert.equal(url.searchParams.get('filter[frequency]'), 'DAILY')
          dailyRequests.push(url.searchParams.get('filter[reportDate]')!)
          return new Response('Provider\tUnits\tBegin Date\tEnd Date\nAPPLE\t1\tfixture\tfixture')
        } })
        documents.push({ key: `apple-sales:${date}`, period: date.slice(0, 7), text })
      }
    },
    failed: () => assert.fail('Unexpected provider failure'), denied: () => false,
  })
  assert.deepEqual(dailyRequests.slice(0, 4), ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'])
  assert.equal(documents.find(document => document.key === 'apple-sales:2026-09-30')?.period, '2026-09')
  assert.equal(documents.find(document => document.key === 'apple-sales:2026-10-01')?.period, '2026-10')
  assert.equal(new Set(dailyRequests).size, 12)
})
