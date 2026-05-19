import type { PostVisibility } from './types'

export const POST_VISIBILITY_OPTIONS: {
  value: PostVisibility
  label: string
  description: string
  guestAllowed: boolean
}[] = [
  {
    value: 'public',
    label: '전체공개',
    description: '누구나 목록·본문을 볼 수 있습니다',
    guestAllowed: true,
  },
  {
    value: 'members',
    label: '회원공개',
    description: '로그인한 회원만 볼 수 있습니다',
    guestAllowed: false,
  },
  {
    value: 'private',
    label: '비공개',
    description: '작성자와 관리자만 볼 수 있습니다',
    guestAllowed: false,
  },
]

export function visibilityLabel(v: PostVisibility): string {
  return POST_VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v
}

export function canReadPostVisibility(
  visibility: PostVisibility,
  opts: { isLoggedIn: boolean; isAuthor: boolean; isAdmin: boolean },
): boolean {
  if (opts.isAdmin) return true
  if (visibility === 'public') return true
  if (visibility === 'members') return opts.isLoggedIn
  if (visibility === 'private') return opts.isAuthor
  return false
}
