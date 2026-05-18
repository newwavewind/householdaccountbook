import { useThemePreference } from './ThemeContext'
import type { ThemePreference } from './themePreference'

const labels: Record<ThemePreference, string> = {
  theme1: '테마1',
  theme2: '테마2',
  theme3: '테마3',
}

const ordered: ThemePreference[] = ['theme1', 'theme2', 'theme3']

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
        className="max-w-[6.5rem] cursor-pointer rounded-full border border-border-subtle bg-surface-raised py-0.5 pl-2 pr-1 text-[10px] font-semibold text-text-primary shadow-sm outline-none ring-green-accent/0 focus-visible:ring-2 md:max-w-none md:py-1 md:pl-2.5 md:pr-2 md:text-xs theme2:rounded-md theme2:border-charcoal-border theme2:shadow-[var(--shadow-frap-base)] theme3:rounded-md theme3:border-border-strong"
      >
        {ordered.map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </select>
    </label>
  )
}
