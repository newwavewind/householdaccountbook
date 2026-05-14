export type ProfileRole = 'user' | 'admin'

export type CommunityPost = {
  id: string
  authorId: string
  authorDisplayName: string
  title: string
  body: string
  hidden: boolean
  createdAt: string
  updatedAt: string
}

export type CommunityUser = {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
}
