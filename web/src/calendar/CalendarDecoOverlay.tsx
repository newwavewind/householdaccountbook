import type { ReactNode } from 'react'
import { useCalendarDecoration } from './CalendarDecorationContext'
import type { CalendarDecoStrength } from './calendarDecorationStyles'

type Props = {
  strength?: CalendarDecoStrength
  className?: string
}

const DETAIL_RADIUS = 'rounded-[calc(var(--radius-card)-1px)]'

/** 패턴 레이어 — 부모에 `relative overflow-hidden` + `calendar-deco-host` 필요 */
export function CalendarDecoOverlay({
  strength = 'card',
  className = '',
}: Props) {
  const { decoration, photoPageScrim, layerStyle } = useCalendarDecoration()
  const style = layerStyle(strength)
  if (!photoPageScrim || !style) return null
  if (decoration.photoScope !== 'page') return null

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 rounded-[inherit] ${className}`.trim()}
      style={style}
      aria-hidden
    />
  )
}

export function calendarDecoHostClass(decorated: boolean): string {
  return decorated
    ? 'calendar-deco-host calendar-deco-host--active relative overflow-hidden'
    : ''
}

/** 일정 상세 헤더·본문·툴바 — 부모/페이지 패턴 위 반투명 스크림만 */
export function CalendarDetailDecoBand({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const { photoPageScrim } = useCalendarDecoration()
  return (
    <div
      className={[
        'calendar-detail-deco-band relative overflow-hidden',
        photoPageScrim ? 'calendar-deco-scrim' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}

/** 일정 패널 블록 — 카드 전체 패턴 위에 반투명 스크림만 */
export function CalendarDecoSection({
  className = '',
  children,
  roundTop = false,
  roundBottom = false,
}: {
  className?: string
  children: ReactNode
  roundTop?: boolean
  roundBottom?: boolean
}) {
  const { photoPageScrim } = useCalendarDecoration()
  const round = [
    roundTop ? DETAIL_RADIUS.replace('rounded-', 'rounded-t-') : '',
    roundBottom ? DETAIL_RADIUS.replace('rounded-', 'rounded-b-') : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={[className, photoPageScrim ? 'calendar-deco-scrim' : '', round]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
