import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  BULK_MONTH_SUMMARY_GRID,
  BULK_MONTH_SUMMARY_GUTTER,
  BULK_MONTH_SUMMARY_HALF,
  BULK_MONTH_SUMMARY_LABEL,
  BULK_MONTH_SUMMARY_TWIN_SHELL,
} from '../bulkInput/bulkMonthSummaryLayout'
import {
  compareDraftMultisetToLedgerMonth,
  ledgerMonthIncomeExpenseSums,
} from '../bulkInput/compareMonthDraftLedger'
import {
  reconcileYearsFromLedger,
  transactionToBulkDraftRow,
} from '../bulkInput/ledgerToDraftProjection'
import type { Transaction } from '../types/transaction'

function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 캘린더 장부 `date`(yyyy-mm-dd) 기준 연도 합계 */
function sumLedgerCalendarYear(
  txs: Transaction[],
  y: number,
): { income: number; expense: number } {
  let income = 0
  let expense = 0
  for (const t of txs) {
    const d = t.date
    if (typeof d !== 'string' || d.length < 4) continue
    const yr = Number(d.slice(0, 4))
    if (!Number.isFinite(yr) || yr !== y) continue
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense }
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
  const { replaceCalendarMonth, syncState, transactions, cloudMembers } = useLedger()

  const [st, setSt] = useState<InputPageState>(() => hydrateState(nowYear))
  const { year } = st

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

  const ledgerYearCompare = useMemo(() => {
    const cur = sumLedgerCalendarYear(transactions, year)
    const prv = hasPriorYear
      ? sumLedgerCalendarYear(transactions, priorYear)
      : null
    return { current: cur, prior: prv }
  }, [transactions, year, priorYear, hasPriorYear])

  const priorLedger = ledgerYearCompare.prior

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

  useEffect(() => {
    startTransition(() => {
      setSt((prev) => reconcileYearsFromLedger(prev, transactions))
    })
  }, [transactions])

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

  const applyMonth = (monthIndex: number, silent = false) => {
    const { ok, skippedCard, skippedDay } = draftsToTransactions(
      year,
      monthIndex,
      draftsMatrix[monthIndex] ?? [],
    )
    if (ok.length === 0) return
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6 sm:gap-4">
        <div>
          <h1 className="font-serif-display text-starbucks-green">입력</h1>
          <p className="mt-1 text-sm text-text-soft">
            내용을 입력하고 마지막 칸에서 Enter를 치면 장부에 자동으로 반영됩니다.
            캘린더 장부에서 거래를 추가·수정·삭제하면 해당 달 표도 자동으로 맞춰집니다.
          </p>
        </div>
        <Link
          to="/"
          className="text-sm font-semibold text-green-accent underline decoration-green-accent/30 underline-offset-2"
        >
          캘린더 장부로
        </Link>
      </div>

      <div className="mb-4 rounded-[var(--radius-card)] border border-black/[0.08] bg-white px-3 py-2.5 sm:mb-6 sm:px-4 sm:py-3">
        <div className="flex flex-col flex-wrap gap-y-2 sm:flex-row sm:items-center sm:gap-x-3 sm:gap-y-0">
          <div className={BULK_MONTH_SUMMARY_GUTTER} aria-hidden />
          <div
            id="bulk-year-control"
            className="flex min-w-0 w-full flex-[1_1_0%] flex-wrap items-stretch gap-2 sm:w-0 sm:flex-nowrap sm:items-center"
            role="group"
            aria-label="연도 선택"
          >
            <button
              type="button"
              disabled={!canGoOlder}
              aria-label={`한 해 이전(${year - 1}년)`}
              title="한 해 이전"
              className="inline-flex h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-input-border bg-white text-xl leading-none text-starbucks-green outline-none transition-colors hover:bg-neutral-cool/50 disabled:pointer-events-none disabled:opacity-35"
              onClick={() => applyYearChoice(year - 1)}
            >
              ‹
            </button>

            <div className="flex min-w-0 flex-[1_1_0%] overflow-hidden rounded-lg border border-black/[0.12] bg-[rgba(0,0,0,0.02)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <section
                className="flex min-w-0 flex-[1_1_0%] flex-col gap-2 px-3 py-3 text-center tabular-nums sm:px-4 sm:py-3.5"
                aria-label={`${year}년 장부 연간 합계`}
              >
                <p className="text-lg font-semibold tracking-tight text-starbucks-green sm:text-xl">
                  {year}년
                </p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-black/[0.06] pt-2.5 text-left sm:gap-x-4">
                  <div>
                    <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-text-soft">
                      수입
                    </dt>
                    <dd className="text-[0.8125rem] font-semibold text-[rgba(0,0,0,0.82)]">
                      {won(ledgerYearCompare.current.income)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-text-soft">
                      지출
                    </dt>
                    <dd className="text-[0.8125rem] font-semibold text-[rgba(0,0,0,0.82)]">
                      {won(ledgerYearCompare.current.expense)}
                    </dd>
                  </div>
                </dl>
              </section>
              <div className="w-px shrink-0 bg-black/[0.08]" aria-hidden />
              <button
                type="button"
                disabled={!hasPriorYear}
                onClick={() => hasPriorYear && applyYearChoice(priorYear)}
                aria-label={`직전 연도 ${priorYear}년 표로 바꿈`}
                title={hasPriorYear ? `${priorYear}년 표 보기` : undefined}
                className="flex min-w-0 flex-[1_1_0%] flex-col gap-2 px-3 py-3 text-center tabular-nums outline-none transition-colors hover:bg-black/[0.03] disabled:pointer-events-none disabled:opacity-40 sm:px-4 sm:py-3.5"
              >
                <p className="text-lg font-medium tracking-tight text-[rgba(0,0,0,0.45)] sm:text-xl">
                  {hasPriorYear ? `${priorYear}년` : '—'}
                </p>
                {hasPriorYear && priorLedger ? (
                  <dl
                    className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-black/[0.06] pt-2.5 text-left sm:gap-x-4"
                    aria-label={`${priorYear}년 장부 연간 합계(비교용)`}
                  >
                    <div>
                      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-text-soft">
                        수입
                      </dt>
                      <dd className="text-[0.8125rem] font-semibold text-[rgba(0,0,0,0.72)]">
                        {won(priorLedger.income)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-text-soft">
                        지출
                      </dt>
                      <dd className="text-[0.8125rem] font-semibold text-[rgba(0,0,0,0.72)]">
                        {won(priorLedger.expense)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <div
                    className="border-t border-black/[0.06] pt-2.5 text-left text-[0.7rem] leading-snug text-text-soft"
                    aria-hidden
                  >
                    비교할 이전 해가 없습니다.
                  </div>
                )}
              </button>
            </div>

            <button
              type="button"
              disabled={!canGoNewer}
              aria-label={`한 해 다음(${year + 1}년)`}
              title="한 해 다음"
              className="inline-flex h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-input-border bg-white text-xl leading-none text-starbucks-green outline-none transition-colors hover:bg-neutral-cool/50 disabled:pointer-events-none disabled:opacity-35"
              onClick={() => applyYearChoice(year + 1)}
            >
              ›
            </button>
          </div>
          <div className={BULK_MONTH_SUMMARY_GUTTER} aria-hidden />

          {syncState.mode === 'cloud' && syncState.status === 'ready' ? (
            <span className="w-full basis-full text-center text-xs text-text-soft">
              {syncState.cloudBackend === 'prisma'
                ? '장부는 로컬 DB API와 동기화됩니다.'
                : '장부는 Supabase와 동기화됩니다.'}
            </span>
          ) : null}
        </div>
        <p className="mt-3 border-t border-black/[0.06] pt-3 text-[0.7rem] leading-relaxed text-text-soft">
          위 연간 합계는{' '}
          <strong className="font-medium text-[rgba(0,0,0,0.5)]">
            캘린더 장부
          </strong>
          의 거래 <strong className="font-medium text-[rgba(0,0,0,0.5)]">일자 연도</strong>로
          더한 값입니다. 입력 탭 표만 수정한 내용은 반영 전까지 합계에 포함되지 않습니다.
        </p>
      </div>

      <section aria-label="월별 입력" className="flex flex-col gap-3">
        <p className="sr-only">
          월별 요약 줄: 왼쪽 절반은 해당 연도 입력 표 합계, 오른쪽 절반은 직전 연도
          같은 달 장부 합계입니다. 각 절반의 열 순서는 모두 수입, 지출입니다.
        </p>
        <div
          className="-mt-1 mb-1 flex flex-col gap-2 px-4 sm:flex-row sm:items-stretch sm:gap-x-3 sm:gap-y-0 sm:leading-none"
          aria-hidden
        >
          <div className={BULK_MONTH_SUMMARY_GUTTER} />
          <div className="min-w-0 w-full flex-1 sm:w-0">
            <div className={BULK_MONTH_SUMMARY_TWIN_SHELL}>
              <div className={BULK_MONTH_SUMMARY_HALF}>
                <div className={BULK_MONTH_SUMMARY_GRID}>
                  <span className={BULK_MONTH_SUMMARY_LABEL}>수입</span>
                  <span className={BULK_MONTH_SUMMARY_LABEL}>지출</span>
                </div>
              </div>
              <div className="w-px shrink-0 bg-black/[0.08]" aria-hidden />
              <div className={BULK_MONTH_SUMMARY_HALF}>
                <div className={BULK_MONTH_SUMMARY_GRID}>
                  <span className={BULK_MONTH_SUMMARY_LABEL}>수입</span>
                  <span className={BULK_MONTH_SUMMARY_LABEL}>지출</span>
                </div>
              </div>
            </div>
          </div>
          <div className={BULK_MONTH_SUMMARY_GUTTER} />
        </div>
        {Array.from({ length: 12 }, (_, monthIndex) => (
          <MonthInputSection
            key={monthIndex}
            year={year}
            monthIndex={monthIndex}
            priorYearMonthLedgerTotals={
              hasPriorYear
                ? ledgerMonthIncomeExpenseSums(
                    transactions,
                    priorYear,
                    monthIndex,
                  )
                : null
            }
            priorCalendarYear={hasPriorYear ? priorYear : null}
            defaultOpen={monthIndex === now.getMonth()}
            rows={draftsMatrix[monthIndex] ?? [emptyDraftRow()]}
            draftLedgerCompare={monthDraftLedgerCmp[monthIndex]}
            members={cloudMembers}
            onChangeRows={(payload) =>
              setSt((prev) => {
                const base = [...(prev.years[prev.year] ?? initialMonths())]
                const prevMonth = [...(base[monthIndex] ?? [emptyDraftRow()])]
                const nextMonth =
                  typeof payload === 'function' ? payload(prevMonth) : payload
                const next12 = [...base]
                next12[monthIndex] = nextMonth
                return {
                  year: prev.year,
                  years: { ...prev.years, [prev.year]: next12 },
                }
              })
            }
            onApplyMonth={() => applyMonth(monthIndex, true)}
          />
        ))}
      </section>
    </main>
  )
}
