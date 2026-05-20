/** 배경 사진 맞춤 */
export type CalendarPhotoFit = 'full' | 'contain'

/** 달력 페이지 영역별 배경 사진 */
export type CalendarPhotoZone = 'dday' | 'sticky' | 'calendar' | 'detail'

export type CalendarZonePhoto = {
  imageUrl?: string
  opacity: number
  photoFit: CalendarPhotoFit
  /** 배경 위치 0~100% */
  positionX: number
  positionY: number
}

export type CalendarDecoration = {
  zones: Record<CalendarPhotoZone, CalendarZonePhoto>
}

export const CALENDAR_PHOTO_ZONES: {
  id: CalendarPhotoZone
  label: string
}[] = [
  { id: 'dday', label: 'D-Day' },
  { id: 'sticky', label: '스티커 메모' },
  { id: 'calendar', label: '달력' },
  { id: 'detail', label: '일정 상세' },
]

const KEY = 'gaegyeobu-calendar-decoration-v3'

export const CALENDAR_DECO_CHANGED_EVENT = 'gaegyeobu-calendar-decoration-changed'

const OPACITY_MIN = 0.12
const OPACITY_MAX = 1

export const DEFAULT_ZONE_PHOTO: CalendarZonePhoto = {
  opacity: 0.26,
  photoFit: 'full',
  positionX: 50,
  positionY: 50,
}

function defaultZones(): Record<CalendarPhotoZone, CalendarZonePhoto> {
  return {
    dday: { ...DEFAULT_ZONE_PHOTO },
    sticky: { ...DEFAULT_ZONE_PHOTO },
    calendar: { ...DEFAULT_ZONE_PHOTO },
    detail: { ...DEFAULT_ZONE_PHOTO },
  }
}

export const DEFAULT_CALENDAR_DECORATION: CalendarDecoration = {
  zones: defaultZones(),
}

function storageKey(householdId: string | null | undefined): string {
  return householdId ? `${KEY}:${householdId}` : KEY
}

function parseOpacity(raw: unknown): number {
  if (typeof raw === 'number' && raw >= OPACITY_MIN && raw <= OPACITY_MAX) {
    return raw
  }
  if (typeof raw === 'number' && raw > OPACITY_MAX && raw <= 1) {
    return OPACITY_MAX
  }
  return DEFAULT_ZONE_PHOTO.opacity
}

function parseImageUrl(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.startsWith('data:image/')
    ? raw
    : undefined
}

function parsePhotoFit(raw: unknown): CalendarPhotoFit {
  return raw === 'contain' ? 'contain' : 'full'
}

function parsePosition(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && raw >= 0 && raw <= 100) return raw
  return fallback
}

function parseZonePhoto(raw: unknown): CalendarZonePhoto {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ZONE_PHOTO }
  const z = raw as Record<string, unknown>
  return {
    imageUrl: parseImageUrl(z.imageUrl),
    opacity: parseOpacity(z.opacity),
    photoFit: parsePhotoFit(z.photoFit),
    positionX: parsePosition(z.positionX, DEFAULT_ZONE_PHOTO.positionX),
    positionY: parsePosition(z.positionY, DEFAULT_ZONE_PHOTO.positionY),
  }
}

function parseZones(raw: unknown): Record<CalendarPhotoZone, CalendarZonePhoto> {
  const base = defaultZones()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  for (const { id } of CALENDAR_PHOTO_ZONES) {
    if (obj[id] != null) base[id] = parseZonePhoto(obj[id])
  }
  return base
}

function migrateLegacyPhoto(p: Record<string, unknown>): CalendarDecoration {
  const zones = defaultZones()
  const legacyUrl = parseImageUrl(p.imageUrl)
  if (!legacyUrl) return { zones }

  const opacity = parseOpacity(p.opacity)
  const photoFit = parsePhotoFit(p.photoFit)
  const photoScope = p.photoScope === 'calendar' ? 'calendar' : 'page'
  const patch = { imageUrl: legacyUrl, opacity, photoFit }

  if (photoScope === 'calendar') {
    zones.calendar = { ...zones.calendar, ...patch }
  } else {
    for (const { id } of CALENDAR_PHOTO_ZONES) {
      zones[id] = { ...zones[id], ...patch }
    }
  }
  return { zones }
}

export function loadCalendarDecoration(
  householdId?: string | null,
): CalendarDecoration {
  try {
    const v3 = localStorage.getItem(storageKey(householdId))
    if (v3) {
      const p = JSON.parse(v3) as Record<string, unknown>
      return { zones: parseZones(p.zones) }
    }
    const v2 = localStorage.getItem(
      householdId ? `gaegyeobu-calendar-decoration-v2:${householdId}` : 'gaegyeobu-calendar-decoration-v2',
    )
    if (v2) {
      return migrateLegacyPhoto(JSON.parse(v2) as Record<string, unknown>)
    }
    return { zones: defaultZones() }
  } catch {
    return { zones: defaultZones() }
  }
}

export function saveCalendarDecoration(
  deco: CalendarDecoration,
  householdId?: string | null,
): void {
  try {
    localStorage.setItem(storageKey(householdId), JSON.stringify(deco))
    window.dispatchEvent(new Event(CALENDAR_DECO_CHANGED_EVENT))
  } catch {
    /* ignore quota */
  }
}

export function zoneHasPhoto(zone: CalendarZonePhoto): boolean {
  return !!zone.imageUrl
}

export function hasCalendarPhoto(deco: CalendarDecoration): boolean {
  return CALENDAR_PHOTO_ZONES.some(({ id }) => zoneHasPhoto(deco.zones[id]))
}

export function cloneCalendarDecoration(deco: CalendarDecoration): CalendarDecoration {
  return {
    zones: {
      dday: { ...deco.zones.dday },
      sticky: { ...deco.zones.sticky },
      calendar: { ...deco.zones.calendar },
      detail: { ...deco.zones.detail },
    },
  }
}
