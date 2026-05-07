import { holidayLabel } from '../lib/holidays'
import type { DayRollup } from '../lib/dayTotals'

export function CalendarHoverTooltip({
  show,
  x,
  y,
  iso,
  rollup,
  fmt,
}: {
  show: boolean
  x: number
  y: number
  iso: string | null
  rollup: DayRollup | undefined
  fmt: Intl.NumberFormat
}) {
  if (!show || !iso) return null

  const hol = holidayLabel(iso)
  const label = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${iso}T12:00:00`))

  const income = rollup?.income ?? 0
  const expense = rollup?.expense ?? 0
  const count = rollup?.count ?? 0

  const left = Math.min(x + 12, typeof window !== 'undefined' ? window.innerWidth - 240 : x)
  const top = Math.min(y + 12, typeof window !== 'undefined' ? window.innerHeight - 160 : y)

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[60] max-w-[14rem] rounded-[var(--radius-card)] border border-black/[0.1] bg-white px-3 py-2.5 text-left text-sm shadow-[var(--shadow-card)]"
      style={{ left, top }}
    >
      <p className="font-semibold text-starbucks-green">{label}</p>
      {hol ? (
        <p className="mt-0.5 text-xs font-medium text-gold">{hol}</p>
      ) : null}
      <p className="mt-2 text-xs text-text-soft">
        수입{' '}
        <span className="font-medium text-semantic-income">
          {fmt.format(income)}
        </span>
      </p>
      <p className="text-xs text-text-soft">
        지출{' '}
        <span className="font-medium text-semantic-expense">
          {fmt.format(expense)}
        </span>
      </p>
      <p className="mt-1 text-xs text-text-soft">{count}건</p>
    </div>
  )
}
