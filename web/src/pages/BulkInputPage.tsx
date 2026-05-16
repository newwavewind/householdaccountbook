import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLedger } from '../hooks/useLedger'
import type { BulkDraftRow } from '../bulkInput/draftRow'
import { emptyDraftRow } from '../bulkInput/draftRow'
import { draftsToTransactions } from '../bulkInput/buildFromDrafts'
import { MonthInputSection } from '../bulkInput/MonthInputSection'
import {
  loadBulkInputBundle,
  saveBulkInputBundle,
} from '../bulkInput/bulkInputStorage'
import {
  compareDraftMultisetToLedgerMonth,
  ledgerMonthIncomeExpenseSums,
} from '../bulkInput/compareMonthDraftLedger'
import { draftMonthTotalsForDisplay } from '../bulkInput/draftMonthTotals'
import { monthLabel } from '../bulkInput/monthUtils'
import {
  reconcileYearsFromLedger,
  transactionToBulkDraftRow,
} from '../bulkInput/ledgerToDraftProjection'
import type { Transaction } from '../types/transaction'

function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

function initialMonths(): BulkDraftRow[][] {
  return Array.from({ length: 12 }, () => [emptyDraftRow()])
}

type InputPageState = {
  year: number
  /** 연도별 12달 입력 — 없으면 그 연도 미편집 */
  years: Partial<Record<number, BulkDraftRow[][]>>
}

function hydrateState(nowYear: number): InputPageState {
  const blob = loadBulkInputBundle()
  if (!blob) return { year: nowYear, years: {} }
  return { year: blob.lastOpenYear, years: { ...blob.years } }
}

const YEAR_NAV_MIN = 1
const YEAR_NAV_MAX = 9999

export default function BulkInputPage() {
  const now = useMemo(() => new Date(), [])
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()
  const { replaceCalendarMonth, syncState, transactions, cloudMembers } = useLedger()

  const [st, setSt] = useState<InputPageState>(() => hydrateState(nowYear))
  const { year } = st

  const inputPanelRef = useRef<HTMLDivElement | null>(null)
  const [activeMonthIndex, setActiveMonthIndex] = useState<number>(() => {
    const initial = hydrateState(nowYear)
    return initial.year === nowYear ? nowMonth : 0
  })

  const applyYearChoice = useCallback((y: number) => {
    if (!Number.isFinite(y)) return
    const yi = Math.min(YEAR_NAV_MAX, Math.max(YEAR_NAV_MIN, Math.trunc(y)))
    setSt((prev) => ({
      year: yi,
      years:
        prev.years[yi] === undefined
          ? {
              ...prev.years,
              [yi]: initialMonths(),
            }
          : prev.years,
    }))
  }, [])

  const canGoOlder = year > YEAR_NAV_MIN
  const canGoNewer = year < YEAR_NAV_MAX
  const priorYear = year - 1
  const hasPriorYear = priorYear >= YEAR_NAV_MIN

  const draftsMatrix = useMemo(
    () => st.years[year] ?? initialMonths(),
    [st.years, year],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      saveBulkInputBundle({
        lastOpenYear: st.year,
        years: st.years,
      })
    }, 400)
    return () => clearTimeout(t)
  }, [st])

  const syncReady =
    syncState.mode !== 'cloud' || syncState.status === 'ready'

  useEffect(() => {
    // Supabase 로딩 중에는 동기화 생략 (미확인 초안 보호)
    if (syncState.mode === 'cloud' && syncState.status === 'loading') return
    startTransition(() => {
      setSt((prev) => reconcileYearsFromLedger(prev, transactions, syncReady))
    })
  }, [transactions, syncReady])

  useEffect(() => {
    setActiveMonthIndex(year === nowYear ? nowMonth : 0)
  }, [year, nowYear, nowMonth])

  const monthDraftLedgerCmp = useMemo(
    () =>
      Array.from({ length: 12 }, (_, mi) =>
        compareDraftMultisetToLedgerMonth(
          year,
          mi,
          transactions,
          draftsToTransactions(year, mi, draftsMatrix[mi] ?? []).ok,
        ),
      ),
    [year, transactions, draftsMatrix],
  )

  /** rows를 직접 받아 처리 — MonthInputSection이 rowsRef.current(최신)를 전달하므로 stale 없음 */
  const applyMonth = (latestRows: BulkDraftRow[], monthIndex: number, silent = false) => {
    const { ok, skippedCard, skippedDay } = draftsToTransactions(
      year,
      monthIndex,
      latestRows,
    )
    // latestRows가 빈 배열(삭제 액션)이면 해당 달을 비운다
    if (ok.length === 0) {
      if (latestRows.length === 0) {
        replaceCalendarMonth(year, monthIndex, [])
        setSt((prev) => {
          const base = [...(prev.years[prev.year] ?? initialMonths())]
          const nm = [...base]
          nm[monthIndex] = [emptyDraftRow()]
          return { year: prev.year, years: { ...prev.years, [prev.year]: nm } }
        })
      }
      return
    }
    const replacement: Transaction[] = ok.map((tx) => ({
      ...tx,
      id: crypto.randomUUID(),
    }))
    replaceCalendarMonth(year, monthIndex, replacement)
    if (!silent) {
      setSt((prev) => {
        const base = [...(prev.years[prev.year] ?? initialMonths())]
        const nm = [...base]
        nm[monthIndex] = [
          ...replacement.map(transactionToBulkDraftRow),
          emptyDraftRow(),
        ]
        return {
          year: prev.year,
          years: { ...prev.years, [prev.year]: nm },
        }
      })
      const parts = [
        `${replacement.length}건으로 ${year}년 ${monthIndex + 1}월 장부 줄을 교체했고, 표와 같은 내용으로 맞춰 두었습니다.`,
      ]
      if (skippedDay) parts.push(`무효 일 ${skippedDay}건`)
      if (skippedCard) parts.push(`카드 미선택 ${skippedCard}건`)
      window.alert(parts.join('\n'))
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-3 pb-20 pt-4 sm:px-4 md:px-6">
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3"
        role="group"
        aria-label="연도 선택"
        id="bulk-year-control"
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            disabled={!canGoOlder}
            aria-label={`한 해 이전(${year - 1}년)`}
            title="한 해 이전"
            className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-input-border bg-white text-lg leading-none text-starbucks-green outline-none transition-colors hover:bg-neutral-cool/50 disabled:pointer-events-none disabled:opacity-35"
            onClick={() => applyYearChoice(year - 1)}
          >
            ‹
          </button>
          <span className="min-w-[4.5rem] text-center text-lg font-semibold tabular-nums text-starbucks-green">
            {year}년
          </span>
          <button
            type="button"
            disabled={!canGoNewer}
            aria-label={`한 해 다음(${year + 1}년)`}
            title="한 해 다음"
            className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-input-border bg-white text-lg leading-none text-starbucks-green outline-none transition-colors hover:bg-neutral-cool/50 disabled:pointer-events-none disabled:opacity-35"
            onClick={() => applyYearChoice(year + 1)}
          >
            ›
          </button>
        </div>
        {syncState.mode === 'cloud' && syncState.status === 'ready' ? (
          <span className="text-xs text-text-soft">
            {syncState.cloudBackend === 'prisma'
              ? '로컬 DB API와 동기화'
              : 'Supabase와 동기화'}
          </span>
        ) : null}
      </div>

      <section aria-label="월별 입력" className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-starbucks-green">
            월 선택
          </p>
          <p className="mb-3 text-xs text-text-soft">
            월을 누르면 아래에 해당 달 입력 표가 열립니다. 표의 수입·지출은 유효한 입력 줄만 반영한
            합계입니다.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const rowsM = draftsMatrix[monthIndex] ?? [emptyDraftRow()]
              const dTotals = draftMonthTotalsForDisplay(year, monthIndex, rowsM)
              const cmp = monthDraftLedgerCmp[monthIndex]
              const selected = activeMonthIndex === monthIndex
              return (
                <button
                  key={monthIndex}
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`${year}년 ${monthLabel(monthIndex)} 입력`}
                  className={`rounded-[var(--radius-card)] border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'border-starbucks-green bg-green-light/50 ring-2 ring-starbucks-green/35'
                      : 'border-black/[0.08] bg-white hover:border-black/[0.12] hover:bg-neutral-cool/30'
                  }`}
                  onClick={() => {
                    setActiveMonthIndex(monthIndex)
                    requestAnimationFrame(() => {
                      inputPanelRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    })
                  }}
                >
                  <div className="font-semibold tabular-nums text-starbucks-green">
                    {monthLabel(monthIndex)}
                  </div>
                  <div className="mt-1 text-[0.65rem] leading-tight text-text-soft">
                    <span className="tabular-nums text-[rgba(0,0,0,0.75)]">
                      {won(dTotals.income)}
                    </span>
                    <span className="mx-0.5 text-black/25">/</span>
                    <span className="tabular-nums text-[rgba(0,0,0,0.75)]">
                      {won(dTotals.expense)}
                    </span>
                  </div>
                  {!cmp.multisetMatch ? (
                    <div className="mt-1 text-[0.6rem] font-medium text-amber-800/90">
                      장부와 차이
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div ref={inputPanelRef} id="bulk-input-active-month">
          <MonthInputSection
            year={year}
            monthIndex={activeMonthIndex}
            rows={draftsMatrix[activeMonthIndex] ?? [emptyDraftRow()]}
            draftLedgerCompare={monthDraftLedgerCmp[activeMonthIndex]}
            priorYearMonthLedgerTotals={
              hasPriorYear
                ? ledgerMonthIncomeExpenseSums(
                    transactions,
                    priorYear,
                    activeMonthIndex,
                  )
                : null
            }
            priorCalendarYear={hasPriorYear ? priorYear : null}
            members={cloudMembers}
            onChangeRows={(payload) =>
              setSt((prev) => {
                const base = [...(prev.years[prev.year] ?? initialMonths())]
                const prevMonth = [
                  ...(base[activeMonthIndex] ?? [emptyDraftRow()]),
                ]
                const nextMonth =
                  typeof payload === 'function' ? payload(prevMonth) : payload
                const next12 = [...base]
                next12[activeMonthIndex] = nextMonth
                return {
                  year: prev.year,
                  years: { ...prev.years, [prev.year]: next12 },
                }
              })
            }
            onApplyMonth={(latestRows) =>
              applyMonth(latestRows, activeMonthIndex, true)
            }
          />
        </div>
      </section>
    </main>
  )
}
