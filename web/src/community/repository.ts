import type { SupabaseClient } from '@supabase/supabase-js'
import type { CommunityPost, CommunityComment } from './types'
import { communityBackendMode, type CommunityBackendMode } from '../lib/communityBackend'
import { getCommunitySupabase } from '../lib/communitySupabaseClient'
import { apiFetch, getPrismaApiToken } from '../lib/prismaApi'
import {
  cloneSeedPosts,
  readMockPosts,
  writeMockPosts,
} from './mockPostStorage'
import type { MockSession } from './mockSessionStorage'

export type ListPostsOptions = { includeHidden: boolean }

export interface CommunityRepository {
  listPosts(opts: ListPostsOptions): Promise<CommunityPost[]>
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
  listComments(postId: string): Promise<CommunityComment[]>
  addComment(input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment>
  deleteComment(id: string): Promise<void>
  toggleLike(postId: string, userId: string): Promise<{ liked: boolean }>
  isLiked(postId: string, userId: string): Promise<boolean>
  recordView(postId: string): Promise<void>
}

function mapSupabaseRow(row: {
  id: string
  author_id: string
  author_display_name: string
  title: string
  body: string
  hidden: boolean
  created_at: string
  updated_at: string
  like_count?: number
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    viewCount: row.view_count ?? 0,
    todayViewCount: row.today_view_count ?? 0,
  }
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

class MockCommunityRepository implements CommunityRepository {
  private session: MockSession | null

  constructor(session: MockSession | null) {
    this.session = session
  }

  async listPosts(opts: ListPostsOptions): Promise<CommunityPost[]> {
    void opts
    const list = readMockPosts()
    const admin = this.session?.role === 'admin'
    const mine = this.session?.userId
    return list
      .filter((p) => {
        if (!p.hidden) return true
        if (admin) return true
        if (mine && p.authorId === mine) return true
        return false
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }

  async getPost(
    id: string,
    _opts?: ListPostsOptions,
  ): Promise<CommunityPost | null> {
    void _opts
    const list = readMockPosts()
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
      createdAt: now,
      updatedAt: now,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      todayViewCount: 0,
    }
    writeMockPosts([post, ...list])
    return post
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

  async listComments(_postId: string): Promise<CommunityComment[]> { return [] }
  async addComment(input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment> {
    return { id: crypto.randomUUID(), postId: input.postId, authorId: input.authorId, authorDisplayName: input.authorDisplayName, body: input.body, createdAt: new Date().toISOString() }
  }
  async deleteComment(_id: string): Promise<void> {}
  async toggleLike(_postId: string, _userId: string): Promise<{ liked: boolean }> { return { liked: false } }
  async isLiked(_postId: string, _userId: string): Promise<boolean> { return false }
  async recordView(_postId: string): Promise<void> {}
}

class ApiCommunityRepository implements CommunityRepository {
  async listPosts(opts: ListPostsOptions): Promise<CommunityPost[]> {
    void opts
    const res = await apiFetch('/posts')
    return (await res.json()) as CommunityPost[]
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

  async listComments(_postId: string): Promise<CommunityComment[]> { return [] }
  async addComment(input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment> {
    return { id: crypto.randomUUID(), postId: input.postId, authorId: input.authorId, authorDisplayName: input.authorDisplayName, body: input.body, createdAt: new Date().toISOString() }
  }
  async deleteComment(_id: string): Promise<void> {}
  async toggleLike(_postId: string, _userId: string): Promise<{ liked: boolean }> { return { liked: false } }
  async isLiked(_postId: string, _userId: string): Promise<boolean> { return false }
  async recordView(_postId: string): Promise<void> {}
}

class SupabaseCommunityRepository implements CommunityRepository {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  private static readonly POST_COLS = 'id, author_id, author_display_name, title, body, hidden, created_at, updated_at, like_count, comment_count, view_count'

  async listPosts(opts: ListPostsOptions): Promise<CommunityPost[]> {
    void opts
    const { data, error } = await this.client
      .from('posts')
      .select(SupabaseCommunityRepository.POST_COLS)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const today = new Date().toISOString().split('T')[0]
    const { data: dailyData } = await this.client
      .from('post_daily_views')
      .select('post_id, view_count')
      .eq('view_date', today)
    const dailyMap: Record<string, number> = {}
    for (const d of dailyData ?? []) {
      dailyMap[(d as { post_id: string; view_count: number }).post_id] =
        (d as { post_id: string; view_count: number }).view_count
    }

    return (data ?? []).map((row) => {
      const r = row as Parameters<typeof mapSupabaseRow>[0]
      return mapSupabaseRow({ ...r, today_view_count: dailyMap[r.id] ?? 0 })
    })
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

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean }> {
    const { data: existing } = await this.client
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) {
      await this.client.from('likes').delete().eq('id', existing.id)
      return { liked: false }
    } else {
      await this.client.from('likes').insert({ post_id: postId, user_id: userId })
      return { liked: true }
    }
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

  async listPosts(_opts: ListPostsOptions): Promise<CommunityPost[]> {
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

  async listComments(_postId: string): Promise<CommunityComment[]> { throw new Error(UnconfiguredSupabaseCommunityRepository.msg) }
  async addComment(_input: { postId: string; authorId: string; authorDisplayName: string; body: string }): Promise<CommunityComment> { throw new Error(UnconfiguredSupabaseCommunityRepository.msg) }
  async deleteComment(_id: string): Promise<void> { throw new Error(UnconfiguredSupabaseCommunityRepository.msg) }
  async toggleLike(_postId: string, _userId: string): Promise<{ liked: boolean }> { throw new Error(UnconfiguredSupabaseCommunityRepository.msg) }
  async isLiked(_postId: string, _userId: string): Promise<boolean> { throw new Error(UnconfiguredSupabaseCommunityRepository.msg) }
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
