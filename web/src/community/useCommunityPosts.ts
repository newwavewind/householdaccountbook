import { useCallback, useEffect, useMemo, useState } from 'react'
/* eslint-disable react-hooks/set-state-in-effect -- 마운트 시 데이터 로드 */
import { communityBackendMode } from '../lib/communityBackend'
import type { CommunityPost } from './types'
import { readMockSession } from './mockSessionStorage'
import { resolveCommunityRepository } from './repository'
import { useCommunityAuth } from './CommunityAuthContext'

export function useCommunityPosts(includeHidden: boolean) {
  const auth = useCommunityAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repo = useMemo(
    () => resolveCommunityRepository(readMockSession()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mock 세션은 auth 전환과 함께 갱신
    [auth.role, auth.user?.id],
  )

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const list = await repo.listPosts({ includeHidden })
      setPosts(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      setPosts([])
    } finally {
      setBusy(false)
    }
  }, [repo, includeHidden])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { posts, busy, error, refresh, repo, mode: communityBackendMode() }
}

export function useCommunityPost(id: string | undefined) {
  const auth = useCommunityAuth()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repo = useMemo(
    () => resolveCommunityRepository(readMockSession()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mock 세션은 auth 전환과 함께 갱신
    [auth.role, auth.user?.id],
  )

  const refresh = useCallback(async () => {
    if (!id) {
      setPost(null)
      setBusy(false)
      setError(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const p = await repo.getPost(id)
      setPost(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : '글을 불러오지 못했습니다.')
      setPost(null)
    } finally {
      setBusy(false)
    }
  }, [repo, id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { post, busy, error, refresh, repo }
}
