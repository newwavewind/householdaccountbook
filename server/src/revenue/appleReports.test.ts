import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { appleFinanceReportUrl, appleFiscalPeriod, appleSalesReportUrl, downloadAppleFinanceReport, downloadAppleSalesReport } from './appleReports.js'

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
