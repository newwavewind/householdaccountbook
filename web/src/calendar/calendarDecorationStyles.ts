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

/** 사진 — 페이지 main 단일 오버레이 */
export function usePageLevelPhotoOverlay(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco) && deco.photoScope === 'page'
}

/** 사진 — 월 달력 카드 안에만 */
export function useCalendarCardPhotoOverlay(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco) && deco.photoScope === 'calendar'
}

/** 페이지 전체 모드 — main·D-day·스티커·일정 상세 스크림용 CSS 변수 */
export function calendarDecorationHostStyle(
  deco: CalendarDecoration,
): CSSProperties | undefined {
  if (!usePageLevelPhotoOverlay(deco)) return undefined
  return {
    ['--calendar-deco-bg-rgb' as string]: '248, 245, 238',
    ['--calendar-deco-bg-gradient' as string]: 'none',
    ['--calendar-deco-bg-fill' as string]: '0.22',
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
  const opacity = Math.min(1, deco.opacity * strength)
  const contain = deco.photoFit === 'contain'
  return {
    backgroundImage: `url(${deco.imageUrl})`,
    backgroundSize: contain ? 'min(92%, 100%) auto' : 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    opacity,
  }
}
