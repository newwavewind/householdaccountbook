import type { RevenueJob } from './jobs.js'

/** Use only the country dimension: combining dimensions would count installs repeatedly. */
export async function collectGoogleInstalls(options: {
  job: Pick<RevenueJob, 'documents' | 'errors' | 'completed' | 'progress'>
  bucket: string
  month: string
  packages: string[]
  request(url: string): Promise<Pick<Response, 'json' | 'arrayBuffer'>>
  errorMessage(error: unknown): string
}) {
  const {job, bucket, month, packages} = options
  if (!bucket) return
  const found = new Set<string>()
  let pageToken = ''
  try {
    do {
      const params = new URLSearchParams({prefix: 'stats/installs/', maxResults: '1000', ...(pageToken ? {pageToken} : {})})
      const page = await (await options.request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${params}`)).json() as {items?: {name: string}[]; nextPageToken?: string}
      for (const item of page.items || []) {
        const match = /^stats\/installs\/installs_(.+)_(20\d{2})(0[1-9]|1[0-2])_country\.csv$/.exec(item.name)
        if (!match || `${match[2]}-${match[3]}` !== month || !packages.includes(match[1]) || found.has(match[1])) continue
        job.progress = `Google ${month} 앱 설치 통계 확인 중`
        try {
          const bytes = new Uint8Array(await (await options.request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(item.name)}?alt=media`)).arrayBuffer())
          if (bytes.length > 25 * 1024 * 1024) throw new Error('Report too large')
          const text = new TextDecoder(bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8').decode(bytes)
          job.documents.push({key: `google-installs:${match[1]}:${month}`, name: `Google 앱 설치 ${match[1]} ${month}`, text, period: month, source:'api', fetchedAt:new Date().toISOString(), periodKind:'calendar'})
          found.add(match[1])
        } catch (error) { job.errors.push(`Google 설치 통계 ${match[1]}: ${options.errorMessage(error)}`) }
      }
      pageToken = page.nextPageToken || ''
    } while (pageToken)
    if (found.size) job.completed.push(`Google 앱 설치 통계 ${found.size}개`)
    if (found.size < packages.length) job.errors.push(`Google ${month} 설치 통계 ${packages.length-found.size}개 앱 미확인 · 설치 수를 0으로 간주하지 않습니다.`)
  } catch (error) { job.errors.push(`Google 설치 통계 조회: ${options.errorMessage(error)}`) }
}
