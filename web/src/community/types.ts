export type ProfileRole = 'user' | 'admin'

/** public: 전체 | members: 로그인 회원 | private: 작성자·관리자 */
export type PostVisibility = 'public' | 'private' | 'members'

export type CommunityPost = {
  id: string
  authorId: string | null
  authorDisplayName: string
  title: string
  body: string
  hidden: boolean
  visibility: PostVisibility
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
  communityGrade?: number
}
