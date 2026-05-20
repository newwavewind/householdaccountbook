import { memo, useMemo, type MouseEvent } from 'react'
import {
  buildLedgerContentLines,
  formatLedgerExpense,
  formatLedgerIncome,
  ledgerAmountSummary,
} from '../lib/calendarDayTicker'
import type { DayRollup } from '../lib/dayTotals'
import { noSpendAnimationDelaySec } from '../lib/noSpendChallenge'
import { NoSpendCelebrateBurst } from './NoSpendCelebrateBurst'
import { MarqueeTicker, type MarqueeSegment } from './MarqueeTicker'
import { MarqueeTickerRows, type MarqueeTickerRow } from './MarqueeTickerRows'

const WEEK = ['일', '월', '화', '수', '목', '금', '토'] as const

const CELL_MIN_H = 'min-h-[6.25rem] md:min-h-[7.5rem]'

/** 다이어리 달력과 동일한 격자·칸 테두리 (rounded-none, gap 격자선) */
const LEDGER_DAY_CELL =
  'calendar-day-cell relative flex w-full flex-col overflow-hidden rounded-none border-0 px-0.5 py-1.5 text-left transition-colors active:scale-[0.98] md:px-1 md:py-2'

const LEDGER_CELL_SURFACE = 'bg-surface-raised hover:bg-green-light/30'

const LEDGER_CELL_BODY =
  'relative z-[1] flex min-h-0 flex-1 flex-col gap-px pt-0.5'

/** 수입·지출 한 줄 — 모든 칸 동일 높이 (pt-1 + 1.05rem 본문) */
const LEDGER_AMOUNT_FOOTER =
  'mt-auto box-border flex h-[calc(0.25rem+1.05rem)] w-full min-w-0 shrink-0 items-center overflow-hidden border-t border-border-subtle pt-1 md:h-[calc(0.25rem+1.125rem)]'

const LEDGER_AMOUNT_TICKER =
  '!flex !h-[1.05rem] !min-h-0 !max-h-[1.05rem] !flex-none !items-center w-full overflow-hidden md:!h-[1.125rem] md:!max-h-[1.125rem]'

function LedgerAmountFooter({
  iso,
  amounts,
  amountTextClass,
}: {
  iso: string
  amounts: ReturnType<typeof ledgerAmountSummary>
  amountTextClass: string
}) {
  const segments: MarqueeSegment[] = []
  const ariaParts: string[] = []

  if (amounts != null && amounts.income > 0) {
    const text = formatLedgerIncome(amounts.income)
    segments.push({
      id: 'income',
      node: (
        <span className={`${amountTextClass} text-semantic-income`}>{text}</span>
      ),
    })
    ariaParts.push(`수입 ${text}`)
  }
  if (amounts != null && amounts.expense > 0) {
    const text = formatLedgerExpense(amounts.expense)
    segments.push({
      id: 'expense',
      node: (
        <span className={`${amountTextClass} text-semantic-expense`}>{text}</span>
      ),
    })
    ariaParts.push(`지출 ${text}`)
  }

  if (segments.length === 0) {
    return <div className={LEDGER_AMOUNT_FOOTER} aria-hidden />
  }

  return (
    <div className={LEDGER_AMOUNT_FOOTER}>
      <MarqueeTicker
        variant="cell"
        segments={segments}
        ariaLabel={ariaParts.join(' ')}
        staggerKey={`${iso}-amounts`}
        pauseOnHover={false}
        forceMarquee={segments.length > 1}
        className={LEDGER_AMOUNT_TICKER}
      />
    </div>
  )
}

function LedgerDayWatermark({
  day,
  watermarkClass,
}: {
  day: number
  watermarkClass: string
}) {
  return (
    <span
      aria-hidden
      className={[
        'pointer-events-none absolute left-1/2 top-[42%] z-0 -translate-x-1/2 -translate-y-1/2 select-none text-[2.4rem] font-semibold leading-none tabular-nums md:top-[44%] md:text-[3rem]',
        watermarkClass,
      ].join(' ')}
    >
      {day}
    </span>
  )
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}

function buildGrid(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1)
  const pad = start.getDay()
  const cells: { iso: string; day: number; inMonth: boolean }[] = []
  const gridStart = new Date(year, monthIndex, 1 - pad)
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push({
      iso: toIso(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === monthIndex,
    })
  }
  return cells
}

function ledgerContentRows(rollup: DayRollup | undefined): MarqueeTickerRow[] {
  const memoText =
    'text-[0.62rem] font-medium leading-tight text-text-soft md:text-[0.68rem]'
  return buildLedgerContentLines(rollup).map((line) => ({
    id: line.id,
    ariaLabel: line.text,
    node: <span className={memoText}>{line.text}</span>,
  }))
}

export interface LedgerCalendarProps {
  year: number
  monthIndex: number
  todayIso: string
  selectedIso: string | null
  rollups: Map<string, DayRollup>
  noSpendDays?: Set<string>
  /** true면 무지출 날만 달력 위에서 축하 강조 */
  celebrateNoSpend?: boolean
  onSelectDay: (iso: string) => void
  onHover: (
    detail: null | { iso: string; clientX: number; clientY: number },
  ) => void
}

export const LedgerCalendar = memo(function LedgerCalendar({
  year,
  monthIndex,
  todayIso,
  selectedIso,
  rollups,
  noSpendDays = new Set(),
  celebrateNoSpend = false,
  onSelectDay,
  onHover,
}: LedgerCalendarProps) {
  const cells = useMemo(
    () => buildGrid(year, monthIndex),
    [year, monthIndex],
  )

  const amountTextClass =
    'text-[0.625rem] font-semibold tabular-nums leading-tight md:text-[0.6875rem]'

  return (
    <div className="ledger-calendar w-full">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-sm font-medium text-text-soft md:text-base">
        {WEEK.map((d, i) => (
          <div
            key={d}
            className={i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="calendar-days-frame relative">
        <div className="calendar-days-grid relative z-[1]">
        {cells.map(({ iso, day, inMonth }, cellIdx) => {
          const hoverHandlers = {
            onMouseEnter: (e: MouseEvent<HTMLButtonElement>) =>
              onHover({ iso, clientX: e.clientX, clientY: e.clientY }),
            onMouseLeave: () => onHover(null),
          }

          if (!inMonth) {
            return (
              <button
                key={iso}
                type="button"
                aria-label={iso}
                onClick={() => onSelectDay(iso)}
                {...hoverHandlers}
                className={[LEDGER_DAY_CELL, CELL_MIN_H, LEDGER_CELL_SURFACE].join(
                  ' ',
                )}
              >
                <div className={LEDGER_CELL_BODY}>
                  <div className="min-h-0 flex-1" aria-hidden />
                  <LedgerAmountFooter
                    iso={iso}
                    amounts={null}
                    amountTextClass={amountTextClass}
                  />
                </div>
              </button>
            )
          }

          const isNoSpendCelebrate =
            celebrateNoSpend && noSpendDays.has(iso)

          const r = rollups.get(iso)
          const contentRows = ledgerContentRows(r)
          const amounts = ledgerAmountSummary(r)
          const hasContent = contentRows.length > 0
          const isToday = iso === todayIso
          const isSel = iso === selectedIso
          const isSunday = cellIdx % 7 === 0

          const watermarkClass = isSunday
            ? 'text-red-500/[0.11]'
            : 'text-text-primary/[0.08]'

          return (
            <button
              key={iso}
              type="button"
              aria-label={
                isNoSpendCelebrate
                  ? `${iso} 가계부, 무지출 축하`
                  : `${iso} 가계부`
              }
              onClick={() => onSelectDay(iso)}
              {...hoverHandlers}
              aria-pressed={isSel}
              className={[
                LEDGER_DAY_CELL,
                CELL_MIN_H,
                LEDGER_CELL_SURFACE,
                isNoSpendCelebrate ? 'ledger-no-spend-celebrate z-[2]' : '',
                isToday ? 'calendar-day-cell--today' : '',
                isSel ? 'calendar-day-cell--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                isNoSpendCelebrate
                  ? {
                      animationDelay: `${noSpendAnimationDelaySec(iso)}s`,
                    }
                  : undefined
              }
            >
              <LedgerDayWatermark day={day} watermarkClass={watermarkClass} />

              <div className={LEDGER_CELL_BODY}>
                {hasContent ? (
                  <MarqueeTickerRows
                    rows={contentRows}
                    staggerKeyPrefix={iso}
                  />
                ) : (
                  <div className="min-h-0 flex-1" aria-hidden />
                )}

                <LedgerAmountFooter
                  iso={iso}
                  amounts={amounts}
                  amountTextClass={amountTextClass}
                />
              </div>
              {isNoSpendCelebrate ? (
                <>
                  <NoSpendCelebrateBurst />
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-1 z-[4] flex justify-center px-0.5"
                    aria-hidden
                  >
                    <span className="ledger-no-spend-celebrate-badge rounded-md bg-gradient-to-r from-amber-400 via-yellow-200 via-30% to-green-400 px-2 py-0.5 text-[0.7rem] font-extrabold leading-none tracking-tight text-white shadow-[0_0_12px_rgba(255,200,0,0.7)] ring-2 ring-white/90 md:text-xs">
                      🎉 무지출 🎊
                    </span>
                  </div>
                </>
              ) : null}
            </button>
          )
        })}
        </div>
      </div>
    </div>
  )
})
