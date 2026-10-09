export type ReportDocument = {
  key: string
  name: string
  text: string
  period: string
  source?: 'api' | 'cache'
  fetchedAt?: string
  sourceUpdatedAt?: string
  periodKind?: 'calendar' | 'fiscal'
  googleOrderProceeds?: Array<{ rowIndex: number; proceeds: number; currency: string; fetchedAt: string }>
}

const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/

// The owner confirmed that this account's apps launched in 2026. Keep a
// conservative January floor; the first downloaded report is not a launch date.
export const REVENUE_HISTORY_FLOOR = '2026-01'

export function revenueHistoryFrom(configured: unknown): string {
  const value = typeof configured === 'string' ? configured.trim() : ''
  return MONTH.test(value) && value >= REVENUE_HISTORY_FLOOR ? value : REVENUE_HISTORY_FLOOR
}

export function currentMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).formatToParts(now)
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`
}

/** Validate once, before starting a job or requesting any provider data. */
export function syncMonths(input: unknown, todayMonth: string, historyFrom: string): string[] {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const scope = body.scope ?? 'month'
  if (scope !== 'month' && scope !== 'all' && scope !== 'range') throw new Error('동기화 범위를 확인해 주세요.')
  if (scope === 'month') {
    const month = body.month ?? todayMonth
    if (typeof month !== 'string' || !MONTH.test(month) || month > todayMonth) throw new Error('동기화할 월을 확인해 주세요.')
    if (month < REVENUE_HISTORY_FLOOR) throw new Error('앱 출시 연도인 2026년 1월부터 동기화할 수 있습니다.')
    return [month]
  }
  const requestedFrom = body.from ?? (scope === 'all' ? revenueHistoryFrom(historyFrom) : undefined)
  const to = body.to ?? todayMonth
  if (typeof requestedFrom !== 'string' || !MONTH.test(requestedFrom) || requestedFrom > todayMonth) throw new Error('동기화 시작 월을 확인해 주세요.')
  if (typeof to !== 'string' || !MONTH.test(to) || to > todayMonth || requestedFrom > to) throw new Error('동기화 종료 월을 확인해 주세요.')
  if (to < REVENUE_HISTORY_FLOOR) throw new Error('앱 출시 연도인 2026년 1월부터 동기화할 수 있습니다.')
  const from = requestedFrom < REVENUE_HISTORY_FLOOR ? REVENUE_HISTORY_FLOOR : requestedFrom
  const months: string[] = []
  for (let year = Number(from.slice(0, 4)), month = Number(from.slice(5)); ; ) {
    const value = `${year}-${String(month).padStart(2, '0')}`
    if (value > to) break
    months.push(value)
    if (++month > 12) { month = 1; year++ }
  }
  return months
}

/** A downloaded report keeps its identity when served from a local or bundled cache. */
export function googleDocumentKey(kind: 'sales' | 'earnings', objectName: string, csvName: string): string {
  const base = (value: string) => value.replace(/\\/g, '/').split('/').pop() || value
  return `google:${kind}/${base(objectName)}:${csvName.replace(/\\/g, '/').replace(/^\.\//, '')}`
}

/** Live reports win; fallbacks can fill gaps but cannot add the same report twice. */
export function addReportDocument(documents: ReportDocument[], document: ReportDocument): boolean {
  const index = documents.findIndex(d => d.key === document.key)
  if (index < 0) { documents.push(document); return true }
  if (document.source === 'api' && documents[index].source !== 'api') {
    documents[index] = document
    return true
  }
  return false
}

export function missingGoogleReports(documents: ReportDocument[], months: string[], kind: 'sales' | 'earnings'): string[] {
  const found = new Set(documents.filter(d => d.key.startsWith(`google:${kind}/`)).map(d => d.period))
  return months.filter(month => !found.has(month))
}

/** Google earnings contains the prior month's transactions and is normally
 * published by the fifth of the following month. The UI waiting deadline uses
 * the app's Korean calendar; transaction dates remain UTC. */
export function googleEarningsPublicationWindow(month: string, now = new Date()): { pending: boolean; expectedBy: string } {
  if (!MONTH.test(month)) throw new Error('Invalid earnings month')
  const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 5))
  const expectedBy = nextMonth.toISOString().slice(0, 10)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const today = `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`
  return { pending: today <= expectedBy, expectedBy }
}

/** No observed report proves a zero-revenue period. Summarize earlier unknown
 * history as information while keeping gaps after known activity actionable. */
export function partitionMissingReportMonths(missing: string[], observed: string[]): { beforeFirst: string[]; gaps: string[] } {
  const first = [...observed].sort()[0]
  return {
    beforeFirst: first ? missing.filter(month => month < first) : [],
    gaps: first ? missing.filter(month => month >= first) : missing,
  }
}

/** Apple keeps monthly sales for one year after publication. Keep the extra
 * boundary month because publication happens after the month has ended. */
export function appleMonthlyRetentionFrom(todayMonth: string): string {
  const date = new Date(Date.UTC(Number(todayMonth.slice(0, 4)), Number(todayMonth.slice(5)) - 1 - 13, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Keep permissions independent: sales and finance can use different Apple keys. */
export async function collectApplePeriods(options: {
  months: string[]
  todayMonth: string
  oldestSalesMonth?: string
  includePreviousFinanceForCurrent?: boolean
  skippedSales?(month: string): void
  monthly(month: string): Promise<void>
  finance(month: string): Promise<void>
  daily(month: string): Promise<void>
  failed(kind: 'sales' | 'finance', month: string, error: unknown): void
  denied(error: unknown): boolean
}): Promise<void> {
  let salesDenied = false, financeDenied = false
  for (const month of options.months) {
    if (month < REVENUE_HISTORY_FLOOR || month >= options.todayMonth) continue
    if (options.oldestSalesMonth && month < options.oldestSalesMonth) options.skippedSales?.(month)
    else if (!salesDenied) {
      try { await options.monthly(month) }
      catch (error) { options.failed('sales', month, error); salesDenied = options.denied(error) }
    }
    if (!financeDenied) {
      try { await options.finance(month) }
      catch (error) { options.failed('finance', month, error); financeDenied = options.denied(error) }
    }
  }
  if (options.todayMonth >= REVENUE_HISTORY_FLOOR && options.months.includes(options.todayMonth)) {
    // A current-month-only request still needs the last closed fiscal boundary
    // to fetch the preceding calendar month's unsettled daily tail.
    const previousMonth = new Date(Date.parse(`${options.todayMonth}-01T00:00:00Z`) - 86400000).toISOString().slice(0, 7)
    if (options.includePreviousFinanceForCurrent && previousMonth >= REVENUE_HISTORY_FLOOR && !options.months.includes(previousMonth) && !financeDenied) {
      try { await options.finance(previousMonth) }
      catch (error) { options.failed('finance', previousMonth, error) }
    }
    if (!salesDenied) await options.daily(options.todayMonth)
  }
}
