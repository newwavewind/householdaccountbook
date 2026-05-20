import { noSpendBannerMessage } from '../lib/noSpendChallenge'

type Props = {
  count: number
  eligibleDayCount: number
  monthLabel: string
  active: boolean
  onToggleCelebrate: () => void
  className?: string
}

export function NoSpendChallengeBanner({
  count,
  eligibleDayCount,
  monthLabel,
  active,
  onToggleCelebrate,
  className = '',
}: Props) {
  const message = noSpendBannerMessage(count, eligibleDayCount)

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggleCelebrate}
      className={[
        'inline-flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left outline-none transition-all',
        active
          ? 'border-green-accent/60 bg-gradient-to-r from-amber-50/95 via-green-light/55 to-amber-50/95 shadow-md ring-2 ring-green-accent/30'
          : 'border-amber-200/80 bg-gradient-to-r from-amber-50/95 via-green-light/35 to-amber-50/90 shadow-sm hover:border-amber-300/90 hover:shadow-md',
        'focus-visible:ring-2 focus-visible:ring-green-accent/40',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={
        active
          ? `${monthLabel} 무지출 축하 표시 끄기`
          : `${monthLabel} 무지출 축하 표시 켜기`
      }
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/85 text-sm shadow-sm ring-1 ring-amber-200/60"
        aria-hidden
      >
        {count > 0 ? '🏆' : '🎯'}
      </span>
      <div className="min-w-0">
        <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-amber-800/80">
          {monthLabel} 무지출
        </p>
        <p className="text-xs font-bold leading-snug text-starbucks-green">
          {message}
        </p>
        {eligibleDayCount > 0 ? (
          <p className="text-[0.6rem] text-text-soft">
            <span className="font-semibold tabular-nums text-amber-800">
              {count}
            </span>
            일 / {eligibleDayCount}일
          </p>
        ) : null}
      </div>
    </button>
  )
}
