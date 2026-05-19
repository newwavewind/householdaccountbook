import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DdaySummaryLine } from './ddayCompute'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return reduced
}

type Props = {
  lines: DdaySummaryLine[]
}

export function DdaySummaryTicker({ lines }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [hoverPause, setHoverPause] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  const durationSec = Math.min(110, Math.max(24, 10 + lines.length * 6.5))

  const actionBtnClass =
    'inline-flex min-h-[2.75rem] min-w-[4.5rem] shrink-0 items-center justify-center border-l border-border-subtle bg-surface-raised/80 px-2.5 text-xs font-semibold text-starbucks-green transition-colors hover:bg-green-light/35 md:min-h-11 md:px-3'

  if (lines.length === 0) {
    return (
      <div className="w-full min-w-0">
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-gradient-to-r from-ceramic/95 via-well/50 to-ceramic/95 shadow-sm">
          <div className="flex min-h-[2.75rem] items-stretch">
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

  const segmentItems = lines.map((line, i) => (
    <span
      key={line.id}
      className="inline-flex shrink-0 items-center text-sm text-text-primary md:text-[0.95rem]"
    >
      {i > 0 ? (
        <span className="mx-5 select-none text-gold/50" aria-hidden>
          ·
        </span>
      ) : null}
      <span className="font-medium">{line.text}</span>
    </span>
  ))

  const segmentDup = lines.map((line, i) => (
    <span
      key={`d-${line.id}`}
      className="inline-flex shrink-0 items-center text-sm text-text-primary md:text-[0.95rem]"
    >
      {i > 0 ? (
        <span className="mx-5 select-none text-gold/50" aria-hidden>
          ·
        </span>
      ) : null}
      <span className="font-medium">{line.text}</span>
    </span>
  ))

  return (
    <div className="w-full min-w-0">
      <div
        className="overflow-hidden rounded-xl border border-border-subtle bg-gradient-to-r from-ceramic/95 via-well/50 to-ceramic/95 shadow-sm"
        onMouseEnter={() => setHoverPause(true)}
        onMouseLeave={() => setHoverPause(false)}
      >
        <div className="flex min-h-[2.75rem] items-stretch">
          <Link
            to="/calendar/dday"
            title="디데이 설정"
            className="flex shrink-0 items-center border-r border-border-subtle bg-starbucks-green/[0.08] px-2 py-2 transition-colors hover:bg-starbucks-green/[0.14] md:px-3"
          >
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-starbucks-green md:text-xs">
              D-Day
            </span>
          </Link>

          <div className="relative min-h-[2.75rem] min-w-0 flex-1 overflow-hidden">
            {reducedMotion ? (
              <div
                className="overflow-x-auto overscroll-x-contain px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                tabIndex={0}
                aria-label="디데이 요약 · 가로로 스크롤"
              >
                <div className="flex w-max items-center whitespace-nowrap pr-4">
                  {segmentItems}
                </div>
              </div>
            ) : (
              <>
                <div
                  className={[
                    'dday-ticker-track',
                    hoverPause ? 'dday-ticker-paused' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    animationDuration: `${durationSec}s`,
                  }}
                >
                  <div className="flex shrink-0 items-center py-2 pl-3 pr-10">
                    {segmentItems}
                  </div>
                  <div
                    className="flex shrink-0 items-center py-2 pl-3 pr-10"
                    aria-hidden
                  >
                    {segmentDup}
                  </div>
                </div>
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-ceramic to-transparent"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-12 bg-gradient-to-l from-ceramic to-transparent"
                  aria-hidden
                />
              </>
            )}
          </div>

          <button
            type="button"
            className={actionBtnClass}
            aria-expanded={expanded}
            aria-controls="dday-summary-expanded"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '접기' : '전체 · 설정'}
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
