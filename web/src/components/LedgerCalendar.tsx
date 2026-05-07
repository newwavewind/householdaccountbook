import { memo, useMemo } from 'react'
import { holidayLabel } from '../lib/holidays'
import type { DayRollup } from '../lib/dayTotals'

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

export interface LedgerCalendarProps {
  year: number
  monthIndex: number
  todayIso: string
  selectedIso: string | null
  rollups: Map<string, DayRollup>
  /** 달력 셀 미리보기용 (짧은 표기). */
  fmtCompact: Intl.NumberFormat
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
  fmtCompact,
  onSelectDay,
  onHover,
}: LedgerCalendarProps) {
  const cells = useMemo(
    () => buildGrid(year, monthIndex),
    [year, monthIndex],
  )

  return (
    <div className="w-full">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-sm font-medium text-text-soft md:text-base">
        {WEEK.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ iso, day, inMonth }) => {
          const hol = holidayLabel(iso)
          const r = rollups.get(iso)
          const hasTx = r && r.count > 0
          const isToday = iso === todayIso
          const isSel = iso === selectedIso

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              onMouseEnter={(e) =>
                onHover({ iso, clientX: e.clientX, clientY: e.clientY })
              }
              onMouseLeave={() => onHover(null)}
              className={[
                'relative flex flex-col items-center justify-start rounded-lg border px-0.5 py-2 text-center',
                hasTx && inMonth
                  ? 'min-h-[5.75rem] md:min-h-[6.75rem]'
                  : 'min-h-[3.5rem] md:min-h-[4.75rem]',
                inMonth
                  ? 'border-black/[0.08] bg-white'
                  : 'border-transparent bg-neutral-cool/50 text-text-soft/60',
                hol && inMonth ? 'ring-1 ring-inset ring-gold/40' : '',
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
              <span
                className={[
                  'text-base font-semibold tabular-nums md:text-lg',
                  inMonth ? 'text-[rgba(0,0,0,0.87)]' : '',
                  hol && inMonth ? 'text-gold' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {day}
              </span>
              {hol && inMonth ? (
                <span
                  className={[
                    'mt-0.5 w-full px-0.5 text-xs leading-tight text-gold md:text-[0.8125rem]',
                    hasTx ? 'line-clamp-1' : 'line-clamp-2',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {hol}
                </span>
              ) : null}
              {hasTx && r && inMonth ? (
                <div className="mt-auto flex w-full max-w-full flex-col gap-px self-stretch">
                  {r.preview.map((p, i) => (
                    <span
                      key={`${iso}-${i}`}
                      className={
                        p.type === 'income'
                          ? 'truncate text-left text-[0.625rem] font-semibold tabular-nums leading-tight text-semantic-income md:text-[0.6875rem]'
                          : 'truncate text-left text-[0.625rem] font-semibold tabular-nums leading-tight text-semantic-expense md:text-[0.6875rem]'
                      }
                      title={
                        p.type === 'income'
                          ? `수입 ${fmtCompact.format(p.amount)}`
                          : `지출 ${fmtCompact.format(p.amount)}`
                      }
                    >
                      {p.type === 'income' ? '+' : '−'}
                      {fmtCompact.format(p.amount)}
                    </span>
                  ))}
                  {r.restCount > 0 ? (
                    <span className="text-[0.6rem] font-medium text-text-soft md:text-[0.65rem]">
                      외 {r.restCount}건
                    </span>
                  ) : null}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
})
