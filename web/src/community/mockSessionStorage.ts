const STORAGE_KEY = 'gaegyeobu-community-mock-session-v1'

export type MockRole = 'user' | 'admin'

export type MockSession = {
  userId: string
  email: string
  displayName: string
  avatarUrl?: string
  role: MockRole
}

export function readMockSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as MockSession
    if (!v?.userId || !v?.email || !v?.displayName || !v?.role) return null
    return v
  } catch {
    return null
  }
}

export function writeMockSession(s: MockSession | null) {
  if (!s) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
