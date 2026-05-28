import { useRef } from 'react'
import { type CalendarEventInkId, isCalendarEventInkPreset } from './calendarEventInk'

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
  density = 'default',
}: Props) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const toolbar = density === 'toolbar'
  const customColor = ink && !isCalendarEventInkPreset(ink) ? ink : undefined
  const currentColor = customColor ?? '#111827'
  const currentLabel = customColor ? `직접색 ${customColor}` : '기본색'

  return (
    <div className="relative w-fit min-w-0 shrink-0">
      <button
        id={id}
        type="button"
        aria-label={`${ariaLabel} — ${currentLabel} 컬러피커`}
        className={
          [
            toolbar
              ? 'flex h-7 w-9 max-w-9 touch-manipulation items-center justify-center gap-px rounded border border-black/18 bg-white/85 px-0.5 outline-none transition-colors hover:bg-black/[0.06] focus-visible:ring-2 focus-visible:ring-black/25 dark:border-white/18 dark:bg-white/10 dark:hover:bg-white/10 dark:focus-visible:ring-white/25'
              : 'flex min-h-11 w-[7.25rem] max-w-full touch-manipulation items-center justify-between gap-2 rounded-[var(--radius-card)] border border-border-default bg-surface-raised px-2.5 py-2 text-left shadow-sm outline-none transition-colors hover:bg-well focus-visible:ring-2 focus-visible:ring-green-accent/35',
            triggerClassName ?? '',
          ]
            .filter(Boolean)
            .join(' ')
        }
      >
        <span
          className={`block shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] ring-1 ring-black/10 ${toolbar ? 'h-3.5 w-3.5' : 'h-5 w-5'}`}
          style={{ backgroundColor: currentColor }}
          aria-hidden
        />
        <span
          className={`leading-none text-text-soft ${toolbar ? 'text-[0.6rem]' : 'text-[0.75rem]'}`}
          aria-hidden
        >
          🎨
        </span>
      </button>
      <input
        ref={colorInputRef}
        type="color"
        className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0"
        value={currentColor}
        onChange={(e) => {
          onPick(e.target.value as CalendarEventInkId)
        }}
        aria-label={`${ariaLabel} 컬러 선택`}
      />
    </div>
  )
}
