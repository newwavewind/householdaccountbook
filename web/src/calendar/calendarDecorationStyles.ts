import type { CSSProperties } from 'react'
import {
  hasCalendarPhoto,
  zoneHasPhoto,
  type CalendarDecoration,
  type CalendarPhotoZone,
  type CalendarZonePhoto,
} from './calendarDecorationStorage'

export function isCalendarDecorated(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco)
}

export function isCalendarPhotoDeco(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco)
}

export function calendarDecorationHostStyle(
  _deco: CalendarDecoration,
): CSSProperties | undefined {
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

export function zonePhotoLayerStyle(
  zone: CalendarZonePhoto,
  strength = 1,
): CSSProperties | undefined {
  if (!zone.imageUrl) return undefined
  const opacity = Math.min(1, zone.opacity * strength)
  const contain = zone.photoFit === 'contain'
  const x = Math.max(0, Math.min(100, zone.positionX))
  const y = Math.max(0, Math.min(100, zone.positionY))
  return {
    backgroundImage: `url(${zone.imageUrl})`,
    backgroundSize: contain ? 'min(92%, 100%) auto' : 'cover',
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: 'no-repeat',
    opacity,
  }
}

export function zoneLayerStyle(
  deco: CalendarDecoration,
  zoneId: CalendarPhotoZone,
  strength: CalendarDecoStrength = 'card',
): CSSProperties | undefined {
  return zonePhotoLayerStyle(deco.zones[zoneId], CALENDAR_DECO_STRENGTH[strength])
}

export function zonePhotoActive(
  deco: CalendarDecoration,
  zoneId: CalendarPhotoZone,
): boolean {
  return zoneHasPhoto(deco.zones[zoneId])
}
