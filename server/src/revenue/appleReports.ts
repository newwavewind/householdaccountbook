import { gunzipSync } from 'node:zlib'
import { REVENUE_HISTORY_FLOOR } from './reportPolicy.js'

type Frequency = 'DAILY' | 'MONTHLY'

type DateRange = { start: string; end: string }
const DAY_MS = 86400000

function isoDate(value: string): string | null {
  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  const date = us ? `${us[3]}-${us[1]}-${us[2]}` : value
  if (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}

/** Read only actual fiscal bounds, never infer them from the filename month.
 * Consolidated files can repeat/reorder transaction headers and add summaries.
 * Conflicting ranges cannot establish one authoritative closed period. */
export function appleFinancialReportRange(text: string): DateRange | null {
  let startIndex = -1, endIndex = -1
  const ranges = new Map<string, DateRange>()
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const cells = line.split('\t').map(cell => cell.trim())
    const names = cells.map(cell => cell.toLowerCase().replace(/[^a-z]/g, ''))
    if (names.includes('startdate') && names.includes('enddate')) {
      startIndex = names.indexOf('startdate'); endIndex = names.indexOf('enddate')
      continue
    }
    if (startIndex < 0 || endIndex < 0) continue
    const start = isoDate(cells[startIndex] ?? ''), end = isoDate(cells[endIndex] ?? '')
    if (!start || !end || start > end) continue
    ranges.set(`${start}:${end}`, { start, end })
  }
  return ranges.size === 1 ? [...ranges.values()][0] : null
}

/** Bridge the open fiscal period across calendar boundaries. Monthly sales
 * remain useful for calendar totals but cannot isolate this unsettled tail.
 * A stale finance report must not trigger hundreds of daily provider requests. */
export function appleDailyReportDates(options: {
  month: string; today: string; financialRanges: DateRange[]; maxDays?: number
}): { dates: string[]; omitted?: DateRange } {
  const { month, today } = options
  if (!isoDate(`${month}-01`) || !isoDate(today)) throw new Error('Invalid daily report period')
  const todayTime = Date.parse(`${today}T00:00:00Z`)
  const latest = options.financialRanges.filter(range => isoDate(range.start) && isoDate(range.end) && range.start <= range.end && range.end < today).map(range => range.end).sort().at(-1)
  const afterFinance = latest ? new Date(Date.parse(`${latest}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10) : `${month}-01`
  const launchDate = `${REVENUE_HISTORY_FLOOR}-01`
  const requestedStart = afterFinance < launchDate ? launchDate : afterFinance
  const maxDays = Math.max(1, Math.min(options.maxDays ?? 62, 62))
  const earliest = new Date(todayTime - maxDays * DAY_MS).toISOString().slice(0, 10)
  const start = requestedStart < earliest ? earliest : requestedStart
  const dates: string[] = []
  for (let time = Date.parse(`${start}T00:00:00Z`); time < todayTime; time += DAY_MS) dates.push(new Date(time).toISOString().slice(0, 10))
  return {
    dates,
    ...(requestedStart < earliest ? { omitted: { start: requestedStart, end: new Date(Date.parse(`${earliest}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10) } } : {}),
  }
}

/** Finance uses Apple's fiscal year and period number (October = period 01),
 * unlike Sales and Trends' calendar dates. For example, calendar September
 * 2026 is fiscal 2026-12, not fiscal 2026-09 (June). */
export function appleFiscalPeriod(calendarMonth: string): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(calendarMonth)) throw new Error('Invalid finance calendar month')
  const year = Number(calendarMonth.slice(0, 4)), month = Number(calendarMonth.slice(5))
  return `${year + (month >= 10 ? 1 : 0)}-${String((month + 2) % 12 + 1).padStart(2, '0')}`
}

export function appleFinanceReportUrl(calendarMonth: string, vendor: string): string {
  const params = new URLSearchParams({
    'filter[reportDate]': appleFiscalPeriod(calendarMonth),
    'filter[reportType]': 'FINANCIAL',
    'filter[regionCode]': 'ZZ',
    'filter[vendorNumber]': vendor,
  })
  return `https://api.appstoreconnect.apple.com/v1/financeReports?${params}`
}

async function readAppleReport(response: Pick<Response, 'arrayBuffer'>): Promise<string> {
  const bytes = Buffer.from(await response.arrayBuffer())
  return bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: 25 * 1024 * 1024 }).toString('utf8') : bytes.toString('utf8')
}

/** Apple's endpoint validates the frequency/date combination, despite the
 * general API reference describing YYYY-MM-DD for every frequency. */
export function appleSalesReportUrl(frequency: Frequency, date: string, vendor: string): string {
  const format = frequency === 'MONTHLY' ? /^20\d{2}-(0[1-9]|1[0-2])$/ : /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
  if (!format.test(date)) throw new Error(`Invalid ${frequency} sales report date`)
  const params = new URLSearchParams({
    'filter[frequency]': frequency,
    'filter[reportDate]': date,
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[vendorNumber]': vendor,
    'filter[version]': '1_0',
  })
  return `https://api.appstoreconnect.apple.com/v1/salesReports?${params}`
}

export async function downloadAppleSalesReport(options: {
  frequency: Frequency
  date: string
  vendor: string
  request(url: string): Promise<Pick<Response, 'arrayBuffer'>>
}): Promise<string> {
  return readAppleReport(await options.request(appleSalesReportUrl(options.frequency, options.date, options.vendor)))
}

export async function downloadAppleFinanceReport(options: {
  calendarMonth: string
  vendor: string
  request(url: string): Promise<Pick<Response, 'arrayBuffer'>>
}): Promise<string> {
  // Return the original TSV including actual Start Date / End Date fields;
  // consumers retain those bounds rather than assuming calendar boundaries.
  return readAppleReport(await options.request(appleFinanceReportUrl(options.calendarMonth, options.vendor)))
}
