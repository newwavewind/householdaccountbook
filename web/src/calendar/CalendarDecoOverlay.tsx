import type { ReactNode } from 'react'
import { useCalendarDecoration } from './CalendarDecorationContext'
import type { CalendarPhotoZone } from './calendarDecorationStorage'
import type { CalendarDecoStrength } from './calendarDecorationStyles'

type Props = {
  zone: CalendarPhotoZone
  strength?: CalendarDecoStrength
  className?: string
}

const DETAIL_RADIUS = 'rounded-[calc(var(--radius-card)-1px)]'

/** 영역별 배경 사진 레이어 */
export function CalendarDecoOverlay({
  zone,
  strength = 'card',
  className = '',
}: Props) {
  const { zoneLayerStyle, zonePhotoActive } = useCalendarDecoration()
  const style = zoneLayerStyle(zone, strength)
  if (!zonePhotoActive(zone) || !style) return null

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

/** 일정 상세 헤더·본문·툴바 — 사진 위 반투명 스크림 */
export function CalendarDetailDecoBand({
  className = '',
  children,
  overflowVisible = false,
}: {
  className?: string
  children: ReactNode
  overflowVisible?: boolean
}) {
  const { zonePhotoActive } = useCalendarDecoration()
  const scrim = zonePhotoActive('detail')
  return (
    <div
      className={[
        `calendar-detail-deco-band relative ${overflowVisible ? 'overflow-visible' : 'overflow-hidden'}`,
        scrim ? 'calendar-deco-scrim' : '',
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

/** 일정 패널 블록 */
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
  const { zonePhotoActive } = useCalendarDecoration()
  const scrim = zonePhotoActive('detail')
  const round = [
    roundTop ? DETAIL_RADIUS.replace('rounded-', 'rounded-t-') : '',
    roundBottom ? DETAIL_RADIUS.replace('rounded-', 'rounded-b-') : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={[className, scrim ? 'calendar-deco-scrim' : '', round]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
