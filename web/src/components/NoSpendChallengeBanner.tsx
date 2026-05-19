import { noSpendBannerMessage } from '../lib/noSpendChallenge'

type Props = {
  count: number
  eligibleDayCount: number
  monthLabel: string
}

export function NoSpendChallengeBanner({
  count,
  eligibleDayCount,
  monthLabel,
}: Props) {
  const message = noSpendBannerMessage(count, eligibleDayCount)

  return (
    <div
      className="mb-3 flex min-w-0 items-center gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/95 via-green-light/35 to-amber-50/90 px-3 py-2.5 shadow-[0_1px_0_rgba(0,117,74,0.08)] md:px-4"
      role="status"
      aria-live="polite"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-xl shadow-sm ring-1 ring-amber-200/60"
        aria-hidden
      >
        {count > 0 ? '🏆' : '🎯'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-800/80 md:text-xs">
          {monthLabel} 무지출 챌린지
        </p>
        <p className="text-sm font-bold leading-snug text-starbucks-green md:text-base">
          {message}
        </p>
        {eligibleDayCount > 0 ? (
          <p className="mt-0.5 text-[0.65rem] text-text-soft md:text-xs">
            지출 없는 날{' '}
            <span className="font-semibold tabular-nums text-amber-800">
              {count}
            </span>
            일 / 오늘까지 {eligibleDayCount}일 중
          </p>
        ) : null}
      </div>
    </div>
  )
}
