const MONTH_EN = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const

type Props = {
  year: number
  monthIndex: number
  className?: string
}

export function CalendarMonthHeading({ year, monthIndex, className = '' }: Props) {
  return (
    <div
      className={[
        'flex min-w-[4.5rem] flex-col items-center gap-0.5 leading-none font-calendar-month',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${year}년 ${monthIndex + 1}월`}
    >
      <span className="text-xs font-medium tabular-nums tracking-wide text-text-soft md:text-sm">
        {year}
      </span>
      <span className="text-2xl font-bold tabular-nums text-text-primary md:text-[1.75rem]">
        {monthIndex + 1}
      </span>
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-starbucks-green md:text-xs">
        {MONTH_EN[monthIndex]}
      </span>
    </div>
  )
}
