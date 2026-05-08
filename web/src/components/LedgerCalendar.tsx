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
  onSelectDay,
  onHover,
}: LedgerCalendarProps) {
  const cells = useMemo(
    () => buildGrid(year, monthIndex),
    [year, monthIndex],
  )

  const fmtPlain = useMemo(
    () =>
      new Intl.NumberFormat('ko-KR', {
        maximumFractionDigits: 0,
      }),
    [],
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
          const memoLines = r?.memoLines ?? []
          const isToday = iso === todayIso
          const isSel = iso === selectedIso
          /** 모든 날짜: 위(날짜·금액) / 아래(메모 칸) 고정 */
          const cellMinH = 'min-h-[6.25rem] md:min-h-[7.5rem]'

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
                'relative flex w-full flex-col rounded-lg border px-0.5 py-1.5 text-left md:py-2',
                cellMinH,
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
              <div className="flex min-h-0 w-full flex-1 flex-col justify-start gap-0.5">
                <div className="w-full">
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
                    <span className="mt-0.5 block w-full line-clamp-1 text-left text-[0.65rem] font-medium leading-tight text-gold md:text-xs">
                      {hol}
                    </span>
                  ) : null}
                </div>
                {hasTx && r ? (
                  <div className="mt-0.5 flex w-full flex-col gap-px">
                    {r.income > 0 ? (
                      <span
                        className={[
                          'text-[0.625rem] font-semibold tabular-nums leading-tight text-semantic-income md:text-[0.6875rem]',
                          !inMonth ? 'opacity-80' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        +{fmtPlain.format(r.income)}
                      </span>
                    ) : null}
                    {r.expense > 0 ? (
                      <span
                        className={[
                          'text-[0.625rem] font-semibold tabular-nums leading-tight text-semantic-expense md:text-[0.6875rem]',
                          !inMonth ? 'opacity-80' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        −{fmtPlain.format(r.expense)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div
                className={[
                  'mt-auto flex min-h-[2rem] w-full shrink-0 flex-col justify-start border-t pt-1 text-[0.5625rem] leading-snug text-text-soft md:min-h-[2.25rem] md:text-[0.625rem]',
                  inMonth ? 'border-black/[0.08]' : 'border-black/[0.05]',
                ].join(' ')}
              >
                {memoLines[0] ? (
                  <>
                    <p
                      className={[
                        'line-clamp-2 break-words',
                        !inMonth ? 'opacity-70' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {memoLines[0]}
                    </p>
                    {memoLines[1] ? (
                      <p
                        className={[
                          'mt-px line-clamp-1 break-words',
                          !inMonth ? 'opacity-70' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {memoLines[1]}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <span className="min-h-[1.125rem] shrink-0" aria-hidden />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
})
