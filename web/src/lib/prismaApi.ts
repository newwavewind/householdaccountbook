const TOKEN_KEY = 'gaegyeobu-prisma-api-token'

export function getPrismaApiToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setPrismaApiToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY)
    else localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getPrismaApiToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`/api${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = text || res.statusText
    try {
      const j = JSON.parse(text) as { error?: string }
      if (typeof j.error === 'string' && j.error.length > 0) msg = j.error
    } catch {
      /* use msg as-is */
    }
    throw new Error(msg)
  }
  return res
}
