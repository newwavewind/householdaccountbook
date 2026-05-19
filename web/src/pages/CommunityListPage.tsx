import { useMemo, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  COMMUNITY_PAGE_SIZES,
  COMMUNITY_SEARCH_SCOPES,
  type CommunityBoardTab,
  type CommunityPageSize,
  type CommunitySearchScope,
} from '../community/boardConstants'
import { useCommunityBoard } from '../community/useCommunityBoard'
import { conceptCriteriaText, isConceptPost } from '../community/communityGrades'
import { detectPostContentFlags } from '../lib/communityPostContentFlags'
import { CommunityConceptBadge } from '../components/community/CommunityConceptBadge'
import { CommunityPostContentIcons } from '../components/community/CommunityPostContentIcons'

function fmtListDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  }
  return new Intl.DateTimeFormat('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const TABS: { id: CommunityBoardTab; label: string }[] = [
  { id: 'all', label: '전체글' },
  { id: 'concept', label: '개념글' },
  { id: 'notice', label: '공지' },
]

function PaginationBar({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (p: number) => void
}) {
  const pages = useMemo(() => {
    const maxButtons = 7
    if (pageCount <= maxButtons) {
      return Array.from({ length: pageCount }, (_, i) => i + 1)
    }
    const start = Math.max(1, page - 3)
    const end = Math.min(pageCount, start + maxButtons - 1)
    const adjustedStart = Math.max(1, end - maxButtons + 1)
    return Array.from({ length: end - adjustedStart + 1 }, (_, i) => adjustedStart + i)
  }, [page, pageCount])

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="페이지">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="min-w-[2rem] rounded border border-border-subtle bg-surface-raised px-2 py-1 text-xs font-semibold text-text-secondary disabled:opacity-40 hover:bg-green-light/30"
      >
        ◀
      </button>
      {pages[0] > 1 ? (
        <>
          <button
            type="button"
            onClick={() => onPage(1)}
            className="min-w-[2rem] rounded border border-border-subtle bg-surface-raised px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-green-light/30"
          >
            1
          </button>
          {pages[0] > 2 ? <span className="px-1 text-xs text-text-soft">…</span> : null}
        </>
      ) : null}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
          className={`min-w-[2rem] rounded border px-2 py-1 text-xs font-semibold ${
            p === page
              ? 'border-green-accent bg-green-accent text-on-accent'
              : 'border-border-subtle bg-surface-raised text-text-secondary hover:bg-green-light/30'
          }`}
        >
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < pageCount ? (
        <>
          {pages[pages.length - 1] < pageCount - 1 ? (
            <span className="px-1 text-xs text-text-soft">…</span>
          ) : null}
          <button
            type="button"
            onClick={() => onPage(pageCount)}
            className="min-w-[2rem] rounded border border-border-subtle bg-surface-raised px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-green-light/30"
          >
            {pageCount}
          </button>
        </>
      ) : null}
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className="min-w-[2rem] rounded border border-border-subtle bg-surface-raised px-2 py-1 text-xs font-semibold text-text-secondary disabled:opacity-40 hover:bg-green-light/30"
      >
        ▶
      </button>
    </nav>
  )
}

export default function CommunityListPage() {
  const nav = useNavigate()
  const board = useCommunityBoard()

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    board.submitSearch()
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-starbucks-green">커뮤니티</h1>
          <p className="mt-1 text-sm text-text-soft">
            전체 {board.total.toLocaleString('ko-KR')}개
            {board.search ? ` · "${board.search}" 검색` : null}
            {board.mode === 'mock' ? (
              <>
                {' '}
                <Link to="/auth/setup" className="font-medium text-green-accent underline">
                  로그인 안내
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Button type="button" variant="primary" onClick={() => nav('/community/new')}>
          글쓰기
        </Button>
      </div>

      <Card className="overflow-hidden border border-border-muted bg-surface-raised p-0">
        <div className="flex flex-wrap items-center gap-1 border-b border-border-muted bg-ceramic/50 px-2 py-2 md:px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => board.setTab(t.id)}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                board.tab === t.id
                  ? 'bg-green-accent text-on-accent'
                  : 'text-text-secondary hover:bg-green-light/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {board.tab === 'concept' ? (
          <p className="border-b border-border-muted/60 bg-sky-50/40 px-3 py-1.5 text-[11px] text-sky-900/80">
            {conceptCriteriaText()}인 글만 표시됩니다.
          </p>
        ) : null}

        <form
          onSubmit={onSearch}
          className="flex flex-wrap items-center gap-2 border-b border-border-muted px-3 py-2"
        >
          <label className="sr-only" htmlFor="community-search">
            검색
          </label>
          <select
            id="community-search-scope"
            value={board.searchScopeDraft}
            onChange={(e) =>
              board.setSearchScope(e.target.value as CommunitySearchScope)
            }
            className="rounded border border-border-subtle bg-surface-raised px-2 py-1.5 text-xs font-medium text-text-secondary"
            aria-label="검색 범위"
          >
            {COMMUNITY_SEARCH_SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            id="community-search"
            type="search"
            value={board.searchDraft}
            onChange={(e) => board.setSearchDraft(e.target.value)}
            placeholder={`${COMMUNITY_SEARCH_SCOPES.find((s) => s.value === board.searchScopeDraft)?.label ?? '제목+내용'} 검색`}
            className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-raised px-3 py-1.5 text-sm outline-none focus:border-green-accent/60 focus:ring-2 focus:ring-green-accent/25"
          />
          <Button type="submit" variant="outlined" className="!min-h-0 !px-3 !py-1.5 !text-xs">
            검색
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-muted bg-neutral-cool/40 text-xs font-semibold text-text-soft">
                <th className="w-14 px-2 py-2 text-center">번호</th>
                <th className="px-2 py-2 text-left">제목</th>
                <th className="hidden w-24 px-2 py-2 text-center sm:table-cell">글쓴이</th>
                <th className="w-20 px-2 py-2 text-center">작성일</th>
                <th className="w-14 px-2 py-2 text-center">조회</th>
                <th className="w-14 px-2 py-2 text-center">추천</th>
              </tr>
            </thead>
            <tbody>
              {board.busy ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-soft">
                    불러오는 중…
                  </td>
                </tr>
              ) : board.error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-danger">
                    {board.error}
                  </td>
                </tr>
              ) : board.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-soft">
                    {board.search ? '검색 결과가 없습니다.' : '글이 없습니다.'}
                  </td>
                </tr>
              ) : (
                board.items.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-border-muted/80 transition-colors hover:bg-green-light/15 ${
                      p.isNotice ? 'bg-amber-50/60' : isConceptPost(p) ? 'bg-sky-50/40' : ''
                    }`}
                  >
                    <td className="px-2 py-2.5 text-center text-xs tabular-nums text-text-soft">
                      {p.isNotice ? (
                        <span className="font-bold text-amber-700">공지</span>
                      ) : (
                        (p.listNumber ?? '—')
                      )}
                    </td>
                    <td className="max-w-0 px-2 py-2.5">
                      <Link
                        to={`/community/${p.id}`}
                        className="flex min-w-0 items-center font-medium text-text-primary hover:text-starbucks-green hover:underline"
                      >
                        <span className="truncate">{p.title}</span>
                        {isConceptPost(p) ? <CommunityConceptBadge className="ml-1" /> : null}
                        <CommunityPostContentIcons {...detectPostContentFlags(p.body)} />
                        {p.commentCount > 0 ? (
                          <span className="ml-1 shrink-0 text-xs font-semibold text-green-accent">
                            [{p.commentCount}]
                          </span>
                        ) : null}
                      </Link>
                      <span className="mt-0.5 block truncate text-xs text-text-soft sm:hidden">
                        {p.authorDisplayName}
                      </span>
                    </td>
                    <td className="hidden px-2 py-2.5 text-center text-xs text-text-secondary sm:table-cell">
                      <span className="block max-w-[6rem] truncate">{p.authorDisplayName}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs tabular-nums text-text-soft">
                      {fmtListDate(p.createdAt)}
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs tabular-nums text-text-soft">
                      {p.viewCount}
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs tabular-nums text-text-soft">
                      {p.likeCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border-muted px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs text-text-soft">
            <span className="font-medium">목록 개수</span>
            <select
              value={board.pageSize}
              onChange={(e) => board.setPageSize(Number(e.target.value) as CommunityPageSize)}
              className="rounded border border-border-subtle bg-surface-raised px-2 py-1 text-xs font-semibold text-text-secondary"
            >
              {COMMUNITY_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}개씩 보기
                </option>
              ))}
            </select>
          </label>
          <PaginationBar page={board.page} pageCount={board.pageCount} onPage={board.setPage} />
        </div>
      </Card>
    </main>
  )
}
