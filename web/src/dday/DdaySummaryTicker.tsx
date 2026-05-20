import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDecoOverlay,
  calendarDecoHostClass,
} from '../calendar/CalendarDecoOverlay'
import { useCalendarDecoration } from '../calendar/CalendarDecorationContext'
import { MarqueeTicker, type MarqueeSegment } from '../components/MarqueeTicker'
import type { DdaySummaryLine } from './ddayCompute'

type Props = {
  lines: DdaySummaryLine[]
}

function linesToSegments(lines: DdaySummaryLine[]): MarqueeSegment[] {
  return lines.map((line) => ({
    id: line.id,
    node: <span className="font-medium">{line.text}</span>,
  }))
}

export function DdaySummaryTicker({ lines }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { zonePhotoActive } = useCalendarDecoration()
  const ddayPhoto = zonePhotoActive('dday')
  const hostClass = calendarDecoHostClass(ddayPhoto)

  const actionBtnClass = [
    'inline-flex min-h-[2.75rem] min-w-[4.5rem] shrink-0 items-center justify-center border-l border-border-subtle px-2.5 text-xs font-semibold text-starbucks-green transition-colors hover:bg-green-light/35 md:min-h-11 md:px-3',
    ddayPhoto ? '' : 'bg-surface-raised/80',
  ]
    .filter(Boolean)
    .join(' ')

  const ariaLabel = lines.map((l) => l.text).join(' · ')

  if (lines.length === 0) {
    return (
      <div className="w-full min-w-0">
        <div
          className={`dday-ticker-shell overflow-hidden rounded-xl border border-border-subtle bg-gradient-to-r from-ceramic/95 via-well/50 to-ceramic/95 shadow-sm ${hostClass}`}
        >
          <CalendarDecoOverlay zone="dday" strength="card" />
          <div className="relative z-[1] flex min-h-[2.75rem] items-stretch">
            <Link
              to="/calendar/dday"
              title="디데이 설정"
              className="flex shrink-0 items-center border-r border-border-subtle bg-starbucks-green/[0.08] px-2 py-2 transition-colors hover:bg-starbucks-green/[0.14] md:px-3"
            >
              <span className="text-[0.65rem] font-bold uppercase tracking-wide text-starbucks-green md:text-xs">
                D-Day
              </span>
            </Link>
            <p className="flex min-w-0 flex-1 items-center px-3 text-sm text-text-soft">
              생일·기념일·아기 개월수 등을 등록해 보세요
            </p>
            <Link to="/calendar/dday" className={actionBtnClass}>
              설정
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0">
      <div
        className={`dday-ticker-shell overflow-hidden rounded-xl border border-border-subtle bg-gradient-to-r from-ceramic/95 via-well/50 to-ceramic/95 shadow-sm ${hostClass}`}
      >
        <CalendarDecoOverlay zone="dday" strength="panel" />
        <div className="relative z-[1] flex min-h-[2.75rem] items-stretch">
          <Link
            to="/calendar/dday"
            title="디데이 설정"
            className="flex shrink-0 items-center border-r border-border-subtle bg-starbucks-green/[0.08] px-2 py-2 transition-colors hover:bg-starbucks-green/[0.14] md:px-3"
          >
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-starbucks-green md:text-xs">
              D-Day
            </span>
          </Link>

          <MarqueeTicker
            variant="banner"
            segments={linesToSegments(lines)}
            ariaLabel={ariaLabel}
            className="pointer-events-auto"
          />

          <button
            type="button"
            className={actionBtnClass}
            aria-expanded={expanded}
            aria-controls="dday-summary-expanded"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '접기' : '전체 입력'}
          </button>
        </div>
      </div>

      {expanded ? (
        <div
          id="dday-summary-expanded"
          className="mt-2 overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-muted px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              디데이 전체
            </p>
            <Link
              to="/calendar/dday"
              className="shrink-0 rounded-full border border-green-accent bg-green-light/45 px-3 py-1 text-xs font-semibold text-starbucks-green shadow-[0_1px_0_rgba(0,117,74,0.12)] transition-colors hover:border-green-accent hover:bg-green-light/70 active:scale-[0.98]"
            >
              설정
            </Link>
          </div>
          <ul
            className="max-h-[min(60vh,22rem)] overflow-y-auto divide-y divide-border-muted"
            role="list"
          >
            {lines.map((line) => (
              <li
                key={line.id}
                className="px-4 py-2.5 text-sm text-text-primary md:text-[0.95rem]"
              >
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
