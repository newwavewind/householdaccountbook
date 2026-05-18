import { useThemePreference } from './ThemeContext'
import type { ThemePreference } from './themePreference'

const labels: Record<ThemePreference, string> = {
  light: '라이트',
  dark: '다크',
  system: '시스템',
  design2: '디자인2',
}

export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference()

  return (
    <label className="flex shrink-0 items-center gap-1">
      <span className="sr-only">화면 테마</span>
      <select
        value={preference}
        aria-label="화면 테마"
        onChange={(e) =>
          setPreference(e.target.value as ThemePreference)
        }
        className="max-w-[6.25rem] cursor-pointer rounded-full border border-border-subtle bg-surface-raised py-0.5 pl-2 pr-1 text-[10px] font-semibold text-text-primary shadow-sm outline-none ring-green-accent/0 focus-visible:ring-2 md:max-w-none md:py-1 md:pl-2.5 md:pr-2 md:text-xs design2:rounded-md design2:border-charcoal-border design2:shadow-[var(--shadow-frap-base)]"
      >
        {(Object.keys(labels) as ThemePreference[]).map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </select>
    </label>
  )
}
