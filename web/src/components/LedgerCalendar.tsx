import { memo, useMemo } from 'react'
import {
  getCalendarDayLabels,
  isRedCalendarDay,
} from '../lib/holidays'
import {
  buildLedgerContentLines,
  formatLedgerExpense,
  formatLedgerIncome,
  ledgerAmountSummary,
} from '../lib/calendarDayTicker'
import type { DayRollup } from '../lib/dayTotals'
import { noSpendBadgeEmoji } from '../lib/noSpendChallenge'
import { MarqueeTickerRows, type MarqueeTickerRow } from './MarqueeTickerRows'

const WEEK = ['일', '월', '화', '수', '목', '금', '토'] as const

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

function ledgerContentRows(iso: string, rollup: DayRollup | undefined): MarqueeTickerRow[] {
  const memoText =
    'text-[0.62rem] font-medium leading-tight text-text-soft md:text-[0.68rem]'
  return buildLedgerContentLines(iso, rollup).map((line) => ({
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
  noSpendDays: Set<string>
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
  noSpendDays,
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
    <div className="w-full">
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
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ iso, day, inMonth }, cellIdx) => {
          const dayLabels = getCalendarDayLabels(iso)
          const r = rollups.get(iso)
          const hasTx = r && r.count > 0
          const contentRows = ledgerContentRows(iso, r)
          const amounts = ledgerAmountSummary(r)
          const hasContent = contentRows.length > 0
          const hasFooter = amounts !== null
          const isNoSpend = inMonth && noSpendDays.has(iso)
          const isToday = iso === todayIso
          const isSel = iso === selectedIso
          const isSunday = cellIdx % 7 === 0
          const isRedDay =
            inMonth &&
            (isSunday || isRedCalendarDay(dayLabels?.primaryKind))
          const cellMinH = 'min-h-[6.25rem] md:min-h-[7.5rem]'

          const watermarkClass = inMonth
            ? isRedDay
              ? 'text-red-500/[0.11]'
              : 'text-text-primary/[0.08]'
            : 'text-text-soft/[0.14]'

          return (
            <button
              key={iso}
              type="button"
              aria-label={
                isNoSpend ? `${iso} 가계부, 무지출 성공` : `${iso} 가계부`
              }
              onClick={() => onSelectDay(iso)}
              onMouseEnter={(e) =>
                onHover({ iso, clientX: e.clientX, clientY: e.clientY })
              }
              onMouseLeave={() => onHover(null)}
              className={[
                'relative flex w-full flex-col overflow-hidden rounded-lg border px-0.5 py-1.5 text-left md:py-2',
                cellMinH,
                inMonth
                  ? isNoSpend
                    ? 'border-amber-300/70 bg-gradient-to-br from-amber-50/95 via-surface-raised to-green-light/25'
                    : 'border-border-subtle bg-surface-raised'
                  : 'border-transparent bg-neutral-cool/50 text-text-soft/60',
                inMonth && isRedCalendarDay(dayLabels?.primaryKind)
                  ? 'ring-1 ring-inset ring-red-300/60'
                  : '',
                hasTx && inMonth
                  ? 'shadow-[0_0_0_1px_rgba(0,117,74,0.25)]'
                  : '',
                isToday
                  ? 'outline outline-2 outline-offset-[-2px] outline-green-accent/70'
                  : '',
                isSel ? 'bg-green-light/50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isNoSpend ? (
                <span
                  className="pointer-events-none absolute left-0.5 top-0.5 z-[2] flex items-center gap-0.5 rounded-md bg-amber-100/95 px-1 py-px text-[0.5625rem] font-bold leading-none text-amber-900 shadow-sm ring-1 ring-amber-300/50 md:text-[0.625rem]"
                  title="무지출 성공!"
                >
                  <span aria-hidden>{noSpendBadgeEmoji(iso)}</span>
                  <span className="sr-only">무지출</span>
                </span>
              ) : null}
              <span
                aria-hidden
                className={[
                  'pointer-events-none absolute left-1/2 top-[42%] z-0 -translate-x-1/2 -translate-y-1/2 select-none text-[2.4rem] font-semibold leading-none tabular-nums md:top-[44%] md:text-[3rem]',
                  watermarkClass,
                  isNoSpend ? 'text-amber-600/[0.12]' : '',
                ].join(' ')}
              >
                {day}
              </span>

              <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-px pt-0.5">
                {hasContent ? (
                  <MarqueeTickerRows
                    rows={contentRows}
                    staggerKeyPrefix={iso}
                    className={!inMonth ? 'opacity-70' : ''}
                  />
                ) : null}

                {hasFooter && amounts ? (
                  <div
                    className={[
                      'mt-auto flex w-full shrink-0 flex-col gap-px border-t pt-1',
                      inMonth ? 'border-border-subtle' : 'border-border-muted/80',
                    ].join(' ')}
                  >
                  {amounts.income > 0 ? (
                    <span
                      className={`${amountTextClass} text-semantic-income`}
                    >
                      {formatLedgerIncome(amounts.income)}
                    </span>
                  ) : null}
                  {amounts.expense > 0 ? (
                    <span
                      className={`${amountTextClass} text-semantic-expense`}
                    >
                      {formatLedgerExpense(amounts.expense)}
                    </span>
                  ) : null}
                  </div>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
})
