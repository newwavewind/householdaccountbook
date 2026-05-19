import { postBodyToPlainText } from '../lib/communityPostHtml'
import {
  CONCEPT_LIKE_THRESHOLD,
  type CommunityBoardTab,
  type CommunityPageSize,
  type CommunitySearchScope,
} from './boardConstants'
import type { CommunityPost } from './types'

export type PostListQueryInput = {
  tab: CommunityBoardTab
  page: number
  pageSize: CommunityPageSize
  search: string
  searchScope: CommunitySearchScope
}

export type PostListQueryResult = {
  items: CommunityPost[]
  total: number
}

function matchesTab(post: CommunityPost, tab: CommunityBoardTab): boolean {
  if (tab === 'notice') return !!post.isNotice
  if (tab === 'concept') {
    return !post.isNotice && post.likeCount >= CONCEPT_LIKE_THRESHOLD
  }
  return true
}

function matchesSearch(
  post: CommunityPost,
  search: string,
  scope: CommunitySearchScope,
): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const inTitle = post.title.toLowerCase().includes(q)
  const inBody = postBodyToPlainText(post.body).toLowerCase().includes(q)
  if (scope === 'title') return inTitle
  if (scope === 'content') return inBody
  return inTitle || inBody
}

function sortForBoard(posts: CommunityPost[], tab: CommunityBoardTab): CommunityPost[] {
  return [...posts].sort((a, b) => {
    if (tab === 'all') {
      if (a.isNotice !== b.isNotice) return a.isNotice ? -1 : 1
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function queryPostList(
  posts: CommunityPost[],
  input: PostListQueryInput,
): PostListQueryResult {
  const filtered = sortForBoard(
    posts.filter((p) =>
      matchesTab(p, input.tab) && matchesSearch(p, input.search, input.searchScope),
    ),
    input.tab,
  )
  const total = filtered.length
  const page = Math.max(1, input.page)
  const start = (page - 1) * input.pageSize
  const slice = filtered.slice(start, start + input.pageSize)
  const items = slice.map((post, index) => ({
    ...post,
    listNumber: total - start - index,
  }))
  return { items, total }
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
