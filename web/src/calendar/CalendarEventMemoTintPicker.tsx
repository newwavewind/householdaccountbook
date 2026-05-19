import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  STICKY_TINT_LABEL,
  STICKY_TINT_ORDER,
  type StickyTint,
} from './calendarStickyNotesStorage'
import { STICKY_THEMES } from './stickyNoteTheme'

const BODY_PREVIEW: Record<StickyTint, string> = {
  white: '#ffffff',
  yellow: '#fffef5',
  green: '#eef8ef',
  pink: '#fff5f8',
  purple: '#f7f2ff',
  blue: '#f3f8ff',
  gray: '#f5f5f5',
  charcoal: '#3d3d3d',
}

const PANEL_Z = 10000
const VIEWPORT_PAD = 8
const PANEL_WIDTH = 208

function clampPanelPosition(
  anchor: DOMRect,
  panelW: number,
  panelH: number,
  menuAlign: 'left' | 'right',
): { top: number; left: number } {
  let left =
    menuAlign === 'right' ? anchor.right - panelW : anchor.left
  left = Math.max(
    VIEWPORT_PAD,
    Math.min(left, window.innerWidth - panelW - VIEWPORT_PAD),
  )

  let top = anchor.top - panelH - VIEWPORT_PAD
  if (top < VIEWPORT_PAD) {
    top = anchor.bottom + VIEWPORT_PAD
  }
  top = Math.max(
    VIEWPORT_PAD,
    Math.min(top, window.innerHeight - panelH - VIEWPORT_PAD),
  )

  return { top, left }
}

type Props = {
  value: StickyTint
  onPick: (t: StickyTint) => void
  'aria-label': string
  menuAlign?: 'left' | 'right'
  listLabel?: string
}

export function CalendarEventMemoTintPicker({
  value,
  onPick,
  'aria-label': ariaLabel,
  menuAlign = 'right',
  listLabel = '배경 색',
}: Props) {
  const theme = STICKY_THEMES[value]
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isCharcoal = value === 'charcoal'
  const swatchBorder = isCharcoal
    ? 'border-white/25'
    : 'border-black/15 dark:border-white/15'

  const reposition = () => {
    const btn = btnRef.current
    const menu = menuRef.current
    if (!btn || !menu) return
    const anchor = btn.getBoundingClientRect()
    const { top, left } = clampPanelPosition(
      anchor,
      menu.offsetWidth || PANEL_WIDTH,
      menu.offsetHeight,
      menuAlign,
    )
    setPanelStyle({
      position: 'fixed',
      top,
      left,
      width: PANEL_WIDTH,
      zIndex: PANEL_Z,
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
  }, [open, menuAlign, value])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
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

  const menuPanel = open ? (
    <div
      ref={menuRef}
      data-sticky-tint-menu
      role="listbox"
      aria-label={listLabel}
      style={
        panelStyle ?? {
          position: 'fixed',
          top: -9999,
          left: VIEWPORT_PAD,
          width: PANEL_WIDTH,
          visibility: 'hidden',
          zIndex: PANEL_Z,
        }
      }
      className={`rounded-lg border bg-surface-raised p-2 shadow-lg ${
        isCharcoal ? 'border-white/20' : 'border-black/10 dark:border-white/12'
      }`}
    >
      <p className="mb-1.5 px-1 text-[0.65rem] font-medium text-text-soft">
        {listLabel}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {STICKY_TINT_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            title={STICKY_TINT_LABEL[t]}
            className={`flex flex-col items-center gap-0.5 rounded-md border-2 p-0.5 text-[0.6rem] text-text-soft shadow-sm transition-transform active:scale-95 ${
              value === t ? 'ring-2 ring-starbucks-green ring-offset-1' : ''
            } ${swatchBorder}`}
            onClick={() => {
              onPick(t)
              setOpen(false)
            }}
          >
            <span
              className="block h-7 w-full rounded-sm border border-black/10 dark:border-white/12"
              style={{ backgroundColor: BODY_PREVIEW[t] }}
              aria-hidden
            />
            <span className="max-w-[3.25rem] truncate px-0.5">
              {STICKY_TINT_LABEL[t]}
            </span>
          </button>
        ))}
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`${theme.headerBtnClass} touch-manipulation`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="px-1 text-base font-bold leading-none">⋯</span>
      </button>
      {typeof document !== 'undefined' && menuPanel
        ? createPortal(menuPanel, document.body)
        : null}
    </>
  )
}
