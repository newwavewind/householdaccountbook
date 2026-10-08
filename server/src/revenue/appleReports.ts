import { gunzipSync } from 'node:zlib'

type Frequency = 'DAILY' | 'MONTHLY'

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
