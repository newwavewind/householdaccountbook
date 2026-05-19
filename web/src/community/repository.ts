import type { SupabaseClient } from '@supabase/supabase-js'
import type { CommunityPost, CommunityComment } from './types'
import {
  CONCEPT_LIKE_THRESHOLD,
  DEFAULT_COMMUNITY_PAGE_SIZE,
  type CommunityBoardTab,
  type CommunityPageSize,
  type CommunitySearchScope,
} from './boardConstants'
import { queryPostList, type PostListQueryInput } from './postListQuery'
import { communityBackendMode, type CommunityBackendMode } from '../lib/communityBackend'
import { getCommunitySupabase } from '../lib/communitySupabaseClient'
import { apiFetch, getPrismaApiToken } from '../lib/prismaApi'
import {
  cloneSeedPosts,
  readMockPosts,
  writeMockPosts,
} from './mockPostStorage'
import {
  mockCountVotes,
  mockIsDisliked,
  mockIsLiked,
  mockToggleDislike,
  mockToggleLike,
} from './mockVoteStorage'
import type { MockSession } from './mockSessionStorage'

export type ListPostsOptions = {
  includeHidden: boolean
  tab?: CommunityBoardTab
  page?: number
  pageSize?: CommunityPageSize
  search?: string
  searchScope?: CommunitySearchScope
}

export type CommunityPostListResult = {
  items: CommunityPost[]
  total: number
}

export interface CommunityRepository {
  listPosts(opts: ListPostsOptions): Promise<CommunityPostListResult>
  getPost(id: string, opts?: ListPostsOptions): Promise<CommunityPost | null>
  createPost(input: {
    title: string
    body: string
    authorId: string
    authorDisplayName: string
  }): Promise<CommunityPost>
  updatePost(
    id: string,
    input: { title: string; body: string },
  ): Promise<void>
  deletePost(id: string): Promise<void>
  setHidden(id: string, hidden: boolean): Promise<void>
  setNotice(id: string, isNotice: boolean): Promise<void>
  listComments(postId: string): Promise<CommunityComment[]>
  addComment(input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment>
  deleteComment(id: string): Promise<void>
  toggleLike(postId: string, userId: string): Promise<{ liked: boolean; disliked: boolean }>
  toggleDislike(postId: string, userId: string): Promise<{ liked: boolean; disliked: boolean }>
  isLiked(postId: string, userId: string): Promise<boolean>
  isDisliked(postId: string, userId: string): Promise<boolean>
  getVoteCounts(postId: string): Promise<{ likeCount: number; dislikeCount: number }>
  recordView(postId: string): Promise<void>
}

function mapSupabaseRow(row: {
  id: string
  author_id: string
  author_display_name: string
  title: string
  body: string
  hidden: boolean
  is_notice?: boolean
  created_at: string
  updated_at: string
  like_count?: number
  dislike_count?: number
  comment_count?: number
  view_count?: number
  today_view_count?: number
}): CommunityPost {
  return {
    id: row.id,
    authorId: row.author_id,
    authorDisplayName: row.author_display_name,
    title: row.title,
    body: row.body,
    hidden: row.hidden,
    isNotice: row.is_notice ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    likeCount: row.like_count ?? 0,
    dislikeCount: row.dislike_count ?? 0,
    commentCount: row.comment_count ?? 0,
    viewCount: row.view_count ?? 0,
    todayViewCount: row.today_view_count ?? 0,
  }
}

function listQueryFromOpts(opts: ListPostsOptions): PostListQueryInput | null {
  if (opts.page == null && opts.pageSize == null && !opts.tab && !opts.search) {
    return null
  }
  return {
    tab: opts.tab ?? 'all',
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? DEFAULT_COMMUNITY_PAGE_SIZE,
    search: opts.search ?? '',
    searchScope: opts.searchScope ?? 'both',
  }
}

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

function mapCommentRow(row: {
  id: string
  post_id: string
  author_id: string | null
  author_display_name: string
  body: string
  created_at: string
}): CommunityComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorDisplayName: row.author_display_name,
    body: row.body,
    createdAt: row.created_at,
  }
}

function enrichMockVotes(post: CommunityPost): CommunityPost {
  const counts = mockCountVotes(post.id)
  return { ...post, likeCount: counts.likeCount, dislikeCount: counts.dislikeCount }
}

class MockCommunityRepository implements CommunityRepository {
  private session: MockSession | null

  constructor(session: MockSession | null) {
    this.session = session
  }

  async listPosts(opts: ListPostsOptions): Promise<CommunityPostListResult> {
    const list = readMockPosts().map(enrichMockVotes)
    const admin = this.session?.role === 'admin'
    const mine = this.session?.userId
    const visible = list.filter((p) => {
      if (!p.hidden) return true
      if (!opts.includeHidden) return false
      if (admin) return true
      if (mine && p.authorId === mine) return true
      return false
    })
    const query = listQueryFromOpts(opts)
    if (!query) {
      const sorted = [...visible].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      return { items: sorted, total: sorted.length }
    }
    return queryPostList(visible, query)
  }

  async getPost(
    id: string,
    _opts?: ListPostsOptions,
  ): Promise<CommunityPost | null> {
    void _opts
    const list = readMockPosts().map(enrichMockVotes)
    const post = list.find((p) => p.id === id)
    if (!post) return null
    const admin = this.session?.role === 'admin'
    const mine = this.session?.userId
    if (!post.hidden) return post
    if (mine && post.authorId === mine) return post
    if (admin) return post
    return null
  }

  async createPost(input: {
    title: string
    body: string
    authorId: string
    authorDisplayName: string
  }): Promise<CommunityPost> {
    const list = readMockPosts()
    const now = new Date().toISOString()
    const post: CommunityPost = {
      id: crypto.randomUUID(),
      authorId: input.authorId,
      authorDisplayName: input.authorDisplayName,
      title: input.title.trim(),
      body: input.body,
      hidden: false,
      isNotice: false,
      createdAt: now,
      updatedAt: now,
      likeCount: 0,
      dislikeCount: 0,
      commentCount: 0,
      viewCount: 0,
      todayViewCount: 0,
    }
    writeMockPosts([post, ...list])
    return post
  }

  private syncMockVoteCounts(postId: string): void {
    const counts = mockCountVotes(postId)
    const list = readMockPosts()
    const i = list.findIndex((p) => p.id === postId)
    if (i === -1) return
    list[i] = {
      ...list[i],
      likeCount: counts.likeCount,
      dislikeCount: counts.dislikeCount,
    }
    writeMockPosts(list)
  }

  async updatePost(id: string, input: { title: string; body: string }) {
    const list = readMockPosts()
    const i = list.findIndex((p) => p.id === id)
    if (i === -1) throw new Error('글을 찾을 수 없습니다.')
    list[i] = {
      ...list[i],
      title: input.title.trim(),
      body: input.body,
      updatedAt: new Date().toISOString(),
    }
    writeMockPosts(list)
  }

  async deletePost(id: string) {
    writeMockPosts(readMockPosts().filter((p) => p.id !== id))
  }

  async setHidden(id: string, hidden: boolean) {
    const list = readMockPosts()
    const i = list.findIndex((p) => p.id === id)
    if (i === -1) throw new Error('글을 찾을 수 없습니다.')
    list[i] = { ...list[i], hidden, updatedAt: new Date().toISOString() }
    writeMockPosts(list)
  }

  async setNotice(id: string, isNotice: boolean) {
    const list = readMockPosts()
    const i = list.findIndex((p) => p.id === id)
    if (i === -1) throw new Error('글을 찾을 수 없습니다.')
    list[i] = { ...list[i], isNotice, updatedAt: new Date().toISOString() }
    writeMockPosts(list)
  }

  async listComments(_postId: string): Promise<CommunityComment[]> { return [] }
  async addComment(input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment> {
    return { id: crypto.randomUUID(), postId: input.postId, authorId: input.authorId, authorDisplayName: input.authorDisplayName, body: input.body, createdAt: new Date().toISOString() }
  }
  async deleteComment(_id: string): Promise<void> {}
  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; disliked: boolean }> {
    const result = mockToggleLike(postId, userId)
    this.syncMockVoteCounts(postId)
    return result
  }

  async toggleDislike(postId: string, userId: string): Promise<{ liked: boolean; disliked: boolean }> {
    const result = mockToggleDislike(postId, userId)
    this.syncMockVoteCounts(postId)
    return result
  }

  async isLiked(postId: string, userId: string): Promise<boolean> {
    return mockIsLiked(postId, userId)
  }

  async isDisliked(postId: string, userId: string): Promise<boolean> {
    return mockIsDisliked(postId, userId)
  }

  async getVoteCounts(postId: string): Promise<{ likeCount: number; dislikeCount: number }> {
    return mockCountVotes(postId)
  }

  async recordView(_postId: string): Promise<void> {}
}

class ApiCommunityRepository implements CommunityRepository {
  async listPosts(opts: ListPostsOptions): Promise<CommunityPostListResult> {
    const q = new URLSearchParams()
    if (opts.tab && opts.tab !== 'all') q.set('tab', opts.tab)
    if (opts.page != null) q.set('page', String(opts.page))
    if (opts.pageSize != null) q.set('pageSize', String(opts.pageSize))
    if (opts.search) q.set('search', opts.search)
    if (opts.searchScope && opts.searchScope !== 'both') {
      q.set('searchScope', opts.searchScope)
    }
    if (opts.includeHidden) q.set('includeHidden', '1')
    const qs = q.toString()
    const res = await apiFetch(`/posts${qs ? `?${qs}` : ''}`)
    return (await res.json()) as CommunityPostListResult
  }

  async getPost(
    id: string,
    _opts?: ListPostsOptions,
  ): Promise<CommunityPost | null> {
    void _opts
    const token = getPrismaApiToken()
    const headers = new Headers()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { headers })
    if (res.status === 404) return null
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || res.statusText)
    }
    return (await res.json()) as CommunityPost
  }

  async createPost(input: {
    title: string
    body: string
    authorId: string
    authorDisplayName: string
  }): Promise<CommunityPost> {
    void input.authorId
    void input.authorDisplayName
    const res = await apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify({ title: input.title, body: input.body }),
    })
    return (await res.json()) as CommunityPost
  }

  async updatePost(id: string, input: { title: string; body: string }) {
    await apiFetch(`/posts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: input.title, body: input.body }),
    })
  }

  async deletePost(id: string) {
    await apiFetch(`/posts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  async setHidden(id: string, hidden: boolean) {
    await apiFetch(`/posts/${encodeURIComponent(id)}/hidden`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden }),
    })
  }

  async setNotice(id: string, isNotice: boolean) {
    await apiFetch(`/posts/${encodeURIComponent(id)}/notice`, {
      method: 'PATCH',
      body: JSON.stringify({ isNotice }),
    })
  }

  async listComments(_postId: string): Promise<CommunityComment[]> { return [] }
  async addComment(input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment> {
    return { id: crypto.randomUUID(), postId: input.postId, authorId: input.authorId, authorDisplayName: input.authorDisplayName, body: input.body, createdAt: new Date().toISOString() }
  }
  async deleteComment(_id: string): Promise<void> {}
  async toggleLike(_postId: string, _userId: string): Promise<{ liked: boolean; disliked: boolean }> {
    return { liked: false, disliked: false }
  }

  async toggleDislike(_postId: string, _userId: string): Promise<{ liked: boolean; disliked: boolean }> {
    return { liked: false, disliked: false }
  }

  async isLiked(_postId: string, _userId: string): Promise<boolean> {
    return false
  }

  async isDisliked(_postId: string, _userId: string): Promise<boolean> {
    return false
  }

  async getVoteCounts(_postId: string): Promise<{ likeCount: number; dislikeCount: number }> {
    return { likeCount: 0, dislikeCount: 0 }
  }

  async recordView(_postId: string): Promise<void> {}
}

class SupabaseCommunityRepository implements CommunityRepository {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  private static readonly POST_COLS =
    'id, author_id, author_display_name, title, body, hidden, is_notice, created_at, updated_at, like_count, dislike_count, comment_count, view_count'

  private async attachTodayViews(posts: CommunityPost[]): Promise<CommunityPost[]> {
    if (posts.length === 0) return posts
    const today = new Date().toISOString().split('T')[0]
    const ids = posts.map((p) => p.id)
    const { data: dailyData } = await this.client
      .from('post_daily_views')
      .select('post_id, view_count')
      .eq('view_date', today)
      .in('post_id', ids)
    const dailyMap: Record<string, number> = {}
    for (const d of dailyData ?? []) {
      dailyMap[(d as { post_id: string; view_count: number }).post_id] = (
        d as { post_id: string; view_count: number }
      ).view_count
    }
    return posts.map((p) => ({ ...p, todayViewCount: dailyMap[p.id] ?? 0 }))
  }

  async listPosts(opts: ListPostsOptions): Promise<CommunityPostListResult> {
    const queryInput = listQueryFromOpts(opts)
    const tab = opts.tab ?? 'all'
    const page = opts.page ?? 1
    const pageSize = opts.pageSize ?? DEFAULT_COMMUNITY_PAGE_SIZE
    const search = (opts.search ?? '').trim()

    let q = this.client
      .from('posts')
      .select(SupabaseCommunityRepository.POST_COLS, { count: 'exact' })

    if (!opts.includeHidden) {
      q = q.eq('hidden', false)
    }

    if (tab === 'notice') {
      q = q.eq('is_notice', true)
    } else if (tab === 'concept') {
      q = q.eq('is_notice', false).gte('like_count', CONCEPT_LIKE_THRESHOLD)
    }

    if (search) {
      const escaped = escapeIlike(search)
      const scope = opts.searchScope ?? 'both'
      if (scope === 'title') {
        q = q.ilike('title', `%${escaped}%`)
      } else if (scope === 'content') {
        q = q.ilike('body', `%${escaped}%`)
      } else {
        q = q.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%`)
      }
    }

    if (tab === 'all') {
      q = q.order('is_notice', { ascending: false }).order('created_at', { ascending: false })
    } else {
      q = q.order('created_at', { ascending: false })
    }

    if (queryInput) {
      const from = (page - 1) * pageSize
      q = q.range(from, from + pageSize - 1)
    }

    const { data, error, count } = await q
    if (error) throw new Error(error.message)

    const total = count ?? (data ?? []).length
    let items = (data ?? []).map((row) =>
      mapSupabaseRow(row as Parameters<typeof mapSupabaseRow>[0]),
    )
    items = await this.attachTodayViews(items)

    if (queryInput) {
      const start = (page - 1) * pageSize
      items = items.map((post, index) => ({
        ...post,
        listNumber: total - start - index,
      }))
    }

    return { items, total }
  }

  async getPost(
    id: string,
    opts?: ListPostsOptions,
  ): Promise<CommunityPost | null> {
    void opts
    const { data, error } = await this.client
      .from('posts')
      .select(SupabaseCommunityRepository.POST_COLS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return mapSupabaseRow(data as Parameters<typeof mapSupabaseRow>[0])
  }

  async createPost(input: {
    title: string
    body: string
    authorId: string
    authorDisplayName: string
  }): Promise<CommunityPost> {
    const { data, error } = await this.client
      .from('posts')
      .insert({
        author_id: input.authorId,
        author_display_name: input.authorDisplayName,
        title: input.title.trim(),
        body: input.body,
        hidden: false,
      })
      .select(
        'id, author_id, author_display_name, title, body, hidden, created_at, updated_at',
      )
      .single()
    if (error) throw new Error(translatePostError(error.message))
    return mapSupabaseRow(data as Parameters<typeof mapSupabaseRow>[0])
  }

  async updatePost(id: string, input: { title: string; body: string }) {
    const { error } = await this.client
      .from('posts')
      .update({
        title: input.title.trim(),
        body: input.body,
      })
      .eq('id', id)
    if (error) throw new Error(translatePostError(error.message))
  }

  async deletePost(id: string) {
    const { error } = await this.client.from('posts').delete().eq('id', id)
    if (error) throw new Error(translatePostError(error.message))
  }

  async setHidden(id: string, hidden: boolean) {
    const { error } = await this.client
      .from('posts')
      .update({ hidden })
      .eq('id', id)
    if (error) throw new Error(translatePostError(error.message))
  }

  async setNotice(id: string, isNotice: boolean) {
    const { error } = await this.client
      .from('posts')
      .update({ is_notice: isNotice })
      .eq('id', id)
    if (error) throw new Error(translatePostError(error.message))
  }

  async listComments(postId: string): Promise<CommunityComment[]> {
    const { data, error } = await this.client
      .from('comments')
      .select('id, post_id, author_id, author_display_name, body, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => mapCommentRow(row as Parameters<typeof mapCommentRow>[0]))
  }

  async addComment(input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment> {
    const { data, error } = await this.client
      .from('comments')
      .insert({
        post_id: input.postId,
        author_id: input.authorId,
        author_display_name: input.authorDisplayName,
        body: input.body.trim(),
      })
      .select('id, post_id, author_id, author_display_name, body, created_at')
      .single()
    if (error) throw new Error(translatePostError(error.message))
    return mapCommentRow(data as Parameters<typeof mapCommentRow>[0])
  }

  async deleteComment(id: string): Promise<void> {
    const { error } = await this.client.from('comments').delete().eq('id', id)
    if (error) throw new Error(translatePostError(error.message))
  }

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; disliked: boolean }> {
    const { data: existing } = await this.client
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) {
      await this.client.from('likes').delete().eq('id', existing.id)
      return { liked: false, disliked: await this.isDisliked(postId, userId) }
    }
    await this.client
      .from('dislikes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    await this.client.from('likes').insert({ post_id: postId, user_id: userId })
    return { liked: true, disliked: false }
  }

  async toggleDislike(postId: string, userId: string): Promise<{ liked: boolean; disliked: boolean }> {
    const { data: existing } = await this.client
      .from('dislikes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) {
      await this.client.from('dislikes').delete().eq('id', existing.id)
      return { liked: await this.isLiked(postId, userId), disliked: false }
    }
    await this.client
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    await this.client.from('dislikes').insert({ post_id: postId, user_id: userId })
    return { liked: false, disliked: true }
  }

  async isLiked(postId: string, userId: string): Promise<boolean> {
    const { data } = await this.client
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()
    return !!data
  }

  async isDisliked(postId: string, userId: string): Promise<boolean> {
    const { data } = await this.client
      .from('dislikes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()
    return !!data
  }

  async getVoteCounts(postId: string): Promise<{ likeCount: number; dislikeCount: number }> {
    const { data, error } = await this.client
      .from('posts')
      .select('like_count, dislike_count')
      .eq('id', postId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return {
      likeCount: (data as { like_count?: number } | null)?.like_count ?? 0,
      dislikeCount: (data as { dislike_count?: number } | null)?.dislike_count ?? 0,
    }
  }

  async recordView(postId: string): Promise<void> {
    await this.client.rpc('record_post_view', { p_post_id: postId })
  }
}

function translatePostError(msg: string): string {
  if (/row-level security|RLS/i.test(msg)) {
    return '권한이 없거나 로그인이 필요합니다.'
  }
  return msg || '요청을 처리하지 못했습니다.'
}

/** URL·키 없이 supabase만 고정된 경우: 렌더 단계에서 throw 하지 않고 목록 로드 시 안내 */
class UnconfiguredSupabaseCommunityRepository implements CommunityRepository {
  private static readonly msg =
    'Supabase가 설정되지 않았습니다. web/.env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣은 뒤 개발 서버를 다시 시작하세요.'

  async listPosts(_opts: ListPostsOptions): Promise<CommunityPostListResult> {
    void _opts
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }

  async getPost(
    _id: string,
    _opts?: ListPostsOptions,
  ): Promise<CommunityPost | null> {
    void _id
    void _opts
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }

  async createPost(_input: {
    title: string
    body: string
    authorId: string
    authorDisplayName: string
  }): Promise<CommunityPost> {
    void _input
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }

  async updatePost(
    _id: string,
    _input: { title: string; body: string },
  ): Promise<void> {
    void _id
    void _input
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }

  async deletePost(_id: string): Promise<void> {
    void _id
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }

  async setHidden(_id: string, _hidden: boolean): Promise<void> {
    void _id
    void _hidden
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }

  async setNotice(_id: string, _isNotice: boolean): Promise<void> {
    void _id
    void _isNotice
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }

  async listComments(_postId: string): Promise<CommunityComment[]> { throw new Error(UnconfiguredSupabaseCommunityRepository.msg) }
  async addComment(_input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment> { throw new Error(UnconfiguredSupabaseCommunityRepository.msg) }
  async deleteComment(_id: string): Promise<void> { throw new Error(UnconfiguredSupabaseCommunityRepository.msg) }
  async toggleLike(_postId: string, _userId: string): Promise<{ liked: boolean; disliked: boolean }> {
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }
  async toggleDislike(_postId: string, _userId: string): Promise<{ liked: boolean; disliked: boolean }> {
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }
  async isLiked(_postId: string, _userId: string): Promise<boolean> {
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }
  async isDisliked(_postId: string, _userId: string): Promise<boolean> {
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }
  async getVoteCounts(_postId: string): Promise<{ likeCount: number; dislikeCount: number }> {
    throw new Error(UnconfiguredSupabaseCommunityRepository.msg)
  }
  async recordView(_postId: string): Promise<void> {}
}

export function seedMockPostsIfEmpty() {
  if (readMockPosts().length === 0) writeMockPosts(cloneSeedPosts())
}

export function createCommunityRepository(
  mode: CommunityBackendMode,
  session: MockSession | null,
  client: SupabaseClient | null,
): CommunityRepository {
  if (mode === 'mock') {
    seedMockPostsIfEmpty()
    return new MockCommunityRepository(session)
  }
  if (mode === 'prisma') {
    return new ApiCommunityRepository()
  }
  if (!client)
    throw new Error('Supabase가 설정되지 않았습니다. .env와 Supabase 상태를 확인하세요.')
  return new SupabaseCommunityRepository(client)
}

export function resolveCommunityRepository(
  mockSession: MockSession | null,
): CommunityRepository {
  const mode = communityBackendMode()
  if (mode === 'supabase' && !getCommunitySupabase()) {
    return new UnconfiguredSupabaseCommunityRepository()
  }
  const client = mode === 'supabase' ? getCommunitySupabase() : null
  return createCommunityRepository(mode, mockSession, client)
}
