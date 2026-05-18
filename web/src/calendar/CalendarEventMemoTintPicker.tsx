import { useEffect, useRef, useState } from 'react'
import {
  STICKY_TINT_LABEL,
  STICKY_TINT_ORDER,
  type StickyTint,
} from './calendarStickyNotesStorage'
import { STICKY_THEMES } from './stickyNoteTheme'

const BODY_PREVIEW: Record<StickyTint, string> = {
  yellow: '#fffef5',
  green: '#eef8ef',
  pink: '#fff5f8',
  purple: '#f7f2ff',
  blue: '#f3f8ff',
  gray: '#f5f5f5',
  charcoal: '#3d3d3d',
}

type Props = {
  value: StickyTint
  onPick: (t: StickyTint) => void
  'aria-label': string
  menuAlign?: 'left' | 'right'
}

export function CalendarEventMemoTintPicker({
  value,
  onPick,
  'aria-label': ariaLabel,
  menuAlign = 'right',
}: Props) {
  const theme = STICKY_THEMES[value]
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const isCharcoal = value === 'charcoal'
  const swatchBorder = isCharcoal ? 'border-white/25' : 'border-black/15'

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [open])

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <button
        type="button"
        className={theme.headerBtnClass}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="px-1 text-base font-bold leading-none">⋯</span>
      </button>
      {open ? (
        <div
          className={`absolute ${menuAlign === 'right' ? 'right-0' : 'left-0'} top-full z-[60] mt-1 w-52 rounded-lg border bg-surface-raised p-2 shadow-lg ${
            isCharcoal ? 'border-white/20' : 'border-black/10'
          }`}
          role="listbox"
          aria-label="메모지 색"
        >
          <p className="mb-1.5 px-1 text-[0.65rem] font-medium text-text-soft">
            메모지 색
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
                  className="block h-7 w-full rounded-sm border border-black/10"
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
      ) : null}
    </div>
  )
}
