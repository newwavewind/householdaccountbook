export type CalendarDecoKind =
  | 'none'
  | 'dots'
  | 'stripes'
  | 'grid'
  | 'waves'
  | 'bubbles'
  | 'honeycomb'
  | 'star'
  | 'speckle'
  | 'checker'
  | 'photo'

export type CalendarBackgroundMode = 'solid' | 'gradient'

export type CalendarDecoration = {
  kind: CalendarDecoKind
  /** rgba용 "r, g, b" (패턴 색) */
  patternRgb: string
  /** 배경 사용(패턴 없이도 가능) */
  useBackground: boolean
  /** 단색 | 그라데이션 */
  backgroundMode: CalendarBackgroundMode
  /** calendarBackgroundPresets id */
  backgroundPresetId: string
  /** rgba용 "r, g, b" (칸·반투명 면 기준색) */
  backgroundRgb: string
  /** 날짜 칸 배경 불투명도 (0~1, 패턴 비침) */
  backgroundFill: number
  /** 페이지·헤더 바탕 투명도 (0.2~1) */
  backgroundPageAlpha: number
  /** 배경색 농도 (0~1, 0=연함·1=원색) */
  backgroundDensity: number
  /** 0.08 ~ 0.55 */
  opacity: number
  imageUrl?: string
}

const KEY = 'gaegyeobu-calendar-decoration-v1'

export const CALENDAR_DECO_CHANGED_EVENT = 'gaegyeobu-calendar-decoration-changed'

export const DEFAULT_CALENDAR_DECORATION: CalendarDecoration = {
  kind: 'none',
  patternRgb: '0, 117, 74',
  useBackground: true,
  backgroundMode: 'solid',
  backgroundPresetId: 'sand',
  backgroundRgb: '120, 110, 95',
  backgroundFill: 0.78,
  backgroundPageAlpha: 0.92,
  backgroundDensity: 1,
  opacity: 0.26,
}

/** 패턴 색 14종 */
export const CALENDAR_DECO_PATTERN_PRESETS = [
  { id: 'green', label: '초록', rgb: '0, 117, 74' },
  { id: 'sand', label: '베이지', rgb: '120, 110, 95' },
  { id: 'rose', label: '로즈', rgb: '180, 120, 130' },
  { id: 'slate', label: '슬레이트', rgb: '90, 100, 115' },
  { id: 'mint', label: '민트', rgb: '72, 175, 155' },
  { id: 'lavender', label: '라벤더', rgb: '140, 130, 190' },
  { id: 'peach', label: '피치', rgb: '230, 160, 130' },
  { id: 'sky', label: '하늘', rgb: '100, 160, 210' },
  { id: 'coral', label: '코랄', rgb: '220, 110, 100' },
  { id: 'gold', label: '골드', rgb: '190, 160, 80' },
  { id: 'plum', label: '자두', rgb: '130, 80, 120' },
  { id: 'lime', label: '라임', rgb: '130, 195, 90' },
  { id: 'cocoa', label: '코코아', rgb: '110, 85, 70' },
  { id: 'lilac', label: '라일락', rgb: '175, 150, 210' },
] as const

function parseBackgroundMode(raw: unknown): CalendarBackgroundMode {
  return raw === 'gradient' ? 'gradient' : 'solid'
}

function parseRgb(
  raw: unknown,
  fallback: string,
): string {
  return typeof raw === 'string' && raw.includes(',') ? raw : fallback
}

function storageKey(householdId: string | null | undefined): string {
  return householdId ? `${KEY}:${householdId}` : KEY
}

const VALID_DECO_KINDS: CalendarDecoKind[] = [
  'none',
  'dots',
  'stripes',
  'grid',
  'waves',
  'bubbles',
  'honeycomb',
  'star',
  'speckle',
  'checker',
  'photo',
]

const REMOVED_DECO_KINDS = new Set([
  'diamond',
  'cross',
  'chevron',
  'christmas',
  'heart',
  'smile',
  'cloud',
  'sparkle',
  'petal',
  'leaf',
  'lace',
])

function parseKind(raw: unknown): CalendarDecoKind {
  if (typeof raw === 'string' && REMOVED_DECO_KINDS.has(raw)) return 'none'
  if (typeof raw === 'string' && (VALID_DECO_KINDS as string[]).includes(raw)) {
    return raw as CalendarDecoKind
  }
  return 'none'
}

export function loadCalendarDecoration(
  householdId?: string | null,
): CalendarDecoration {
  try {
    const raw = localStorage.getItem(storageKey(householdId))
    if (!raw) return { ...DEFAULT_CALENDAR_DECORATION }
    const p = JSON.parse(raw) as Partial<CalendarDecoration>
    const opacity =
      typeof p.opacity === 'number' && p.opacity >= 0.05 && p.opacity <= 0.6
        ? p.opacity
        : DEFAULT_CALENDAR_DECORATION.opacity
    const backgroundFill =
      typeof p.backgroundFill === 'number' &&
      p.backgroundFill >= 0 &&
      p.backgroundFill <= 1
        ? p.backgroundFill
        : DEFAULT_CALENDAR_DECORATION.backgroundFill
    const backgroundPageAlpha =
      typeof p.backgroundPageAlpha === 'number' &&
      p.backgroundPageAlpha >= 0.2 &&
      p.backgroundPageAlpha <= 1
        ? p.backgroundPageAlpha
        : DEFAULT_CALENDAR_DECORATION.backgroundPageAlpha
    let backgroundDensity =
      typeof p.backgroundDensity === 'number' &&
      p.backgroundDensity >= 0 &&
      p.backgroundDensity <= 1
        ? p.backgroundDensity
        : DEFAULT_CALENDAR_DECORATION.backgroundDensity
    if (backgroundDensity < 0.01) {
      backgroundDensity = 0.01
    }
    const useBackground =
      typeof p.useBackground === 'boolean'
        ? p.useBackground
        : DEFAULT_CALENDAR_DECORATION.useBackground
    const backgroundMode = parseBackgroundMode(p.backgroundMode)
    const backgroundRgb = parseRgb(
      p.backgroundRgb,
      DEFAULT_CALENDAR_DECORATION.backgroundRgb,
    )
    const backgroundPresetId =
      typeof p.backgroundPresetId === 'string' && p.backgroundPresetId
        ? p.backgroundPresetId
        : backgroundMode === 'gradient'
          ? 'sand-grad'
          : 'sand'
    return {
      kind: parseKind(p.kind),
      patternRgb: parseRgb(
        p.patternRgb,
        DEFAULT_CALENDAR_DECORATION.patternRgb,
      ),
      useBackground,
      backgroundMode,
      backgroundPresetId,
      backgroundRgb,
      backgroundFill,
      backgroundPageAlpha,
      backgroundDensity,
      opacity,
      imageUrl:
        typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image/')
          ? p.imageUrl
          : undefined,
    }
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
      kind: deco.kind,
      patternRgb: deco.patternRgb,
      useBackground: deco.useBackground,
      backgroundMode: deco.backgroundMode,
      backgroundPresetId: deco.backgroundPresetId,
      backgroundRgb: deco.backgroundRgb,
      backgroundFill: deco.backgroundFill,
      backgroundPageAlpha: deco.backgroundPageAlpha,
      backgroundDensity: deco.backgroundDensity,
      opacity: deco.opacity,
      imageUrl: deco.kind === 'photo' ? deco.imageUrl : undefined,
    }
    localStorage.setItem(storageKey(householdId), JSON.stringify(payload))
    window.dispatchEvent(new Event(CALENDAR_DECO_CHANGED_EVENT))
  } catch {
    /* ignore quota */
  }
}
