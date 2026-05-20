import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import {
  CalendarDecoratePanel,
  isCalendarDecorateActive,
} from '../calendar/CalendarDecoratePanel'
import { useCalendarDecoration } from '../calendar/CalendarDecorationContext'
import {
  DEFAULT_CALENDAR_DECORATION,
  saveCalendarDecoration,
} from '../calendar/calendarDecorationStorage'
import { useLedger } from '../hooks/useLedger'
import { useThemePreference } from './ThemeContext'
import type { ThemePreference } from './themePreference'

const themeLabels: Record<ThemePreference, string> = {
  theme1: '테마1',
  theme2: '테마2',
  theme3: '테마3',
}

const PANEL_Z = 10000
const VIEWPORT_PAD = 8
const PANEL_WIDTH = 288

const panelSurfaceClass =
  'rounded-md border border-charcoal-border bg-surface-raised p-2.5 shadow-[var(--shadow-frap-stack)] theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong dark:border-border-strong'

function clampPanelDesktop(anchor: DOMRect, panelW: number, panelH: number) {
  let left = anchor.right - panelW
  left = Math.max(
    VIEWPORT_PAD,
    Math.min(left, window.innerWidth - panelW - VIEWPORT_PAD),
  )
  let top = anchor.bottom + VIEWPORT_PAD
  if (top + panelH > window.innerHeight - VIEWPORT_PAD) {
    top = anchor.top - panelH - VIEWPORT_PAD
  }
  top = Math.max(
    VIEWPORT_PAD,
    Math.min(top, window.innerHeight - panelH - VIEWPORT_PAD),
  )
  return { top, left }
}

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

function isDiaryDecorateRoute(pathname: string): boolean {
  return (
    pathname === '/calendar' ||
    (pathname.startsWith('/calendar/') && pathname !== '/calendar/recovery')
  )
}

export function AppearanceMenu() {
  const location = useLocation()
  const showDiaryDecorate = isDiaryDecorateRoute(location.pathname)
  const { householdId } = useLedger()
  const { decoration, setDecoration } = useCalendarDecoration()
  const {
    preference,
    setPreference,
    liquidGlass,
    setLiquidGlass,
    colorScheme,
    setColorScheme,
  } = useThemePreference()
  const [open, setOpen] = useState(false)
  const [decoErr, setDecoErr] = useState<string | null>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const glassId = useId()
  const darkId = useId()

  const decoActive = isCalendarDecorateActive(decoration)

  const summaryParts = [
    themeLabels[preference],
    showDiaryDecorate && decoActive ? '꾸미기' : null,
    liquidGlass === 'clear' ? 'Glass' : null,
    colorScheme === 'dark' ? 'Dark' : null,
  ].filter(Boolean)

  const reposition = () => {
    const panel = panelRef.current
    const btn = btnRef.current
    const isDesktop = window.matchMedia('(min-width: 768px)').matches

    if (!isDesktop) {
      setPanelStyle({
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: `min(100vw - ${VIEWPORT_PAD * 2}px, ${PANEL_WIDTH}px)`,
        maxHeight: `min(80vh, calc(100dvh - ${VIEWPORT_PAD * 2}px))`,
        zIndex: PANEL_Z + 1,
        visibility: 'visible',
      })
      return
    }

    if (!btn || !panel) return
    const anchor = btn.getBoundingClientRect()
    const { top, left } = clampPanelDesktop(
      anchor,
      panel.offsetWidth || PANEL_WIDTH,
      panel.offsetHeight,
    )
    setPanelStyle({
      position: 'fixed',
      top,
      left,
      width: PANEL_WIDTH,
      maxHeight: `min(80vh, calc(100dvh - ${VIEWPORT_PAD * 2}px))`,
      zIndex: PANEL_Z + 1,
      visibility: 'visible',
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return
    }
    reposition()
    const raf = requestAnimationFrame(reposition)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, showDiaryDecorate, decoration.kind, decoration.backgroundRgb])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
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

  const onDecoChange = (next: typeof decoration) => {
    setDecoration(next)
    saveCalendarDecoration(next, householdId)
  }

  const onDecoReset = () => {
    const reset = { ...DEFAULT_CALENDAR_DECORATION }
    onDecoChange(reset)
    setDecoErr(null)
  }

  const panelContent = (
    <>
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-text-soft">
        화면 스타일
      </p>

      <label className="mb-1 flex flex-col gap-0.5 px-1">
        <span className="text-[10px] font-medium text-text-soft">테마</span>
        <select
          value={preference}
          aria-label="테마 선택"
          className="w-full cursor-pointer rounded-md border border-charcoal-border bg-surface-raised py-1 pl-2 pr-6 text-[11px] font-semibold text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-green-accent/40 md:text-xs"
          onChange={(e) => setPreference(e.target.value as ThemePreference)}
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

      {showDiaryDecorate ? (
        <div className="mt-3 border-t border-border-muted pt-3">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-text-soft">
            다이어리 꾸미기
          </p>
          <CalendarDecoratePanel
            decoration={decoration}
            onChange={onDecoChange}
            onReset={onDecoReset}
            err={decoErr}
            setErr={setDecoErr}
          />
        </div>
      ) : null}
    </>
  )

  const panelPortal =
    open && typeof document !== 'undefined' ? (
      <>
        <div
          className="fixed inset-0 z-[10000] bg-black/40 md:pointer-events-none md:bg-transparent"
          aria-hidden
          onClick={() => setOpen(false)}
        />
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="화면·꾸미기 설정"
          className={`${panelSurfaceClass} overflow-y-auto overscroll-contain`}
          style={
            panelStyle ?? {
              position: 'fixed',
              top: -9999,
              left: VIEWPORT_PAD,
              width: `min(100vw - ${VIEWPORT_PAD * 2}px, ${PANEL_WIDTH}px)`,
              visibility: 'hidden',
              zIndex: PANEL_Z + 1,
            }
          }
          onMouseDown={(e) => e.stopPropagation()}
        >
          {panelContent}
        </div>
      </>
    ) : null

  return (
    <>
      <span className="relative inline-flex shrink-0">
        <button
          ref={btnRef}
          type="button"
          className={`inline-flex max-w-[9rem] items-center gap-1 rounded-md border py-0.5 pl-2 pr-1.5 text-[10px] font-semibold shadow-sm outline-none hover:bg-well focus-visible:ring-2 focus-visible:ring-green-accent/40 md:max-w-none md:py-1 md:pl-2.5 md:pr-2 md:text-xs theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong ${
            showDiaryDecorate && decoActive
              ? 'border-green-accent bg-green-light/50 text-starbucks-green'
              : 'border-charcoal-border bg-surface-raised text-text-primary'
          }`}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? panelId : undefined}
          aria-label="화면·꾸미기 설정"
          title="화면·꾸미기 설정"
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
      </span>
      {panelPortal ? createPortal(panelPortal, document.body) : null}
    </>
  )
}
