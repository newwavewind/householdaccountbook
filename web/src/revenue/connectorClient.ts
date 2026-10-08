import { getCommunitySupabase } from '../lib/communitySupabaseClient'
import { connectorDownMessage } from './syncHelpers'

async function accessToken(): Promise<string | null> {
  const client = getCommunitySupabase()
  if (!client) return null
  const { data } = await client.auth.getSession()
  return data.session?.access_token || null
}

/** Production uses same-origin Vercel API; GitHub Pages points at Vercel. */
export function revenueApiBase(): string {
  const configured = import.meta.env.VITE_REVENUE_API_BASE
  if (typeof configured === 'string' && configured.trim()) {
    return configured.replace(/\/$/, '')
  }
  // Pages(/householdaccountbook/) has no serverless API — use Vercel backend.
  const base = import.meta.env.BASE_URL || '/'
  if (base !== '/' && typeof window !== 'undefined') {
    return 'https://householdaccountbook.vercel.app/api/app-revenue'
  }
  return '/api/app-revenue'
}

export function isRevenueCloudMode(): boolean {
  return import.meta.env.PROD || import.meta.env.VITE_REVENUE_CLOUD === 'true'
}

export async function revenueFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers || {})
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = await accessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`${revenueApiBase()}${path}`, {
      ...init,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(45000),
    })
  } catch {
    throw new Error(
      isRevenueCloudMode()
        ? '클라우드 동기화 서버에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.'
        : connectorDownMessage(),
    )
  }

  if (res.status === 401) {
    throw new Error(
      isRevenueCloudMode()
        ? '동기화하려면 로그인이 필요합니다.'
        : connectorDownMessage(401),
    )
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (body?.error) throw new Error(body.error)
    if (isRevenueCloudMode()) {
      throw new Error(
        res.status === 404
          ? '동기화 API 경로를 찾지 못했습니다. 배포를 새로고침한 뒤 다시 시도해 주세요.'
          : `클라우드 동기화 요청이 실패했습니다. (${res.status})`,
      )
    }
    throw new Error(res.status === 502 || res.status === 504 ? connectorDownMessage(res.status) : `동기화 요청을 처리하지 못했습니다. (${res.status}) 데이터 관리에서 연결 상태를 확인해 주세요.`)
  }
  return res.json() as Promise<T>
}
