import {
  calendarLabelMutedClass,
  calendarLabelTextClass,
  getCalendarDayLabels,
} from '../lib/holidays'

type Props = {
  iso: string
  /** 달력 칸: 작은 글씨·최대 2줄 */
  variant?: 'cell' | 'detail'
  className?: string
}

export function CalendarDayLabelsInline({
  iso,
  variant = 'cell',
  className = '',
}: Props) {
  const labels = getCalendarDayLabels(iso)
  if (!labels || labels.entries.length === 0) return null

  if (variant === 'detail') {
    return (
      <div className={`flex flex-wrap gap-x-2 gap-y-1 ${className}`.trim()}>
        {labels.entries.map((e) => (
          <span
            key={`${e.kind}-${e.name}`}
            className={`text-sm ${calendarLabelMutedClass(e.kind)}`}
          >
            {e.name}
          </span>
        ))}
      </div>
    )
  }

  const shown = labels.entries.slice(0, 2)
  return (
    <div
      className={`line-clamp-2 space-y-0.5 ${className}`.trim()}
      title={labels.text}
    >
      {shown.map((e) => (
        <span
          key={`${e.kind}-${e.name}`}
          className={`block line-clamp-1 text-left text-[0.62rem] font-medium leading-tight md:text-[0.68rem] ${calendarLabelTextClass(e.kind)}`}
        >
          {e.name}
        </span>
      ))}
    </div>
  )
}
