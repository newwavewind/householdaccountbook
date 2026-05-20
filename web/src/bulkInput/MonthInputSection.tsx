import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { BulkDraftRow, BulkRowsUpdater } from './draftRow'
import { BulkInputDraftRow } from './BulkInputDraftRow'
import { BulkInputHistoryRow } from './BulkInputHistoryRow'
import { BulkRowManageIcon } from './BulkRowManageIcon'
import { BulkInputTableHead } from './BulkInputTableHead'
import {
  BULK_TABLE_CLASS,
  BULK_TABLE_INNER,
  BULK_TABLE_MIN_WIDTH,
  BULK_TABLE_SCROLL,
} from './bulkInputTableLayout'
import { emptyDraftRow } from './draftRow'
import {
  ensureWorkingRowOnTop,
  isBlankDraftRow,
  migrateLegacyMonthRowOrder,
  moveRowBelowTopAfterConfirm,
} from './draftRowOrder'
import type { DraftLedgerComparison } from './compareMonthDraftLedger'
type BulkListPageSize = 5 | 10 | 30 | 'all'

const BULK_LIST_PAGE_SIZE_OPTIONS: { value: BulkListPageSize; label: string }[] = [
  { value: 5, label: '5개씩 보기' },
  { value: 10, label: '10개씩 보기' },
  { value: 30, label: '30개씩 보기' },
  { value: 'all', label: '전체 보기' },
]

function bulkListPageCount(rowCount: number, pageSize: BulkListPageSize): number {
  if (pageSize === 'all' || rowCount === 0) return 1
  return Math.max(1, Math.ceil(rowCount / pageSize))
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

function amountDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

function formatAmountCommas(digits: string): string {
  const d = amountDigitsOnly(digits)
  if (!d) return ''
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function collectRowFocusables(tr: HTMLTableRowElement): HTMLElement[] {
  const out: HTMLElement[] = []
  for (const td of tr.querySelectorAll(':scope > td')) {
    const inp = td.querySelector(':scope > input')
    if (inp instanceof HTMLInputElement && !inp.disabled) {
      out.push(inp)
      continue
    }
    const sel = td.querySelector(':scope > select')
    if (sel instanceof HTMLSelectElement && !sel.disabled) {
      out.push(sel)
      continue
    }
    const bulkPickerBtn = td.querySelector(
      ':scope > button[data-bulk-category-trigger], :scope > button[data-bulk-card-trigger], :scope > button[data-bulk-member-trigger]',
    )
    if (bulkPickerBtn instanceof HTMLButtonElement && !bulkPickerBtn.disabled) {
      out.push(bulkPickerBtn)
      continue
    }
    // 확인 버튼도 Tab/Enter 네비게이션에 포함 (마지막 포커스 위치)
    const actionBtn = td.querySelector(
      ':scope > button[data-confirm-row], :scope > button[data-save-row]',
    )
    if (actionBtn instanceof HTMLButtonElement && !actionBtn.disabled) {
      out.push(actionBtn)
      continue
    }
  }
  return out
}

function focusPrevInTable(current: HTMLElement, tbody: HTMLTableSectionElement) {
  const tr = current.closest('tr')
  if (!(tr instanceof HTMLTableRowElement)) return
  const allRows = [
    ...tbody.querySelectorAll<HTMLTableRowElement>(':scope > tr'),
  ]
  const rowIdx = allRows.indexOf(tr)
  const list = collectRowFocusables(tr)
  const idx = list.indexOf(current)
  if (idx > 0) {
    list[idx - 1]!.focus()
    return
  }
  const prevRow = allRows[rowIdx - 1]
  if (prevRow) {
    const pl = collectRowFocusables(prevRow)
    pl[pl.length - 1]?.focus()
  }
}

type Props = {
  year: number
  monthIndex: number
  rows: BulkDraftRow[]
  onChangeRows: (payload: BulkRowsUpdater) => void
  /** rows는 최신 행 데이터를 항상 넘겨주므로 stale closure 없음 */
  onApplyMonth: (rows: BulkDraftRow[]) => void
  /** 선택 연·월 장부 vs 입력 유효 줄 집합 비교 */
  draftLedgerCompare: DraftLedgerComparison
  members?: string[]
}

export function MonthInputSection({
  year,
  monthIndex,
  rows,
  onChangeRows,
  onApplyMonth,
  draftLedgerCompare,
  members = [],
}: Props) {
  // rows의 최신값을 ref로 추적 — render 중 갱신되므로 rAF 콜백에서 읽으면 항상 최신
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const workingTbodyRef = useRef<HTMLTableSectionElement | null>(null)
  const historyTbodyRef = useRef<HTMLTableSectionElement | null>(null)
  const [amountFocusLocalKey, setAmountFocusLocalKey] = useState<string | null>(
    null,
  )
  const [categoryOpenLocalKey, setCategoryOpenLocalKey] = useState<string | null>(
    null,
  )
  const [cardOpenLocalKey, setCardOpenLocalKey] = useState<string | null>(null)
  const [memberOpenLocalKey, setMemberOpenLocalKey] = useState<string | null>(
    null,
  )
  const [confirmFlashLocalKey, setConfirmFlashLocalKey] = useState<string | null>(
    null,
  )
  const [historyRowMenuKey, setHistoryRowMenuKey] = useState<string | null>(null)
  const [editingHistoryKey, setEditingHistoryKey] = useState<string | null>(null)
  const editingSnapshotRef = useRef<BulkDraftRow | null>(null)
  /** 인앱 확인 (window.confirm은 일부 브라우저/미리보기에서 무시될 수 있음) */
  const [bulkRowDeleteKey, setBulkRowDeleteKey] = useState<string | null>(null)
  const [listPageSize, setListPageSize] = useState<BulkListPageSize>(10)
  const [listPage, setListPage] = useState(1)
  const confirmFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workingRow = rows[0] ?? emptyDraftRow()
  const historyRows = rows.length > 1 ? rows.slice(1) : []

  const listPageCount = useMemo(
    () => bulkListPageCount(historyRows.length, listPageSize),
    [historyRows.length, listPageSize],
  )

  const historySliceStart = useMemo(() => {
    if (listPageSize === 'all') return 0
    return (listPage - 1) * listPageSize
  }, [listPage, listPageSize])

  const visibleHistoryRows = useMemo(() => {
    if (listPageSize === 'all') return historyRows
    return historyRows.slice(
      historySliceStart,
      historySliceStart + listPageSize,
    )
  }, [historyRows, listPageSize, historySliceStart])

  useEffect(() => {
    setListPage((p) => Math.min(Math.max(1, p), listPageCount))
  }, [listPageCount])

  useEffect(() => {
    setListPage(1)
    setEditingHistoryKey(null)
    setHistoryRowMenuKey(null)
    editingSnapshotRef.current = null
  }, [year, monthIndex])

  useEffect(() => {
    if (rows.length <= 1) return
    const needs =
      !isBlankDraftRow(rows[0]!) && isBlankDraftRow(rows[rows.length - 1]!)
    if (!needs) return
    onChangeRows(migrateLegacyMonthRowOrder(rows))
  }, [year, monthIndex, rows, onChangeRows])

  useEffect(
    () => () => {
      if (confirmFlashTimerRef.current) {
        clearTimeout(confirmFlashTimerRef.current)
        confirmFlashTimerRef.current = null
      }
    },
    [],
  )

  const focusTopRowFirstField = useCallback(() => {
    const tbody = workingTbodyRef.current
    if (!tbody) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const firstTr = tbody.querySelector('tr[data-bulk-working-row]')
        if (firstTr instanceof HTMLTableRowElement) {
          collectRowFocusables(firstTr)[0]?.focus()
        }
      })
    })
  }, [])

  /** 확인·행 끝 Enter: 장부 반영 후 작업 줄은 아래로, 맨 위에 새 입력 줄 */
  const confirmApplyAndFocusTop = useCallback(
    (rowLocalKey: string) => {
      if (confirmFlashTimerRef.current) {
        clearTimeout(confirmFlashTimerRef.current)
        confirmFlashTimerRef.current = null
      }
      setConfirmFlashLocalKey(rowLocalKey)
      confirmFlashTimerRef.current = setTimeout(() => {
        setConfirmFlashLocalKey(null)
        confirmFlashTimerRef.current = null
      }, 480)

      onChangeRows((prev) => {
        const next = moveRowBelowTopAfterConfirm(prev, rowLocalKey)
        onApplyMonth(next)
        return next
      })
      setListPage(1)
      focusTopRowFirstField()
    },
    [onApplyMonth, onChangeRows, focusTopRowFirstField],
  )

  const startHistoryEdit = useCallback((localKey: string) => {
    setCategoryOpenLocalKey(null)
    setCardOpenLocalKey(null)
    setMemberOpenLocalKey(null)
    const row = rowsRef.current.find((r) => r.localKey === localKey)
    if (row) editingSnapshotRef.current = { ...row }
    setEditingHistoryKey(localKey)
  }, [])

  const cancelHistoryEdit = useCallback(() => {
    const key = editingHistoryKey
    const snap = editingSnapshotRef.current
    if (key && snap) {
      onChangeRows((prev) =>
        prev.map((r) => (r.localKey === key ? snap : r)),
      )
    }
    setEditingHistoryKey(null)
    editingSnapshotRef.current = null
  }, [editingHistoryKey, onChangeRows])

  const saveHistoryEdit = useCallback(() => {
    onApplyMonth(rowsRef.current)
    setEditingHistoryKey(null)
    editingSnapshotRef.current = null
  }, [onApplyMonth])

  const focusNextField = useCallback(
    (current: HTMLElement) => {
      const tr = current.closest('tr')
      if (!(tr instanceof HTMLTableRowElement)) return
      const list = collectRowFocusables(tr)
      const idx = list.indexOf(current)
      if (idx >= 0 && idx < list.length - 1) {
        list[idx + 1]!.focus()
        return
      }
      const rowKey = tr.getAttribute('data-bulk-row')?.trim() ?? ''
      if (tr.hasAttribute('data-bulk-working-row')) {
        confirmApplyAndFocusTop(rowKey)
        return
      }
      if (tr.hasAttribute('data-bulk-history-edit')) {
        saveHistoryEdit()
        return
      }
      const tbody = historyTbodyRef.current
      if (!tbody) return
      onApplyMonth(rowsRef.current)
      const allRows = [
        ...tbody.querySelectorAll<HTMLTableRowElement>(':scope > tr'),
      ]
      const rowIdx = allRows.indexOf(tr)
      const nextRow = allRows[rowIdx + 1]
      if (nextRow) {
        collectRowFocusables(nextRow)[0]?.focus()
      }
    },
    [onApplyMonth, confirmApplyAndFocusTop, saveHistoryEdit],
  )

  const handleFieldKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.nativeEvent.isComposing) return
      const tbody = e.currentTarget.closest('tbody')
      if (!(tbody instanceof HTMLTableSectionElement)) return

      if (e.key === 'Enter') {
        if (e.currentTarget.tagName === 'SELECT') {
          const el = e.currentTarget
          const tr = el.closest('tr')
          if (!(tr instanceof HTMLTableRowElement)) return
          const list = collectRowFocusables(tr)
          const idx = list.indexOf(el)
          if (e.shiftKey) {
            requestAnimationFrame(() => focusPrevInTable(el, tbody))
          } else if (idx < list.length - 1) {
            requestAnimationFrame(() => list[idx + 1]?.focus())
          } else {
            const last = list[list.length - 1]
            if (last instanceof HTMLButtonElement) {
              if (last.hasAttribute('data-confirm-row')) {
                e.preventDefault()
                const rowKey =
                  tr.getAttribute('data-bulk-row')?.trim() ?? ''
                requestAnimationFrame(() => confirmApplyAndFocusTop(rowKey))
                return
              }
              if (last.hasAttribute('data-save-row')) {
                e.preventDefault()
                requestAnimationFrame(() => saveHistoryEdit())
                return
              }
            }
            requestAnimationFrame(() => focusNextField(el))
          }
          return
        }
        e.preventDefault()
        if (e.shiftKey) {
          focusPrevInTable(e.currentTarget, tbody)
        } else {
          focusNextField(e.currentTarget)
        }
      }
    },
    [focusNextField, confirmApplyAndFocusTop, saveHistoryEdit],
  )

  const draftRowProps = {
    monthIndex,
    members,
    rows,
    onChangeRows,
    amountFocusLocalKey,
    setAmountFocusLocalKey,
    categoryOpenLocalKey,
    setCategoryOpenLocalKey,
    cardOpenLocalKey,
    setCardOpenLocalKey,
    memberOpenLocalKey,
    setMemberOpenLocalKey,
    confirmFlashLocalKey,
    onConfirm: confirmApplyAndFocusTop,
    onFieldKeyDown: handleFieldKeyDown,
    onNavigateAfterPick: focusNextField,
    formatAmountCommas,
    amountDigitsOnly,
  }

  return (
    <Card className="rounded-[var(--radius-card)] border border-charcoal-border bg-surface-raised p-4 shadow-sm theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong md:p-6">
      <div className={BULK_TABLE_SCROLL}>
        <div
          className={BULK_TABLE_INNER}
          style={{ minWidth: BULK_TABLE_MIN_WIDTH }}
        >
          <section
            aria-label="입력 칸"
            className="sticky top-0 z-10 border-b-2 border-green-accent/40 bg-green-light/45 shadow-sm backdrop-blur-sm"
          >
            <table className={BULK_TABLE_CLASS}>
              <BulkInputTableHead
                showMembers={members.length > 0}
                showConfirm
              />
              <tbody ref={workingTbodyRef}>
                <BulkInputDraftRow
                  {...draftRowProps}
                  r={workingRow}
                  rowIndex={0}
                />
              </tbody>
            </table>
          </section>

          <section aria-label="확인된 내역">
            <div className="flex flex-col gap-1.5 border-b border-border-muted bg-neutral-cool/20 px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <label className="flex items-center gap-1.5 text-[0.6875rem] text-text-soft">
                  <span className="font-medium text-text-muted">목록 개수</span>
                  <select
                    aria-label="확인된 내역 목록 개수"
                    value={listPageSize}
                    onChange={(e) => {
                      const v = e.target.value
                      const next: BulkListPageSize =
                        v === 'all' ? 'all' : (Number(v) as 5 | 10 | 30)
                      setListPageSize(next)
                      setListPage(1)
                    }}
                    className="h-7 rounded-md border border-border-subtle bg-surface-raised px-1.5 text-[0.6875rem] font-semibold text-text-secondary outline-none focus:border-green-accent"
                  >
                    {BULK_LIST_PAGE_SIZE_OPTIONS.map((opt) => (
                      <option key={String(opt.value)} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                {listPageSize !== 'all' && historyRows.length > 0 ? (
                  <nav
                    className="flex items-center justify-center gap-1.5"
                    aria-label="확인된 내역 페이지"
                  >
                    <button
                      type="button"
                      disabled={listPage <= 1}
                      onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      className="flex h-7 min-w-7 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-[0.6875rem] font-semibold text-text-secondary outline-none transition-colors hover:bg-green-light/30 disabled:opacity-40 focus:border-green-accent"
                      aria-label="이전 페이지"
                    >
                      ◀
                    </button>
                    <span className="min-w-[3.25rem] text-center text-[0.6875rem] font-semibold tabular-nums text-text-secondary">
                      {listPage} / {listPageCount}
                    </span>
                    <button
                      type="button"
                      disabled={listPage >= listPageCount}
                      onClick={() =>
                        setListPage((p) => Math.min(listPageCount, p + 1))
                      }
                      className="flex h-7 min-w-7 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-[0.6875rem] font-semibold text-text-secondary outline-none transition-colors hover:bg-green-light/30 disabled:opacity-40 focus:border-green-accent"
                      aria-label="다음 페이지"
                    >
                      ▶
                    </button>
                  </nav>
                ) : null}
            </div>
            <table className={BULK_TABLE_CLASS}>
              <BulkInputTableHead
                showMembers={members.length > 0}
                showActions
              />
              <tbody ref={historyTbodyRef}>
              {visibleHistoryRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={(members.length > 0 ? 8 : 7) + 1}
                    className="bg-surface-raised py-8 text-center text-xs text-text-soft"
                  >
                    아직 확인된 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                visibleHistoryRows.map((r, vi) => {
                  const rowIndex = rows.findIndex(
                    (row) => row.localKey === r.localKey,
                  )
                  const isEditing = editingHistoryKey === r.localKey
                  return (
                    <Fragment key={r.localKey}>
                      {isEditing && rowIndex >= 0 ? (
                        <BulkInputDraftRow
                          {...draftRowProps}
                          r={rows[rowIndex]!}
                          rowIndex={rowIndex}
                          mode="history-edit"
                          onSaveHistory={saveHistoryEdit}
                          onCancelHistory={cancelHistoryEdit}
                        />
                      ) : (
                        <BulkInputHistoryRow
                          r={r}
                          showMembers={members.length > 0}
                          rowIndex={historySliceStart + vi}
                          isEditing={isEditing}
                          onOpenMenu={setHistoryRowMenuKey}
                        />
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
            </table>
          </section>
        </div>
      </div>
        <div
          className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            draftLedgerCompare.multisetMatch
              ? 'border-green-accent/35 bg-green-light/40 text-text-secondary'
              : 'border-amber-400/45 bg-amber-50/90 text-text-secondary'
          }`}
          role="status"
          aria-label="장부와 입력 크로스체크"
        >
          {draftLedgerCompare.multisetMatch ? (
            <p className="font-medium">
              {draftLedgerCompare.draftEligibleCount === 0 &&
              draftLedgerCompare.ledgerInMonthCount === 0
                ? '해당 월에는 장부·입력 모두 반영된 거래가 없습니다 (집합 일치).'
                : '해당 월 장부 거래와 입력 줄이 일치합니다.'}
            </p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">
                장부와 입력 유효 줄이 일치하지 않습니다. 캘린더 등에서 넣은 거래가 있거나, 입력 후 아직 반영되지 않았을 수 있습니다.
              </p>
              <p>
                건수: 장부 {draftLedgerCompare.ledgerInMonthCount}건 · 입력 반영 가능{' '}
                {draftLedgerCompare.draftEligibleCount}건
              </p>
              <p>
                수입 합: 장부 {won(draftLedgerCompare.ledgerIncomeSum)} · 입력{' '}
                {won(draftLedgerCompare.draftIncomeSum)}
              </p>
              <p>
                지출 합: 장부 {won(draftLedgerCompare.ledgerExpenseSum)} · 입력{' '}
                {won(draftLedgerCompare.draftExpenseSum)}
              </p>
            </div>
          )}
        </div>
        {historyRowMenuKey ? (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-history-menu-title"
            onClick={() => setHistoryRowMenuKey(null)}
          >
            <div
              className="w-full max-w-[16rem] rounded-[var(--radius-card)] bg-surface-raised p-5 shadow-[var(--shadow-card)]"
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id="bulk-history-menu-title"
                className="text-center text-base font-semibold text-text-primary"
              >
                항목 관리
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    const key = historyRowMenuKey
                    setHistoryRowMenuKey(null)
                    startHistoryEdit(key)
                  }}
                >
                  수정
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  className="w-full !border-danger !text-danger hover:!bg-danger/10"
                  onClick={() => {
                    setBulkRowDeleteKey(historyRowMenuKey)
                    setHistoryRowMenuKey(null)
                  }}
                >
                  삭제
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  className="w-full"
                  onClick={() => setHistoryRowMenuKey(null)}
                >
                  취소
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {bulkRowDeleteKey ? (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-row-delete-title"
            onClick={() => setBulkRowDeleteKey(null)}
          >
            <div
              className="w-full max-w-[18rem] rounded-[var(--radius-card)] bg-surface-raised p-6 shadow-[var(--shadow-card)]"
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id="bulk-row-delete-title"
                className="text-center text-base font-semibold text-text-primary"
              >
                정말로 삭제할까요?
              </p>
              <div className="mt-5 flex gap-3">
                <Button
                  type="button"
                  variant="outlined"
                  className="flex-1"
                  onClick={() => setBulkRowDeleteKey(null)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1 !border-danger !bg-danger"
                  onClick={() => {
                    const idx = rowsRef.current.findIndex(
                      (row) => row.localKey === bulkRowDeleteKey,
                    )
                    if (idx < 0) {
                      setBulkRowDeleteKey(null)
                      return
                    }
                    const snapshot = rowsRef.current
                    const rest = ensureWorkingRowOnTop(
                      snapshot.filter((_, j) => j !== idx),
                    )
                    onChangeRows(rest)
                    const historyCount = Math.max(0, rest.length - 1)
                    if (listPage > 1) {
                      setListPage((p) =>
                        Math.min(
                          p,
                          bulkListPageCount(historyCount, listPageSize),
                        ),
                      )
                    }
                    onApplyMonth(rest)
                    setBulkRowDeleteKey(null)
                    setEditingHistoryKey(null)
                    editingSnapshotRef.current = null
                  }}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-text-soft">
          <kbd className="rounded border border-border-default bg-neutral-cool px-1 py-px text-[0.65rem]">
            Enter
          </kbd>
          로 다음 칸,{' '}
          <kbd className="rounded border border-border-default bg-neutral-cool px-1 py-px text-[0.65rem]">
            Shift+Enter
          </kbd>
          로 이전 칸으로 이동합니다.{' '}
          맨 위 <span className="font-medium text-starbucks-green">입력</span> 칸에서 새 내용을 넣고{' '}
          <span className="font-medium text-starbucks-green">확인</span>을 누르면 아래 목록으로 내려갑니다.
          아래 목록의{' '}
          <span
            className="inline-flex align-middle text-text-muted"
            aria-hidden
          >
            <BulkRowManageIcon className="size-3" />
          </span>{' '}
          <span className="font-medium text-text-secondary">관리</span>에서 수정·삭제할 수 있습니다. 해당 달
          전체가 장부에 반영됩니다.
        </p>
      </Card>
  )
}
