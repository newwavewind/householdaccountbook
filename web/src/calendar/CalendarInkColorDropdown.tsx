import { useEffect, useRef, useState } from 'react'
import {
  CALENDAR_EVENT_INK_SWATCHES,
  type CalendarEventInkId,
} from './calendarEventInk'

type Props = {
  id: string
  'aria-label': string
  ink: CalendarEventInkId | undefined
  onPick: (id: CalendarEventInkId | undefined) => void
  /** 트리거 버튼에 추가 클래스 */
  triggerClassName?: string
  menuAlign?: 'left' | 'right'
  /** toolbar: 좁은 트리거, 팔레트는 위로 펼침 */
  density?: 'default' | 'toolbar'
}

export function CalendarInkColorDropdown({
  id,
  'aria-label': ariaLabel,
  ink,
  onPick,
  triggerClassName,
  menuAlign = 'left',
  density = 'default',
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const toolbar = density === 'toolbar'

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

  const current =
    CALENDAR_EVENT_INK_SWATCHES.find((s) => s.id === (ink ?? 'default')) ??
    CALENDAR_EVENT_INK_SWATCHES[0]

  const menuPos = toolbar
    ? menuAlign === 'right'
      ? 'bottom-full right-0 mb-1'
      : 'bottom-full left-0 mb-1'
    : menuAlign === 'right'
      ? 'right-0 top-full mt-1'
      : 'left-0 top-full mt-1'

  return (
    <div ref={wrapRef} className="relative w-fit min-w-0 shrink-0">
      <button
        id={id}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${ariaLabel} — ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        className={
          [
            toolbar
              ? 'flex h-7 w-9 max-w-9 touch-manipulation items-center justify-center gap-px rounded border border-black/18 bg-white/85 px-0.5 outline-none transition-colors hover:bg-black/[0.06] focus-visible:ring-2 focus-visible:ring-black/25'
              : 'flex min-h-11 w-[7.25rem] max-w-full touch-manipulation items-center justify-between gap-2 rounded-[var(--radius-card)] border border-border-default bg-surface-raised px-2.5 py-2 text-left shadow-sm outline-none transition-colors hover:bg-well focus-visible:ring-2 focus-visible:ring-green-accent/35',
            triggerClassName ?? '',
          ]
            .filter(Boolean)
            .join(' ')
        }
      >
        <span
          className={`block shrink-0 rounded-full ${current.dot} shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] ring-1 ring-black/10 ${toolbar ? 'h-3.5 w-3.5' : 'h-5 w-5'}`}
          aria-hidden
        />
        <span
          className={`leading-none text-text-soft ${toolbar ? 'text-[0.55rem]' : 'text-[0.7rem]'}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-[70] ${menuPos} w-[min(100vw-1.5rem,10.75rem)] rounded-[var(--radius-card)] border border-border-subtle bg-surface-raised p-2 shadow-[var(--shadow-card)]`}
        >
          <div className="grid grid-cols-3 gap-2">
            {CALENDAR_EVENT_INK_SWATCHES.map((s) => {
              const sel = (ink ?? 'default') === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  title={s.label}
                  aria-label={s.label}
                  onClick={() => {
                    onPick(s.id === 'default' ? undefined : s.id)
                    setOpen(false)
                  }}
                  className={[
                    'flex aspect-square w-full touch-manipulation items-center justify-center rounded-lg border bg-surface-raised outline-none focus-visible:ring-2 focus-visible:ring-green-accent/40',
                    sel
                      ? `ring-2 ring-offset-1 ring-offset-surface-raised ${s.ring} border-border-strong`
                      : 'border-border-muted hover:border-border-strong',
                  ].join(' ')}
                >
                  <span
                    className={`block h-6 w-6 rounded-full ${s.dot} shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]`}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
