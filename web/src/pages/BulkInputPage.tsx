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
import { compareDraftMultisetToLedgerMonth } from '../bulkInput/compareMonthDraftLedger'
import { BulkMonthSummaryBadges } from '../bulkInput/BulkMonthSummaryBadges'
import { BULK_PERIOD_SELECT } from '../bulkInput/bulkInputControls'
import { draftMonthTotalsForDisplay } from '../bulkInput/draftMonthTotals'
import { monthLabel } from '../bulkInput/monthUtils'
import {
  reconcileYearsFromLedger,
  transactionToBulkDraftRow,
} from '../bulkInput/ledgerToDraftProjection'
import type { Transaction } from '../types/transaction'

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

  const activeMonthTotals = useMemo(
    () =>
      draftMonthTotalsForDisplay(
        year,
        activeMonthIndex,
        draftsMatrix[activeMonthIndex] ?? [emptyDraftRow()],
      ),
    [year, activeMonthIndex, draftsMatrix],
  )

  /** rows를 직접 받아 처리 — MonthInputSection이 rowsRef.current(최신)를 전달하므로 stale 없음 */
  const applyMonth = (latestRows: BulkDraftRow[], monthIndex: number, silent = false) => {
    const { ok, skippedCard, skippedDay } = draftsToTransactions(
      year,
      monthIndex,
      latestRows,
    )
    // 반영 가능한 줄이 없으면 해당 달 장부를 비운다.
    // (삭제 후 빈 칸·placeholder만 남은 경우 ok는 0이지만 latestRows는 비어 있지 않을 수 있음 — 이때도 장부를 갱신해야
    // reconcile가 옛 거래로 표를 되살리지 않음)
    if (ok.length === 0) {
      replaceCalendarMonth(year, monthIndex, [])
      if (latestRows.length === 0) {
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
      <section
        aria-label="연·월 선택"
        id="bulk-year-control"
        className="mb-4 w-fit max-w-full rounded-[var(--radius-card)] border border-charcoal-border bg-green-light/40 px-2.5 py-2 shadow-sm theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong"
      >
        <div
          className="flex flex-wrap items-center justify-start gap-2"
          role="group"
          aria-label={`${year}년 월별 입력`}
        >
          <button
            type="button"
            disabled={!canGoOlder}
            aria-label={`한 해 이전(${year - 1}년)`}
            title="한 해 이전"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-neutral-cool/35 text-lg leading-none text-starbucks-green outline-none transition-colors hover:bg-green-light/45 disabled:pointer-events-none disabled:opacity-35"
            onClick={() => applyYearChoice(year - 1)}
          >
            ‹
          </button>

          <div className="inline-flex items-center gap-0 rounded-xl border border-border-subtle bg-neutral-cool/30 p-1 shadow-sm">
            <span className="inline-flex h-9 items-center px-3 font-sans text-sm font-semibold tabular-nums text-starbucks-green">
              {year}년
            </span>
            <span
              className="mx-0.5 h-6 w-px shrink-0 bg-border-muted/80"
              aria-hidden
            />
            <label htmlFor="bulk-month-select" className="sr-only">
              월 선택
            </label>
            <select
              id="bulk-month-select"
              aria-label={`${year}년 월 선택`}
              value={activeMonthIndex}
              className={BULK_PERIOD_SELECT}
              onChange={(e) => {
                const next = Number(e.target.value)
                setActiveMonthIndex(next)
                requestAnimationFrame(() => {
                  inputPanelRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                })
              }}
            >
              {Array.from({ length: 12 }, (_, monthIndex) => {
                const cmp = monthDraftLedgerCmp[monthIndex]
                return (
                  <option key={monthIndex} value={monthIndex}>
                    {monthLabel(monthIndex)}
                    {!cmp.multisetMatch ? ' · 차이' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          <BulkMonthSummaryBadges
            income={activeMonthTotals.income}
            expense={activeMonthTotals.expense}
          />

          <button
            type="button"
            disabled={!canGoNewer}
            aria-label={`한 해 다음(${year + 1}년)`}
            title="한 해 다음"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-neutral-cool/35 text-lg leading-none text-starbucks-green outline-none transition-colors hover:bg-green-light/45 disabled:pointer-events-none disabled:opacity-35"
            onClick={() => applyYearChoice(year + 1)}
          >
            ›
          </button>
        </div>
      </section>

      <section aria-label="월별 입력" className="flex flex-col gap-4">
        <div ref={inputPanelRef} id="bulk-input-active-month">
          <MonthInputSection
            year={year}
            monthIndex={activeMonthIndex}
            rows={draftsMatrix[activeMonthIndex] ?? [emptyDraftRow()]}
            draftLedgerCompare={monthDraftLedgerCmp[activeMonthIndex]}
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
