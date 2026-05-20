import type { CSSProperties } from 'react'
import {
  hasCalendarPhoto,
  type CalendarDecoration,
} from './calendarDecorationStorage'

export function isCalendarDecorated(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco)
}

export function isCalendarPhotoDeco(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco)
}

/** 사진은 달력 페이지 main에만 오버레이 — 하위 호스트는 스크림만 */
export function usePageLevelPhotoOverlay(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco)
}

/** 사진 위 반투명 면·칸 스크림용 CSS 변수 */
export function calendarDecorationHostStyle(
  deco: CalendarDecoration,
): CSSProperties | undefined {
  if (!hasCalendarPhoto(deco)) return undefined
  return {
    ['--calendar-deco-bg-rgb' as string]: '248, 245, 238',
    ['--calendar-deco-bg-gradient' as string]: 'none',
    ['--calendar-deco-bg-fill' as string]: '0.78',
    ['--calendar-deco-page-alpha' as string]: '0.92',
  }
}

export const CALENDAR_DECO_STRENGTH = {
  card: 1,
  panel: 1,
  weekdays: 0.14,
  cells: 0.38,
} as const

export type CalendarDecoStrength = keyof typeof CALENDAR_DECO_STRENGTH

export function calendarDecorationLayerStyle(
  deco: CalendarDecoration,
  strength = 1,
): CSSProperties | undefined {
  if (!deco.imageUrl) return undefined
  const op = deco.opacity * strength
  return {
    backgroundImage: `url(${deco.imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: Math.min(0.55, op + 0.08),
  }
}
