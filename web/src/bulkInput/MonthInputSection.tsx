import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../constants/categories'
import type { BulkDraftRow } from './draftRow'
import { BulkCardPicker } from './BulkCardPicker'
import { BulkCategoryPicker } from './BulkCategoryPicker'
import { emptyDraftRow } from './draftRow'
import { draftsToTransactions } from './buildFromDrafts'
import { daysInMonth, monthLabel } from './monthUtils'
import type { DraftLedgerComparison } from './compareMonthDraftLedger'
import {
  BULK_MONTH_SUMMARY_AMT_L,
  BULK_MONTH_SUMMARY_AMT_R,
  BULK_MONTH_SUMMARY_AMT_R_MUTED,
  BULK_MONTH_SUMMARY_EXPAND,
  BULK_MONTH_SUMMARY_GRID,
  BULK_MONTH_SUMMARY_HALF,
  BULK_MONTH_SUMMARY_MONTH_TITLE,
  BULK_MONTH_SUMMARY_TWIN_SHELL,
} from './bulkMonthSummaryLayout'

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
      ':scope > button[data-bulk-category-trigger], :scope > button[data-bulk-card-trigger]',
    )
    if (bulkPickerBtn instanceof HTMLButtonElement && !bulkPickerBtn.disabled) {
      out.push(bulkPickerBtn)
      continue
    }
    // 확인 버튼도 Tab/Enter 네비게이션에 포함 (마지막 포커스 위치)
    const confirmBtn = td.querySelector(':scope > button[data-confirm-row]')
    if (confirmBtn instanceof HTMLButtonElement && !confirmBtn.disabled) {
      out.push(confirmBtn)
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

export type BulkRowsUpdater =
  | BulkDraftRow[]
  | ((prev: BulkDraftRow[]) => BulkDraftRow[])

type Props = {
  year: number
  monthIndex: number
  defaultOpen?: boolean
  rows: BulkDraftRow[]
  onChangeRows: (payload: BulkRowsUpdater) => void
  /** rows는 최신 행 데이터를 항상 넘겨주므로 stale closure 없음 */
  onApplyMonth: (rows: BulkDraftRow[]) => void
  /** 선택 연·월 장부 vs 입력 유효 줄 집합 비교 */
  draftLedgerCompare: DraftLedgerComparison
  /** 직전 연도 동일 월 장부 수입·지출 (없으면 null) */
  priorYearMonthLedgerTotals: { income: number; expense: number } | null
  priorCalendarYear: number | null
  members?: string[]
}

export function MonthInputSection({
  year,
  monthIndex,
  defaultOpen,
  rows,
  onChangeRows,
  onApplyMonth,
  draftLedgerCompare,
  priorYearMonthLedgerTotals,
  priorCalendarYear,
  members = [],
}: Props) {
  // rows의 최신값을 ref로 추적 — render 중 갱신되므로 rAF 콜백에서 읽으면 항상 최신
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null)
  const [amountFocusLocalKey, setAmountFocusLocalKey] = useState<string | null>(
    null,
  )
  const [categoryOpenLocalKey, setCategoryOpenLocalKey] = useState<string | null>(
    null,
  )
  const [cardOpenLocalKey, setCardOpenLocalKey] = useState<string | null>(null)
  const maxDay = daysInMonth(year, monthIndex)
  const title = monthLabel(monthIndex)
  const hasPriorLedgerMonth =
    priorYearMonthLedgerTotals != null && priorCalendarYear != null

  const draftMonthTotals = useMemo(() => {
    const { ok } = draftsToTransactions(year, monthIndex, rows)
    const today = new Date()
    const isThisCalendarMonth =
      today.getFullYear() === year && today.getMonth() === monthIndex
    const list = isThisCalendarMonth
      ? ok.filter((tx) => {
          const dd = Number(tx.date.split('-')[2])
          return Number.isFinite(dd) && dd <= today.getDate()
        })
      : ok
    let income = 0
    let expense = 0
    for (const t of list) {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense, isThisCalendarMonth }
  }, [year, monthIndex, rows])

  const focusNextField = useCallback(
    (current: HTMLElement) => {
      const tbody = tbodyRef.current
      if (!tbody) return
      const tr = current.closest('tr')
      if (!(tr instanceof HTMLTableRowElement)) return
      const allRows = [
        ...tbody.querySelectorAll<HTMLTableRowElement>(':scope > tr'),
      ]
      const rowIdx = allRows.indexOf(tr)
      const list = collectRowFocusables(tr)
      const idx = list.indexOf(current)
      if (idx >= 0 && idx < list.length - 1) {
        list[idx + 1]!.focus()
        return
      }
      // End of row — auto-apply (rowsRef.current = latest rows after any React re-render)
      onApplyMonth(rowsRef.current)
      const nextRow = allRows[rowIdx + 1]
      if (nextRow) {
        const nextList = collectRowFocusables(nextRow)
        nextList[0]?.focus()
        return
      }
      onChangeRows((prev) => [...prev, emptyDraftRow()])
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const lastTr = tbody.querySelector('tr:last-child')
          if (lastTr instanceof HTMLTableRowElement) {
            collectRowFocusables(lastTr)[0]?.focus()
          }
        })
      })
    },
    [onChangeRows, onApplyMonth],
  )

  const handleFieldKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.nativeEvent.isComposing) return
      const tbody = tbodyRef.current
      if (!tbody) return

      if (e.key === 'Enter') {
        if (e.currentTarget.tagName === 'SELECT') {
          // select에서 Enter: onChange가 먼저 실행되므로 rAF로 상태 커밋 후 이동
          const el = e.currentTarget
          const tr = el.closest('tr')
          if (!(tr instanceof HTMLTableRowElement)) return
          const list = collectRowFocusables(tr)
          const idx = list.indexOf(el)
          if (e.shiftKey) {
            requestAnimationFrame(() => focusPrevInTable(el, tbody))
          } else if (idx < list.length - 1) {
            // 중간 select: 다음 필드로만 이동
            requestAnimationFrame(() => list[idx + 1]?.focus())
          } else {
            // 마지막 select: applyMonth 포함 행 이동
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
    [focusNextField],
  )

  return (
    <details
      open={defaultOpen}
      className="group rounded-[var(--radius-card)] border border-black/[0.08] bg-white"
    >
      <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-starbucks-green marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="flex min-w-0 w-full flex-1 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5">
            <span className={BULK_MONTH_SUMMARY_MONTH_TITLE}>{title}</span>
            <div
              className="min-w-0 w-full flex-1 sm:w-0"
              role="group"
              aria-label={`${year}년 ${monthIndex + 1}월 요약·직전 연도 동월 장부 비교`}
            >
              <div className={BULK_MONTH_SUMMARY_TWIN_SHELL}>
                <section
                  className={BULK_MONTH_SUMMARY_HALF}
                  aria-label={`${year}년 ${monthIndex + 1}월 입력 표(유효 줄) 합계`}
                >
                  <div className={BULK_MONTH_SUMMARY_GRID}>
                    <p className={BULK_MONTH_SUMMARY_AMT_L} aria-label={`당해 표 수입 ${won(draftMonthTotals.income)}`}>
                      {won(draftMonthTotals.income)}
                    </p>
                    <p className={BULK_MONTH_SUMMARY_AMT_L} aria-label={`당해 표 지출 ${won(draftMonthTotals.expense)}`}>
                      {won(draftMonthTotals.expense)}
                    </p>
                  </div>
                </section>
                <div className="w-px shrink-0 bg-black/[0.08]" aria-hidden />
                <section
                  className={BULK_MONTH_SUMMARY_HALF}
                  aria-label={
                    hasPriorLedgerMonth && priorCalendarYear != null
                      ? `${priorCalendarYear}년 ${monthIndex + 1}월 장부 합계(비교)`
                      : `${monthIndex + 1}월 직전 연도 장부 비교 없음`
                  }
                >
                  <div className={BULK_MONTH_SUMMARY_GRID}>
                    <p
                      className={
                        hasPriorLedgerMonth
                          ? BULK_MONTH_SUMMARY_AMT_R
                          : BULK_MONTH_SUMMARY_AMT_R_MUTED
                      }
                      aria-label={
                        hasPriorLedgerMonth && priorYearMonthLedgerTotals
                          ? `직전 연도 장부 수입 ${won(priorYearMonthLedgerTotals.income)}`
                          : '직전 연도 장부 수입 해당 없음'
                      }
                    >
                      {hasPriorLedgerMonth && priorYearMonthLedgerTotals
                        ? won(priorYearMonthLedgerTotals.income)
                        : '—'}
                    </p>
                    <p
                      className={
                        hasPriorLedgerMonth
                          ? BULK_MONTH_SUMMARY_AMT_R
                          : BULK_MONTH_SUMMARY_AMT_R_MUTED
                      }
                      aria-label={
                        hasPriorLedgerMonth && priorYearMonthLedgerTotals
                          ? `직전 연도 장부 지출 ${won(priorYearMonthLedgerTotals.expense)}`
                          : '직전 연도 장부 지출 해당 없음'
                      }
                    >
                      {hasPriorLedgerMonth && priorYearMonthLedgerTotals
                        ? won(priorYearMonthLedgerTotals.expense)
                        : '—'}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </span>
          <span className={BULK_MONTH_SUMMARY_EXPAND}>펼치기</span>
        </span>
      </summary>
      <Card className="border-0 border-t border-black/[0.06] bg-transparent px-4 pb-4 pt-2 shadow-none">
        <div className="mb-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/[0.08] text-left text-xs uppercase text-text-soft">
                <th className="py-2 pr-2 font-medium">일</th>
                <th className="py-2 pr-2 font-medium">구분</th>
                <th className="py-2 pr-2 font-medium">금액</th>
                <th className="py-2 pr-2 font-medium">카테고리</th>
                <th className="py-2 pr-2 font-medium">메모</th>
                <th className="py-2 pr-2 font-medium">결제</th>
                <th className="py-2 pr-2 font-medium">카드</th>
                {members.length > 0 && <th className="py-2 pr-2 font-medium">구성원</th>}
                <th className="py-2 pr-2 font-medium" />
                <th className="w-10 py-2 font-medium" />
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {rows.map((r, i) => (
                <tr key={r.localKey} className="border-b border-black/[0.05] align-middle">
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`${monthIndex + 1}월 일`}
                      inputMode="numeric"
                      placeholder="일"
                      className="w-12 rounded-lg border border-input-border px-2 py-1.5 tabular-nums outline-none focus:border-green-accent"
                      maxLength={2}
                      value={r.day}
                      onChange={(e) => {
                        const next = [...rows]
                        next[i] = { ...r, day: e.target.value.replace(/\D/g, '') }
                        onChangeRows(next)
                      }}
                      onKeyDown={handleFieldKeyDown}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      aria-label={`${monthIndex + 1}월 구분`}
                      className="rounded-lg border border-input-border px-2 py-1.5 outline-none focus:border-green-accent"
                      value={r.kind}
                      onChange={(e) => {
                        const k = e.target.value === 'income' ? 'income' : 'expense'
                        setCategoryOpenLocalKey(null)
                        setCardOpenLocalKey(null)
                        const next = [...rows]
                        next[i] = {
                          ...r,
                          kind: k,
                          category: '',
                          ...(k === 'income'
                            ? { paymentMethod: 'cash', cardBrand: '' }
                            : {}),
                        }
                        onChangeRows(next)
                      }}
                      onKeyDown={handleFieldKeyDown}
                    >
                      <option value="expense">지출</option>
                      <option value="income">수입</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label="금액"
                      inputMode="numeric"
                      placeholder="0"
                      className="min-w-[6rem] rounded-lg border border-input-border px-2 py-1.5 tabular-nums outline-none focus:border-green-accent"
                      value={
                        amountFocusLocalKey === r.localKey
                          ? amountDigitsOnly(r.amount)
                          : formatAmountCommas(r.amount)
                      }
                      onChange={(e) => {
                        const raw = amountDigitsOnly(e.target.value)
                        const next = [...rows]
                        next[i] = { ...r, amount: raw }
                        onChangeRows(next)
                      }}
                      onFocus={() => setAmountFocusLocalKey(r.localKey)}
                      onBlur={() => setAmountFocusLocalKey(null)}
                      onKeyDown={handleFieldKeyDown}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <BulkCategoryPicker
                      ariaLabel={`${monthIndex + 1}월 카테고리`}
                      rowLocalKey={r.localKey}
                      options={
                        r.kind === 'income'
                          ? INCOME_CATEGORIES
                          : EXPENSE_CATEGORIES
                      }
                      value={r.category}
                      isOpen={categoryOpenLocalKey === r.localKey}
                      onOpenThis={() => {
                        setCardOpenLocalKey(null)
                        setCategoryOpenLocalKey(r.localKey)
                      }}
                      onClose={() => setCategoryOpenLocalKey(null)}
                      onPick={(category) => {
                        const next = [...rows]
                        next[i] = { ...r, category }
                        onChangeRows(next)
                      }}
                      onFieldKeyDown={handleFieldKeyDown}
                      onNavigateAfterPick={focusNextField}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label="메모"
                      className="w-full max-w-[10rem] rounded-lg border border-input-border px-2 py-1.5 outline-none focus:border-green-accent"
                      value={r.memo}
                      onChange={(e) => {
                        const next = [...rows]
                        next[i] = { ...r, memo: e.target.value }
                        onChangeRows(next)
                      }}
                      onKeyDown={handleFieldKeyDown}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      aria-label="결제 수단"
                      disabled={r.kind !== 'expense'}
                      className="rounded-lg border border-input-border px-2 py-1.5 outline-none focus:border-green-accent disabled:opacity-40"
                      value={r.paymentMethod}
                      onChange={(e) => {
                        const pm = e.target.value === 'card' ? 'card' : 'cash'
                        if (pm === 'cash') setCardOpenLocalKey(null)
                        const next = [...rows]
                        next[i] = {
                          ...r,
                          paymentMethod: pm,
                          ...(pm === 'cash' ? { cardBrand: '' } : {}),
                        }
                        onChangeRows(next)
                      }}
                      onKeyDown={handleFieldKeyDown}
                    >
                      <option value="card">카드</option>
                      <option value="cash">현금</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <BulkCardPicker
                      ariaLabel="카드사"
                      rowLocalKey={r.localKey}
                      value={r.cardBrand}
                      disabled={
                        r.kind !== 'expense' || r.paymentMethod !== 'card'
                      }
                      isOpen={cardOpenLocalKey === r.localKey}
                      onOpenThis={() => {
                        setCategoryOpenLocalKey(null)
                        setCardOpenLocalKey(r.localKey)
                      }}
                      onClose={() => setCardOpenLocalKey(null)}
                      onPick={(cardBrand) => {
                        const next = [...rows]
                        next[i] = { ...r, cardBrand }
                        onChangeRows(next)
                      }}
                      onFieldKeyDown={handleFieldKeyDown}
                      onNavigateAfterPick={focusNextField}
                    />
                  </td>
                  {members.length > 0 && (
                    <td className="py-2 pr-2">
                      <select
                        aria-label="구성원"
                        className="rounded-lg border border-input-border px-2 py-1.5 text-sm outline-none focus:border-green-accent"
                        value={r.memberName}
                        onChange={(e) => {
                          const next = [...rows]
                          next[i] = { ...r, memberName: e.target.value }
                          onChangeRows(next)
                        }}
                        onKeyDown={handleFieldKeyDown}
                      >
                        <option value="">—</option>
                        {members.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="py-2 pr-2">
                    {/* 확인 버튼: React 상태가 완전히 반영된 시점에 호출되므로 stale 없음 */}
                    <button
                      type="button"
                      data-confirm-row="true"
                      className="rounded-md bg-starbucks-green px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-starbucks-green/80 focus:outline-none focus:ring-2 focus:ring-starbucks-green/50"
                      onClick={(e) => {
                        onApplyMonth(rowsRef.current)
                        // 다음 행 첫 번째 입력으로 포커스 이동
                        const tr = (e.currentTarget as HTMLElement).closest('tr')
                        if (tr instanceof HTMLTableRowElement) {
                          const allRows = [
                            ...tr.parentElement!.querySelectorAll<HTMLTableRowElement>(':scope > tr'),
                          ]
                          const nextTr = allRows[allRows.indexOf(tr) + 1]
                          if (nextTr) {
                            collectRowFocusables(nextTr)[0]?.focus()
                          }
                        }
                      }}
                    >
                      확인
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-danger underline decoration-danger/30"
                      onClick={() => {
                        setCategoryOpenLocalKey(null)
                        setCardOpenLocalKey(null)
                        const rest = rows.filter((_, j) => j !== i)
                        onChangeRows(rest.length > 0 ? rest : [emptyDraftRow()])
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outlined"
            className="!py-2 !text-xs !px-3"
            onClick={() =>
              onChangeRows((prev) => [...prev, emptyDraftRow()])
            }
          >
            행 추가
          </Button>
        </div>
        <div
          className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            draftLedgerCompare.multisetMatch
              ? 'border-green-accent/35 bg-green-light/40 text-[rgba(0,0,0,0.78)]'
              : 'border-amber-400/45 bg-amber-50/90 text-[rgba(0,0,0,0.82)]'
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
        <p className="mt-3 text-xs text-text-soft">
          일 칸에는 1부터 {maxDay}까지 숫자만 넣습니다. 금액은 숫자만 입력하면 되고, 다른 칸으로
          넘어가면 천 단위 콤마로 보입니다.{' '}
          <kbd className="rounded border border-black/15 bg-neutral-cool px-1 py-px text-[0.65rem]">
            Enter
          </kbd>
          로 다음 칸,{' '}
          <kbd className="rounded border border-black/15 bg-neutral-cool px-1 py-px text-[0.65rem]">
            Shift+Enter
          </kbd>
          로 이전 칸으로 이동합니다.{' '}
          <span className="font-medium text-starbucks-green">확인</span> 버튼을 누르면 해당 달 전체가 장부에 반영됩니다.
        </p>
      </Card>
    </details>
  )
}
