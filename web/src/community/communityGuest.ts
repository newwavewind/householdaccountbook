const NICKNAME_KEY = 'gaegyeobu-community-nickname-v1'
const VOTER_KEY = 'gaegyeobu-community-voter-id-v1'

/** 브라우저별 비회원 식별자 (추천·투표용) */
export function getGuestVoterId(): string {
  try {
    let id = localStorage.getItem(VOTER_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VOTER_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function getGuestNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setGuestNickname(name: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, name.trim())
  } catch {
    // ignore
  }
}

/** 로그인 사용자 ID 또는 `guest:{uuid}` */
export function resolveVoterId(userId: string | null | undefined): string {
  if (userId) return userId
  return `guest:${getGuestVoterId()}`
}

export function parseVoterRef(voterId: string): { userId: string | null; voterKey: string | null } {
  if (voterId.startsWith('guest:')) {
    return { userId: null, voterKey: voterId.slice(6) }
  }
  return { userId: voterId, voterKey: null }
}
