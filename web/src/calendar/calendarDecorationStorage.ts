/** 배경 사진이 깔리는 범위 */
export type CalendarPhotoScope = 'page' | 'calendar'

/** 배경 사진 맞춤 */
export type CalendarPhotoFit = 'full' | 'contain'

export type CalendarDecoration = {
  imageUrl?: string
  /** 배경 사진 농도 (12% ~ 90%) */
  opacity: number
  photoScope: CalendarPhotoScope
  photoFit: CalendarPhotoFit
}

const KEY = 'gaegyeobu-calendar-decoration-v2'

export const CALENDAR_DECO_CHANGED_EVENT = 'gaegyeobu-calendar-decoration-changed'

export const DEFAULT_CALENDAR_DECORATION: CalendarDecoration = {
  opacity: 0.26,
  photoScope: 'page',
  photoFit: 'full',
}

const OPACITY_MIN = 0.12
const OPACITY_MAX = 0.9

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
  return DEFAULT_CALENDAR_DECORATION.opacity
}

function parseImageUrl(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.startsWith('data:image/')
    ? raw
    : undefined
}

function parsePhotoScope(raw: unknown): CalendarPhotoScope {
  return raw === 'calendar' ? 'calendar' : 'page'
}

function parsePhotoFit(raw: unknown): CalendarPhotoFit {
  return raw === 'contain' ? 'contain' : 'full'
}

/** v1/v2 저장값 로드 */
export function loadCalendarDecoration(
  householdId?: string | null,
): CalendarDecoration {
  try {
    const raw = localStorage.getItem(storageKey(householdId))
    if (!raw) return { ...DEFAULT_CALENDAR_DECORATION }
    const p = JSON.parse(raw) as Record<string, unknown>
    const opacity = parseOpacity(p.opacity)
    const photoScope = parsePhotoScope(p.photoScope)
    const photoFit = parsePhotoFit(p.photoFit)
    const imageUrl = parseImageUrl(p.imageUrl)
    if (imageUrl) {
      return { imageUrl, opacity, photoScope, photoFit }
    }
    if (p.kind === 'photo') {
      return {
        imageUrl: parseImageUrl(p.imageUrl),
        opacity,
        photoScope,
        photoFit,
      }
    }
    return { opacity, photoScope, photoFit }
  } catch {
    return { ...DEFAULT_CALENDAR_DECORATION }
  }
}

export function saveCalendarDecoration(
  deco: CalendarDecoration,
  householdId?: string | null,
): void {
  try {
    const payload: CalendarDecoration = {
      opacity: deco.opacity,
      photoScope: deco.photoScope,
      photoFit: deco.photoFit,
      imageUrl: deco.imageUrl,
    }
    localStorage.setItem(storageKey(householdId), JSON.stringify(payload))
    window.dispatchEvent(new Event(CALENDAR_DECO_CHANGED_EVENT))
  } catch {
    /* ignore quota */
  }
}

export function hasCalendarPhoto(deco: CalendarDecoration): boolean {
  return !!deco.imageUrl
}
