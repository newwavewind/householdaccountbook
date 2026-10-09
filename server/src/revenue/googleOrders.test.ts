import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enrichGoogleOrderProceeds, orderMoney, parseOrderReportTable } from './googleOrders.js'
import type { ReportDocument } from './reportPolicy.js'

const now = new Date('2026-10-08T12:00:00Z')
const processedTime = '2026-10-03T01:02:03Z'
const chargedTimestamp = Math.floor(Date.parse(processedTime) / 1000)
const orderId = 'GPA.0000-0000-0000-00001'
const header = 'Order Number,Order Charged Date,Order Charged Timestamp,Financial Status,Package ID,Currency of Sale,Charged Amount,Product Title'
function row(options: { id?: string; date?: string; timestamp?: number; status?: string; currency?: string; amount?: string; title?: string } = {}) {
  return [options.id ?? orderId, options.date ?? '2026-10-03', options.timestamp ?? chargedTimestamp, options.status ?? 'Charged', 'com.example.fixture', options.currency ?? 'KRW', options.amount ?? '100', options.title ?? 'Fixture app'].join(',')
}
function document(rows: string[], options: Partial<ReportDocument> = {}): ReportDocument {
  return { key: 'google:sales/salesreport_202610.zip:sales.csv', name: 'fixture', text: [header, ...rows].join('\n'), period: '2026-10', source: 'api', ...options }
}
function job(documents: ReportDocument[]) { return { documents, errors: [] as string[], completed: [] as string[], progress: '' } }
function order(overrides: Record<string, unknown> = {}) {
  return { orderId, createTime: '2026-10-03T01:00:00Z', lastEventTime: processedTime, state: 'PROCESSED', orderHistory: { processedEvent: { eventTime: processedTime } }, developerRevenueInBuyerCurrency: { currencyCode: 'KRW', units: '85' }, ...overrides }
}
const response = (payload: unknown) => ({ json: async () => payload })
async function run(documents: ReportDocument[], payload: unknown = order()) {
  const state = job(documents)
  let calls = 0
  await enrichGoogleOrderProceeds({ job: state, month: '2026-10', now, request: async (_url, signal) => { calls++; assert.equal(signal.aborted, false); return response(payload) } })
  return { state, calls }
}

test('CSV record indices preserve cancelled rows and quoted newlines while omitting blank lines', async () => {
  const report = document([row({ status: 'Cancelled' }), '', row({ title: '"Quoted, title\nsecond line"' })])
  const original = report.text
  const { state, calls } = await run([report])
  assert.equal(calls, 1)
  assert.equal(report.text, original)
  assert.equal(parseOrderReportTable(report.text).length, 3)
  assert.deepEqual(report.googleOrderProceeds?.map(({ rowIndex, proceeds, currency }) => ({ rowIndex, proceeds, currency })), [{ rowIndex: 1, proceeds: 85, currency: 'KRW' }])
  assert.ok(Number.isFinite(Date.parse(report.googleOrderProceeds![0].fetchedAt)))
  assert.equal(state.errors.length, 0)
})

test('one order across charge/refund files is queried once and net proceeds allocated to charge exactly once', async () => {
  const refund = document([row({ status: 'Refund', amount: '-20' })], { key: 'google:sales/adjustment.zip:refund.csv' })
  const charge = document([row(), row()], { key: 'google:sales/report.zip:charge.csv' })
  const { calls, state } = await run([refund, charge], order({
    state: 'PARTIALLY_REFUNDED', lastEventTime: '2026-10-04T01:02:03Z', developerRevenueInBuyerCurrency: { currencyCode: 'KRW', units: '65' },
    orderHistory: { processedEvent: { eventTime: processedTime }, partialRefundEvents: [{ createTime: '2026-10-04T00:02:03Z', processTime: '2026-10-04T01:02:03Z', state: 'PROCESSED_SUCCESSFULLY' }] },
  }))
  assert.equal(calls, 1)
  assert.deepEqual(refund.googleOrderProceeds?.map(entry => entry.proceeds), [0])
  assert.deepEqual(charge.googleOrderProceeds?.map(entry => entry.proceeds), [65, 0])
  assert.equal(state.errors.length, 0)
})

test('processed date rather than earlier create date assigns a delayed payment to its charged month', async () => {
  const report = document([row()])
  const { state } = await run([report], order({ createTime: '2026-09-30T23:59:59Z' }))
  assert.equal(report.googleOrderProceeds?.[0].proceeds, 85)
  assert.equal(state.errors.length, 0)
})

test('past-month, cached and already settled reports never issue Orders requests', async () => {
  for (const reports of [
    [document([row()], { source: 'cache' })],
    [document([row()], { period: '2026-09' })],
    [document([row()]), document([], { key: 'google:earnings/earnings_202610.zip:earnings.csv' })],
  ]) assert.equal((await run(reports)).calls, 0)
  const state = job([document([row()])])
  await enrichGoogleOrderProceeds({ job: state, month: '2026-09', now, request: async () => assert.fail('Historical order snapshot must not be applied') })
})

test('an adjustment earnings archive alone cannot suppress current order proceeds', async () => {
  const sales = document([row()])
  const adjustment = document([], { key: 'google:earnings/earnings_202610_adjustment.zip:earnings.csv' })
  const { calls, state } = await run([sales, adjustment])
  assert.equal(calls, 1)
  assert.equal(sales.googleOrderProceeds?.[0].proceeds, 85)
  assert.equal(state.errors.length, 0)
})

test('base earnings with numeric, currency or other suffixes still supersede order snapshots', async () => {
  for (const suffix of ['_00000000-0', '_KRW', '_regional']) {
    const sales = document([row()])
    const base = document([], { key: `google:earnings/earnings_202610${suffix}.zip:PlayApps_202610.csv` })
    assert.equal((await run([sales, base])).calls, 0)
    assert.equal(sales.googleOrderProceeds, undefined)
  }
})

test('subscription renewal suffixes identify separate orders and never collapse to a shared base order', async () => {
  const identifiers = [`${orderId}..0`, `${orderId}..1`]
  const state = job([document(identifiers.map(id => row({ id })))])
  let requests = 0
  await enrichGoogleOrderProceeds({ job: state, month: '2026-10', now, request: async url => {
    requests++
    const id = decodeURIComponent(new URL(url).pathname.split('/').at(-1)!)
    assert.ok(identifiers.includes(id))
    return response(order({ orderId: id }))
  } })
  assert.equal(requests, 2)
  assert.deepEqual(state.documents[0].googleOrderProceeds?.map(entry => entry.proceeds), [85, 85])
  assert.equal(state.errors.length, 0)
})

test('a group containing prior-month refund or mixed currencies is entirely left unknown', async () => {
  for (const extra of [row({ date: '2026-09-03', status: 'Refund' }), row({ currency: 'USD' })]) {
    const report = document([row(), extra])
    const { calls, state } = await run([report])
    assert.equal(calls, 0)
    assert.equal(report.googleOrderProceeds, undefined)
    assert.match(state.errors.join(' '), /1건/)
  }
})

test('a refund-only group remains unknown without an observed charge even within the current month', async () => {
  const report = document([row({ status: 'Refund', amount: '-100' })])
  const { calls, state } = await run([report])
  assert.equal(calls, 0)
  assert.equal(report.googleOrderProceeds, undefined)
  assert.equal(state.errors.length, 1)
})

test('order identity, money currency, state, processed timestamp and future dates must all agree', async () => {
  const variants = [
    order({ orderId: `${orderId}1` }), order({ state: 'PENDING' }), order({ state: 'PENDING_REFUND' }), order({ state: 'CANCELED' }),
    order({ developerRevenueInBuyerCurrency: { currencyCode: 'USD', units: '1' } }),
    order({ developerRevenueInBuyerCurrency: { currencyCode: 'KRW', units: 'NaN' } }),
    order({ createTime: '2026-10-09T01:00:00Z' }), order({ orderHistory: {} }),
    order({ orderHistory: { processedEvent: { eventTime: '2026-10-03T01:02:04Z' } } }),
    order({ lastEventTime: '2026-11-01T01:02:03Z' }),
    order({ lastEventTime: '2026-10-09T01:02:03Z' }),
    order({ state: 'REFUNDED', orderHistory: { processedEvent: { eventTime: processedTime }, refundEvent: { eventTime: '2026-11-01T00:00:00Z' } } }),
    order({ state: 'PARTIALLY_REFUNDED', orderHistory: { processedEvent: { eventTime: processedTime }, partialRefundEvents: [{ createTime: '2026-10-04T00:00:00Z', state: 'PENDING' }] } }),
  ]
  for (const payload of variants) {
    const report = document([row()])
    const { state } = await run([report], payload)
    assert.equal(report.googleOrderProceeds, undefined)
    assert.equal(state.errors.length, 1)
    assert.ok(!state.errors.join(' ').includes(orderId))
  }
})

test('same-month full refunds retain the supplied zero proceeds without a second deduction', async () => {
  const report = document([row(), row({ status: 'Refund', amount: '-100' })])
  await run([report], order({ state: 'REFUNDED', developerRevenueInBuyerCurrency: { currencyCode: 'KRW' }, lastEventTime: '2026-10-04T00:00:00Z', orderHistory: { processedEvent: { eventTime: processedTime }, refundEvent: { eventTime: '2026-10-04T00:00:00Z' } } }))
  assert.deepEqual(report.googleOrderProceeds?.map(entry => entry.proceeds), [0, 0])
})

test('protobuf Money accepts omitted zero nanos, signed values and zero, rejects invalid or imprecise money', () => {
  assert.deepEqual(orderMoney({ currencyCode: 'KRW', units: '85' }), { amount: 85, currency: 'KRW' })
  assert.deepEqual(orderMoney({ currencyCode: 'USD', units: '-1', nanos: -500000000 }), { amount: -1.5, currency: 'USD' })
  assert.deepEqual(orderMoney({ currencyCode: 'KRW' }), { amount: 0, currency: 'KRW' })
  for (const value of [null, {}, { currencyCode: 'krw' }, { currencyCode: 'USD', units: '1.5' }, { currencyCode: 'USD', units: '1', nanos: -1 }, { currencyCode: 'USD', nanos: 1000000000 }, { currencyCode: 'USD', units: '9007199254740993' }]) assert.equal(orderMoney(value), null)
})

test('permission errors stop subsequent lookups and never expose order IDs in job errors', async () => {
  const state = job([document([row(), row({ id: `${orderId}2` }), row({ id: `${orderId}3` })])])
  let calls = 0
  await enrichGoogleOrderProceeds({ job: state, month: '2026-10', now, concurrency: 1, request: async () => { calls++; throw Object.assign(new Error(`private ${orderId}`), { code: 403 }) } })
  assert.equal(calls, 1)
  assert.match(state.errors.join(' '), /조회를 중단/)
  assert.ok(!state.errors.join(' ').includes(orderId))
  assert.equal(state.documents[0].googleOrderProceeds, undefined)
})

test('one failed lookup does not erase valid proceeds from another order', async () => {
  const state = job([document([row(), row({ id: `${orderId}2` })])])
  await enrichGoogleOrderProceeds({ job: state, month: '2026-10', now, request: async url => {
    if (url.endsWith(`${orderId}2`)) throw new Error('temporary provider failure')
    return response(order())
  } })
  assert.deepEqual(state.documents[0].googleOrderProceeds?.map(entry => entry.rowIndex), [0])
  assert.match(state.errors.join(' '), /1건 조회 실패/)
})

test('malformed reports and rows never silently produce zero proceeds', async () => {
  for (const report of [document([], { text: 'unexpected,header\nvalue,value' }), document([], { text: `${header}\n"unterminated` }), document([row({ timestamp: 0 })])]) {
    const { state, calls } = await run([report])
    assert.equal(calls, 0)
    assert.equal(report.googleOrderProceeds, undefined)
    assert.equal(state.errors.length, 1)
  }
})

test('bounded collection reports unqueried orders rather than filling them with zero', async () => {
  const state = job([document([row(), row({ id: `${orderId}2` })])])
  let calls = 0
  await enrichGoogleOrderProceeds({ job: state, month: '2026-10', now, maxOrders: 1, request: async () => { calls++; return response(order()) } })
  assert.equal(calls, 1)
  assert.equal(state.documents[0].googleOrderProceeds?.length, 1)
  assert.match(state.errors.join(' '), /1건.*범위를 넘어/)
})
