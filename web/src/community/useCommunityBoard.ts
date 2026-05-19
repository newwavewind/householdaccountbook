import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { communityBackendMode } from '../lib/communityBackend'
import {
  DEFAULT_COMMUNITY_PAGE_SIZE,
  parseBoardTab,
  parsePageSize,
  parseSearchScope,
  type CommunityBoardTab,
  type CommunityPageSize,
  type CommunitySearchScope,
} from './boardConstants'
import { totalPages } from './postListQuery'
import { readMockSession } from './mockSessionStorage'
import { resolveCommunityRepository } from './repository'
import type { CommunityPost } from './types'
import { useCommunityAuth } from './CommunityAuthContext'

export function useCommunityBoard() {
  const auth = useCommunityAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = parseBoardTab(searchParams.get('tab'))
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = parsePageSize(searchParams.get('size'))
  const search = (searchParams.get('q') ?? '').trim()
  const searchScope = parseSearchScope(searchParams.get('scope'))
  const [searchDraft, setSearchDraft] = useState(search)
  const [searchScopeDraft, setSearchScopeDraft] = useState(searchScope)

  const [items, setItems] = useState<CommunityPost[]>([])
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repo = useMemo(
    () => resolveCommunityRepository(readMockSession()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth.role, auth.user?.id],
  )

  const pageCount = totalPages(total, pageSize)

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') next.delete(k)
          else next.set(k, v)
        }
        return next
      })
    },
    [setSearchParams],
  )

  const setTab = useCallback(
    (next: CommunityBoardTab) => {
      patchParams({ tab: next === 'all' ? null : next, page: '1' })
    },
    [patchParams],
  )

  const setPage = useCallback(
    (next: number) => {
      patchParams({ page: String(Math.max(1, Math.min(next, pageCount))) })
    },
    [patchParams, pageCount],
  )

  const setPageSize = useCallback(
    (next: CommunityPageSize) => {
      patchParams({
        size: next === DEFAULT_COMMUNITY_PAGE_SIZE ? null : String(next),
        page: '1',
      })
    },
    [patchParams],
  )

  const setSearchScope = useCallback(
    (next: CommunitySearchScope) => {
      setSearchScopeDraft(next)
      patchParams({
        scope: next === 'both' ? null : next,
        page: '1',
      })
    },
    [patchParams],
  )

  const submitSearch = useCallback(() => {
    patchParams({
      q: searchDraft.trim() || null,
      scope: searchScopeDraft === 'both' ? null : searchScopeDraft,
      page: '1',
    })
  }, [patchParams, searchDraft, searchScopeDraft])

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await repo.listPosts({
        includeHidden: false,
        tab,
        page,
        pageSize,
        search,
        searchScope,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      setItems([])
      setTotal(0)
    } finally {
      setBusy(false)
    }
  }, [repo, tab, page, pageSize, search, searchScope])

  useEffect(() => {
    setSearchDraft(search)
    setSearchScopeDraft(searchScope)
  }, [search, searchScope])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (page > pageCount) {
      patchParams({ page: String(pageCount) })
    }
  }, [page, pageCount, patchParams])

  return {
    items,
    total,
    busy,
    error,
    tab,
    page,
    pageSize,
    pageCount,
    search,
    searchScope,
    searchDraft,
    searchScopeDraft,
    setSearchDraft,
    setSearchScopeDraft,
    setSearchScope,
    setTab,
    setPage,
    setPageSize,
    submitSearch,
    refresh,
    mode: communityBackendMode(),
  }
}
