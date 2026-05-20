const SPARKS = [
  '✨',
  '⭐',
  '★',
  '✦',
  '🎉',
  '🎊',
  '💫',
  '🌟',
  '✨',
  '⭐',
  '🎉',
  '★',
]

/** 무지출 칸 위 축하 스파클 (CSS) */
export function NoSpendCelebrateBurst() {
  return (
    <div
      className="ledger-no-spend-fireworks pointer-events-none absolute inset-0 z-[3] overflow-hidden rounded-lg"
      aria-hidden
    >
      <span className="ledger-no-spend-ring-burst absolute left-1/2 top-1/2 size-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="ledger-no-spend-firework-particle absolute text-[0.6rem] leading-none md:text-sm"
          style={{
            left: `${5 + (i * 11) % 78}%`,
            top: `${4 + (i * 13) % 62}%`,
            animationDelay: `${i * 0.15}s`,
            animationDuration: `${1.4 + (i % 3) * 0.3}s`,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  )
}
