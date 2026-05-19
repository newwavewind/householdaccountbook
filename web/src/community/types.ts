export type ProfileRole = 'user' | 'admin'

export type CommunityPost = {
  id: string
  authorId: string
  authorDisplayName: string
  title: string
  body: string
  hidden: boolean
  isNotice?: boolean
  createdAt: string
  updatedAt: string
  likeCount: number
  dislikeCount: number
  commentCount: number
  viewCount: number
  todayViewCount: number
  /** 목록 API에서만 채워지는 표시용 글번호 */
  listNumber?: number
}

export type CommunityComment = {
  id: string
  postId: string
  authorId: string | null
  authorDisplayName: string
  body: string
  createdAt: string
}

export type CommunityUser = {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
}
