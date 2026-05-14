import type { CommunityPost } from './types'

const STORAGE_KEY = 'gaegyeobu-community-mock-posts-v1'

const SEED_POSTS: CommunityPost[] = [
  {
    id: 'seed-welcome',
    authorId: 'demo-user',
    authorDisplayName: '가계부 팀',
    title: '커뮤니티에 오신 걸 환영해요',
    body:
      '실제 로그인·저장소를 쓰려면 web/.env.local에 Supabase URL·anon 키를 넣으세요(배포는 Vercel 등에 동일 변수). Google 로그인은 메뉴의 Google 로그인 안내(/auth/setup)를 따르세요.',
    hidden: false,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    likeCount: 0,
    commentCount: 0,
  },
]

export function readMockPosts(): CommunityPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as CommunityPost[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function writeMockPosts(posts: CommunityPost[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

export function cloneSeedPosts(): CommunityPost[] {
  return SEED_POSTS.map((p) => ({ ...p, id: crypto.randomUUID() }))
}
