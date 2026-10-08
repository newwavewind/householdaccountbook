import { unzipSync, strFromU8 } from 'fflate'
import { addReportDocument, googleDocumentKey, googleEarningsPublicationWindow, missingGoogleReports, type ReportDocument } from './reportPolicy.js'

type GoogleReportJob = {
  documents: ReportDocument[]
  errors: string[]
  completed: string[]
  progress: string
}
type ReportResponse = Pick<Response, 'json' | 'arrayBuffer'>
const label = (kind: 'sales' | 'earnings') => kind === 'sales' ? '예상 매출' : '확정 수익'

export function pushGoogleZipDocuments(job: GoogleReportJob, month: string, kind: 'sales' | 'earnings', objectName: string, bytes: Uint8Array, source: 'api' | 'cache' = 'api') {
  let total = 0
  const files = unzipSync(bytes, { filter: f => {
    total += f.originalSize
    if (total > 25 * 1024 * 1024) throw new Error('Report too large')
    return /\.csv$/i.test(f.name)
  } })
  let count = 0
  for (const [name, contents] of Object.entries(files)) {
    const text = contents[0] === 0xff && contents[1] === 0xfe ? new TextDecoder('utf-16le').decode(contents) : strFromU8(contents)
    if (addReportDocument(job.documents, {
      key: googleDocumentKey(kind, objectName, name), name: `Google ${label(kind)} ${month}`,
      text, period: month, source, ...(source === 'api' ? { fetchedAt: new Date().toISOString() } : {}), periodKind: 'calendar',
    })) count++
  }
  return count
}

/** Only the report HTTP client and file-cache readers are injected. Normal sync
 * never opens a browser, runs a script, or changes provider permissions. */
export async function collectGoogleReports(options: {
  job: GoogleReportJob
  bucket: string
  months: string[]
  now?: Date
  request(url: string): Promise<ReportResponse>
  loadCaches(): void
  errorMessage(error: unknown): string
}): Promise<void> {
  const { job, bucket, months } = options
  const listedMonths = new Set<string>()
  if (!bucket) job.errors.push('Google 매출: 재무 보고서 버킷 ID가 없습니다. 저장된 보고서만 확인합니다.')
  if (bucket) for (const kind of ['sales', 'earnings'] as const) {
    let pageToken = '', count = 0
    try {
      do {
        const params = new URLSearchParams({ prefix: `${kind}/`, maxResults: '1000', ...(pageToken ? { pageToken } : {}) })
        const page = await (await options.request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${params}`)).json() as { items?: { name: string }[]; nextPageToken?: string }
        for (const item of page.items || []) {
          if (!item.name.endsWith('.zip')) continue
          const match = /(?:salesreport|earnings)_(20\d{2})(0[1-9]|1[0-2])/.exec(item.name)
          const month = match && `${match[1]}-${match[2]}`
          if (!month || !months.includes(month)) continue
          listedMonths.add(month)
          job.progress = `Google ${month} ${label(kind)} 확인 중`
          try {
            const bytes = new Uint8Array(await (await options.request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(item.name)}?alt=media`)).arrayBuffer())
            count += pushGoogleZipDocuments(job, month, kind, item.name, bytes)
          } catch (error) {
            job.errors.push(`Google ${month} ${label(kind)} 일부 보고서: ${options.errorMessage(error)}`)
          }
        }
        pageToken = page.nextPageToken || ''
      } while (pageToken)
    } catch (error) {
      job.errors.push(`Google ${label(kind)} 조회: ${options.errorMessage(error)}`)
    }
    if (count) job.completed.push(`Google ${label(kind)} ${count}개(스토어 조회)`)
  }
  // Fill individual report gaps even when another report/month was successful.
  options.loadCaches()
  const cached = job.documents.filter(d => d.key.startsWith('google:') && d.source === 'cache').length
  if (cached) job.errors.push(`Google 저장된 보고서 ${cached}개 사용 · 최신 여부를 확인하지 못했습니다. 스토어 조회 성공으로 처리하지 않습니다.`)
  const firstReportMonth = [...listedMonths, ...job.documents.filter(d => d.key.startsWith('google:')).map(d => d.period)].sort()[0]
  const gapMonths = firstReportMonth ? months.filter(month => month >= firstReportMonth) : months
  const earlierMonths = firstReportMonth ? months.filter(month => month < firstReportMonth) : []
  if (earlierMonths.length) job.completed.push(`안내 · Google ${earlierMonths[0]}~${earlierMonths[earlierMonths.length - 1]} 보고서는 확인되지 않았습니다. 최초 확인 보고서는 ${firstReportMonth}이며 이전 기간을 0원으로 확정하지 않습니다.`)
  for (const kind of ['sales', 'earnings'] as const) {
    const unavailable = missingGoogleReports(job.documents, gapMonths, kind)
    const pending = kind === 'earnings' ? unavailable.filter(month => googleEarningsPublicationWindow(month, options.now).pending) : []
    for (const month of pending) job.completed.push(`안내 · Google ${month} 확정 수익은 발행 대기 중입니다. 통상 ${googleEarningsPublicationWindow(month, options.now).expectedBy} 전후에 제공됩니다.`)
    const missing = unavailable.filter(month => !pending.includes(month))
    if (missing.length) job.errors.push(`Google ${label(kind)} ${missing.length}개월 미확인 (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ' 외' : ''}) · 미제공·생성 지연·조회 실패 여부를 확인해 주세요. 0원으로 확정하지 않습니다.`)
  }
}
