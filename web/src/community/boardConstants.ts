export type CommunityBoardTab = 'all' | 'concept' | 'notice'

export type CommunitySearchScope = 'title' | 'content' | 'both'

export const COMMUNITY_SEARCH_SCOPES: { value: CommunitySearchScope; label: string }[] = [
  { value: 'both', label: '제목+내용' },
  { value: 'title', label: '제목' },
  { value: 'content', label: '내용' },
]

export const COMMUNITY_PAGE_SIZES = [10, 30, 50, 100] as const
export type CommunityPageSize = (typeof COMMUNITY_PAGE_SIZES)[number]

export const DEFAULT_COMMUNITY_PAGE_SIZE: CommunityPageSize = 30

/** 개념글: 추천(좋아요) 수 기준 */
export const CONCEPT_LIKE_THRESHOLD = 5

export function parsePageSize(raw: string | null): CommunityPageSize {
  const n = Number(raw)
  if (COMMUNITY_PAGE_SIZES.includes(n as CommunityPageSize)) {
    return n as CommunityPageSize
  }
  return DEFAULT_COMMUNITY_PAGE_SIZE
}

export function parseBoardTab(raw: string | null): CommunityBoardTab {
  if (raw === 'concept' || raw === 'notice') return raw
  return 'all'
}

export function parseSearchScope(raw: string | null): CommunitySearchScope {
  if (raw === 'title' || raw === 'content') return raw
  return 'both'
}
