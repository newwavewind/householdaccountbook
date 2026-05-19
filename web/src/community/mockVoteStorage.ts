const LIKES_KEY = 'gaegyeobu-community-mock-likes-v1'
const DISLIKES_KEY = 'gaegyeobu-community-mock-dislikes-v1'

type VoteMap = Record<string, string[]>

function readMap(key: string): VoteMap {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as VoteMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(key: string, map: VoteMap): void {
  localStorage.setItem(key, JSON.stringify(map))
}

export function mockIsLiked(postId: string, userId: string): boolean {
  return (readMap(LIKES_KEY)[postId] ?? []).includes(userId)
}

export function mockIsDisliked(postId: string, userId: string): boolean {
  return (readMap(DISLIKES_KEY)[postId] ?? []).includes(userId)
}

export function mockToggleLike(
  postId: string,
  userId: string,
): { liked: boolean; disliked: boolean } {
  const likes = readMap(LIKES_KEY)
  const dislikes = readMap(DISLIKES_KEY)
  const postLikes = likes[postId] ?? []
  const postDislikes = dislikes[postId] ?? []
  const hadLike = postLikes.includes(userId)

  if (hadLike) {
    likes[postId] = postLikes.filter((id) => id !== userId)
  } else {
    likes[postId] = [...postLikes, userId]
    dislikes[postId] = postDislikes.filter((id) => id !== userId)
  }

  writeMap(LIKES_KEY, likes)
  writeMap(DISLIKES_KEY, dislikes)
  return {
    liked: !hadLike,
    disliked: false,
  }
}

export function mockToggleDislike(
  postId: string,
  userId: string,
): { liked: boolean; disliked: boolean } {
  const likes = readMap(LIKES_KEY)
  const dislikes = readMap(DISLIKES_KEY)
  const postLikes = likes[postId] ?? []
  const postDislikes = dislikes[postId] ?? []
  const hadDislike = postDislikes.includes(userId)

  if (hadDislike) {
    dislikes[postId] = postDislikes.filter((id) => id !== userId)
  } else {
    dislikes[postId] = [...postDislikes, userId]
    likes[postId] = postLikes.filter((id) => id !== userId)
  }

  writeMap(LIKES_KEY, likes)
  writeMap(DISLIKES_KEY, dislikes)
  return {
    liked: false,
    disliked: !hadDislike,
  }
}

export function mockCountVotes(postId: string): { likeCount: number; dislikeCount: number } {
  return {
    likeCount: (readMap(LIKES_KEY)[postId] ?? []).length,
    dislikeCount: (readMap(DISLIKES_KEY)[postId] ?? []).length,
  }
}
