import { useEffect, useId, useRef, useState } from 'react'
import { useThemePreference } from './ThemeContext'
import type { ThemePreference } from './themePreference'

const themeLabels: Record<ThemePreference, string> = {
  theme1: '테마1',
  theme2: '테마2',
  theme3: '테마3',
}

const panelClass =
  'absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,14rem)] rounded-md border border-charcoal-border bg-surface-raised p-2.5 shadow-[var(--shadow-frap-stack)] theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong dark:border-border-strong'

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1.5 text-[11px] font-medium text-text-primary hover:bg-well md:text-xs"
    >
      <span>{label}</span>
      <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className="h-5 w-9 rounded-full bg-black/15 transition-colors peer-checked:bg-green-accent peer-focus-visible:ring-2 peer-focus-visible:ring-green-accent/40 dark:bg-white/15"
          aria-hidden
        />
        <span
          className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
          aria-hidden
        />
      </span>
    </label>
  )
}

export function AppearanceMenu() {
  const {
    preference,
    setPreference,
    liquidGlass,
    setLiquidGlass,
    colorScheme,
    setColorScheme,
  } = useThemePreference()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const glassId = useId()
  const darkId = useId()

  const summaryParts = [
    themeLabels[preference],
    liquidGlass === 'clear' ? 'Glass' : null,
    colorScheme === 'dark' ? 'Dark' : null,
  ].filter(Boolean)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        className="inline-flex max-w-[7.5rem] items-center gap-1 rounded-md border border-charcoal-border bg-surface-raised py-0.5 pl-2 pr-1.5 text-[10px] font-semibold text-text-primary shadow-sm outline-none hover:bg-well focus-visible:ring-2 focus-visible:ring-green-accent/40 md:max-w-none md:py-1 md:pl-2.5 md:pr-2 md:text-xs theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="화면 표시 설정"
        title="화면 표시 설정"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 shrink-0 md:size-4"
          aria-hidden
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        <span className="truncate">{summaryParts.join(' · ')}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="화면 표시 설정"
          className={panelClass}
        >
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-text-soft">
            화면 스타일
          </p>

          <label className="mb-1 flex flex-col gap-0.5 px-1">
            <span className="text-[10px] font-medium text-text-soft">테마</span>
            <select
              value={preference}
              aria-label="테마 선택"
              className="w-full cursor-pointer rounded-md border border-charcoal-border bg-surface-raised py-1 pl-2 pr-6 text-[11px] font-semibold text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-green-accent/40 md:text-xs"
              onChange={(e) =>
                setPreference(e.target.value as ThemePreference)
              }
            >
              {(Object.keys(themeLabels) as ThemePreference[]).map((k) => (
                <option key={k} value={k}>
                  {themeLabels[k]}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-1 space-y-0.5 border-t border-border-muted pt-2">
            <ToggleRow
              id={glassId}
              label="Liquid Glass"
              checked={liquidGlass === 'clear'}
              onChange={(on) => setLiquidGlass(on ? 'clear' : 'off')}
            />
            <ToggleRow
              id={darkId}
              label="다크 모드"
              checked={colorScheme === 'dark'}
              onChange={(on) => setColorScheme(on ? 'dark' : 'light')}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
