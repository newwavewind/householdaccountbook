import { getCommunitySupabase } from '../lib/communitySupabaseClient'
import { connectorDownMessage } from './syncHelpers'

async function accessToken(): Promise<string | null> {
  const client = getCommunitySupabase()
  if (!client) return null
  const { data } = await client.auth.getSession()
  return data.session?.access_token || null
}

/** Production uses same-origin Vercel API; local Vite proxies to the desktop connector. */
export function revenueApiBase(): string {
  const configured = import.meta.env.VITE_REVENUE_API_BASE
  if (typeof configured === 'string' && configured.trim()) return configured.replace(/\/$/, '')
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
    throw new Error(body?.error || connectorDownMessage(res.status))
  }
  return res.json() as Promise<T>
}
