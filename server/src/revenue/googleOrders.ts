import type { ReportDocument } from './reportPolicy.js'

type OrderJob = { documents: ReportDocument[]; errors: string[]; completed: string[]; progress: string }
type OrderRow = { document: ReportDocument; rowIndex: number; currency: string; date: string; timestamp: number; status: string }
type Group = { packageName: string; orderId: string; rows: OrderRow[]; valid: boolean }
type OrderResponse = {
  orderId?: string; createTime?: string; lastEventTime?: string; state?: string; developerRevenueInBuyerCurrency?: unknown
  orderHistory?: {
    processedEvent?: { eventTime?: string }
    refundEvent?: { eventTime?: string }
    cancellationEvent?: { eventTime?: string }
    partialRefundEvents?: Array<{ createTime?: string; processTime?: string; state?: string }>
  }
}

/** Match the browser CSV parser: BOM/CRLF normalized, blank records omitted,
 * quoted delimiters/newlines preserved. Row indices exclude only the header. */
export function parseOrderReportTable(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const delimiter = source.split('\n')[0].includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < source.length; i++) {
    const character = source[i]
    if (character === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && (character === delimiter || character === '\n')) {
      row.push(cell.trim()); cell = ''
      if (character === '\n') { if (row.some(Boolean)) rows.push(row); row = [] }
    } else cell += character
  }
  if (quoted) throw new Error('Invalid CSV quoting')
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

export function orderMoney(value: unknown): { amount: number; currency: string } | null {
  if (!value || typeof value !== 'object') return null
  const money = value as { currencyCode?: unknown; units?: unknown; nanos?: unknown }
  if (typeof money.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(money.currencyCode)) return null
  const units = money.units ?? '0', nanos = money.nanos ?? 0
  if (typeof units !== 'string' || !/^-?\d+$/.test(units) || !Number.isSafeInteger(Number(units))) return null
  if (typeof nanos !== 'number' || !Number.isInteger(nanos) || Math.abs(nanos) > 999999999) return null
  if ((Number(units) > 0 && nanos < 0) || (Number(units) < 0 && nanos > 0)) return null
  const amount = Number(units) + nanos / 1e9
  return Number.isFinite(amount) && Math.abs(amount) <= 1e13 ? { amount, currency: money.currencyCode } : null
}

function permissionDenied(error: unknown): boolean {
  const status = error && typeof error === 'object' ? (error as { code?: unknown; status?: unknown }).code ?? (error as { status?: unknown }).status : null
  return status === 401 || status === 403
}

/** Report transaction dates are UTC, unlike the UI publication-wait calendar.
 * Validate the processed time: an order can be created before it is charged. */
function matchesCurrentOrder(order: OrderResponse, group: Group, month: string, now: Date): boolean {
  const created = Date.parse(order.createTime ?? '')
  const processed = Date.parse(order.orderHistory?.processedEvent?.eventTime ?? '')
  const inMonth = (value: string | undefined) => {
    const time = Date.parse(value ?? '')
    return Number.isFinite(time) && time >= processed && time <= now.getTime() && new Date(time).toISOString().slice(0, 7) === month
  }
  if (!Number.isFinite(created) || !Number.isFinite(processed) || created > processed || !inMonth(order.orderHistory?.processedEvent?.eventTime)) return false
  if (order.orderId !== group.orderId || !['PROCESSED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.state ?? '')) return false
  if (group.rows.some(row => row.timestamp !== Math.floor(processed / 1000) || row.date !== new Date(processed).toISOString().slice(0, 10))) return false
  if (order.lastEventTime && !inMonth(order.lastEventTime)) return false
  if (order.orderHistory?.cancellationEvent) return false
  const refund = order.orderHistory?.refundEvent
  if ((order.state === 'REFUNDED' && !refund) || (refund && !inMonth(refund.eventTime))) return false
  const partials = order.orderHistory?.partialRefundEvents ?? []
  if (order.state === 'PARTIALLY_REFUNDED' && !partials.length) return false
  return partials.every(event => event.state === 'PROCESSED_SUCCESSFULLY' && inMonth(event.createTime) && inMonth(event.processTime))
}

/** Enrich only live current-month sales. Earnings reports remain the settlement
 * authority; their proceeds must never be added to these order snapshots. */
export async function enrichGoogleOrderProceeds(options: {
  job: OrderJob
  month: string
  now?: Date
  concurrency?: number
  maxOrders?: number
  request(url: string, signal: AbortSignal): Promise<Pick<Response, 'json'>>
}): Promise<void> {
  const { job, month } = options
  const now = options.now ?? new Date()
  // Google transaction months are UTC. At Korea's month boundary the current
  // UTC report can still be the preceding calendar month for nine hours.
  if (month !== now.toISOString().slice(0, 7)) return
  if (job.documents.some(document => document.key.startsWith('google:earnings/') && document.period === month)) return
  const documents = job.documents.filter(document => document.source === 'api' && document.period === month && document.key.startsWith('google:sales/'))
  if (!documents.length) return
  const groups = new Map<string, Group>()
  let invalidRows = 0, invalidReports = 0
  for (const document of documents) {
    // A new live report must not inherit a previously collected order snapshot.
    delete document.googleOrderProceeds
    let table: string[][]
    try { table = parseOrderReportTable(document.text) } catch { invalidReports++; continue }
    const header = table[0]?.map(column => column.toLowerCase()) ?? []
    if (!['order number', 'order charged date', 'order charged timestamp', 'financial status', 'charged amount'].every(column => header.includes(column)) || !header.some(column => ['package id', 'product id'].includes(column)) || !header.some(column => ['currency of sale', 'buyer currency'].includes(column))) { invalidReports++; continue }
    const read = (row: string[], ...names: string[]) => names.map(name => row[header.indexOf(name.toLowerCase())] ?? '').find(Boolean) ?? ''
    for (const [rowIndex, row] of table.slice(1).entries()) {
      const status = read(row, 'Financial Status').toLowerCase()
      if (!['charged', 'refund', 'refunded', 'partial refund'].includes(status)) continue
      const packageName = read(row, 'Package ID', 'Product ID'), orderId = read(row, 'Order Number')
      if (!packageName || !orderId) { invalidRows++; continue }
      const key = `${packageName}\u0000${orderId}`
      const group = groups.get(key) ?? { packageName, orderId, rows: [], valid: true }
      const currency = read(row, 'Currency of Sale', 'Buyer Currency'), date = read(row, 'Order Charged Date')
      const chargedTimestamp = read(row, 'Order Charged Timestamp'), timestamp = Number(chargedTimestamp)
      const chargedAmount = read(row, 'Charged Amount').replaceAll(',', '')
      if (!/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(packageName) || !/^GPA\.[0-9.\-]+$/.test(orderId) || orderId.length > 128 || !/^[A-Z]{3}$/.test(currency) || !validDate(date) || date.slice(0, 7) !== month || !/^\d{10}$/.test(chargedTimestamp) || !Number.isSafeInteger(timestamp) || !chargedAmount || !Number.isFinite(Number(chargedAmount))) group.valid = false
      group.rows.push({ document, rowIndex, currency, date, timestamp, status })
      groups.set(key, group)
    }
  }
  const allGroups = [...groups.values()]
  const candidates = allGroups.filter(group => group.valid && group.rows.some(row => row.status === 'charged') && group.rows.every(row => row.currency === group.rows[0].currency))
  let unverified = allGroups.length - candidates.length, failed = 0, succeeded = 0, cursor = 0, denied = false
  const limit = Math.max(1, Math.min(options.maxOrders ?? 500, 1000))
  const pending = candidates.slice(0, limit)
  const workers = Math.max(1, Math.min(options.concurrency ?? 2, 4))
  await Promise.all(Array.from({ length: Math.min(workers, pending.length) }, async () => {
    while (!denied && cursor < pending.length) {
      const group = pending[cursor++]
      job.progress = `Google ${month} 주문별 수익 확인 중 (${succeeded + failed + unverified}/${allGroups.length})`
      try {
        const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(group.packageName)}/orders/${encodeURIComponent(group.orderId)}`
        const order = await (await options.request(url, AbortSignal.timeout(15000))).json() as OrderResponse
        const money = orderMoney(order.developerRevenueInBuyerCurrency)
        if (!matchesCurrentOrder(order, group, month, now) || !money || group.rows.some(row => row.currency !== money.currency)) {
          unverified++
          continue
        }
        const fetchedAt = new Date().toISOString()
        const target = group.rows.find(row => row.status === 'charged')!
        // This is already net of partial/full refunds, fees and tax. Apply it
        // exactly once across every matching CSV row, including refund rows.
        group.rows.forEach(row => {
          ;(row.document.googleOrderProceeds ??= []).push({ rowIndex: row.rowIndex, proceeds: row === target ? money.amount : 0, currency: money.currency, fetchedAt })
        })
        succeeded++
      } catch (error) {
        failed++
        if (permissionDenied(error)) denied = true
      }
    }
  }))
  if (succeeded) job.completed.push(`Google 주문별 수익 ${succeeded}건 반영(스토어 조회)`)
  if (invalidReports || invalidRows) job.errors.push(`Google 주문 수익: 보고서 ${invalidReports}개·행 ${invalidRows}개 형식 확인이 필요합니다.`)
  if (unverified) job.errors.push(`Google 주문 수익 ${unverified}건은 기간·통화·상태를 확인하지 못해 미반영했습니다.`)
  if (failed || denied) job.errors.push(`Google 주문 수익 ${failed}건 조회 실패${denied ? ' · 인증·권한 오류로 나머지 조회를 중단했습니다.' : ' · 다시 동기화하면 재시도합니다.'}`)
  if (candidates.length > limit) job.errors.push(`Google 주문 수익 ${candidates.length - limit}건은 한 번에 조회할 수 있는 범위를 넘어 미반영했습니다.`)
}
