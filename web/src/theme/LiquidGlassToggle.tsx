import { useLiquidGlass } from './ThemeContext'

const labels = {
  off: 'Liquid Glass 끔',
  clear: 'Liquid Glass 켬',
} as const

function GlassIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="lg-btn-shine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="url(#lg-btn-shine)"
        fillOpacity="0.35"
      />
      <path
        d="M7 10h10M7 14h6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}

export function LiquidGlassToggle() {
  const { liquidGlass, cycleLiquidGlass } = useLiquidGlass()
  const active = liquidGlass === 'clear'

  return (
    <button
      type="button"
      className={[
        'liquid-glass-toggle inline-flex shrink-0 items-center gap-1 rounded-md border border-charcoal-border px-1.5 py-0.5 text-[10px] font-semibold shadow-sm transition-colors md:px-2 md:py-1 md:text-xs',
        'bg-surface-raised text-text-primary hover:bg-well',
        'outline-none focus-visible:ring-2 focus-visible:ring-green-accent/40',
        'theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong',
        active ? 'is-active text-green-accent' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-lg-mode={liquidGlass}
      aria-label={labels[liquidGlass]}
      aria-pressed={active}
      title={labels[liquidGlass]}
      onClick={cycleLiquidGlass}
    >
      <GlassIcon className="size-3.5 md:size-4" />
      <span className="hidden sm:inline">Glass</span>
    </button>
  )
}
