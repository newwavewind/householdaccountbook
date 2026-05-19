import type { CommunityComment } from './types'

const STORAGE_KEY = 'gaegyeobu-community-mock-comments-v1'

export function readMockComments(): CommunityComment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as CommunityComment[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function writeMockComments(comments: CommunityComment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(comments))
}
