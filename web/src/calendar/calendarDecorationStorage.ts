export type CalendarDecoration = {
  imageUrl?: string
  /** 배경 사진 농도 (0.12 ~ 0.55) */
  opacity: number
}

const KEY = 'gaegyeobu-calendar-decoration-v2'

export const CALENDAR_DECO_CHANGED_EVENT = 'gaegyeobu-calendar-decoration-changed'

export const DEFAULT_CALENDAR_DECORATION: CalendarDecoration = {
  opacity: 0.26,
}

function storageKey(householdId: string | null | undefined): string {
  return householdId ? `${KEY}:${householdId}` : KEY
}

function parseOpacity(raw: unknown): number {
  if (typeof raw === 'number' && raw >= 0.12 && raw <= 0.55) return raw
  return DEFAULT_CALENDAR_DECORATION.opacity
}

function parseImageUrl(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.startsWith('data:image/')
    ? raw
    : undefined
}

/** v1(패턴·배경색) 또는 v2 저장값 로드 */
export function loadCalendarDecoration(
  householdId?: string | null,
): CalendarDecoration {
  try {
    const raw = localStorage.getItem(storageKey(householdId))
    if (!raw) return { ...DEFAULT_CALENDAR_DECORATION }
    const p = JSON.parse(raw) as Record<string, unknown>
    const imageUrl = parseImageUrl(p.imageUrl)
    const opacity = parseOpacity(p.opacity)
    if (imageUrl) return { imageUrl, opacity }
    if (p.kind === 'photo') {
      return {
        imageUrl: parseImageUrl(p.imageUrl),
        opacity,
      }
    }
    return { opacity }
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
