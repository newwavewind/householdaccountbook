export const CALENDAR_STICKY_NOTES_KEY = 'gaegyeobu-calendar-sticky-v1'
export const CALENDAR_STICKY_VIEW_KEY = 'gaegyeobu-calendar-sticky-view-v1'

/** 노랑 · 녹색 · 분홍 · 자주 · 파랑 · 회색 · 목탄 */
export type StickyTint =
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'blue'
  | 'gray'
  | 'charcoal'

export type CalendarStickyNote = {
  id: string
  /** 평문 미리보기·검색용 */
  body: string
  /** TipTap HTML */
  bodyHtml?: string
  tint: StickyTint
  updatedAt: string
}

export const STICKY_TINT_ORDER: StickyTint[] = [
  'yellow',
  'green',
  'pink',
  'purple',
  'blue',
  'gray',
  'charcoal',
]

export const STICKY_TINT_LABEL: Record<StickyTint, string> = {
  yellow: '노랑',
  green: '녹색',
  pink: '분홍',
  purple: '자주',
  blue: '파랑',
  gray: '회색',
  charcoal: '목탄',
}

const LEGACY_TINT: Record<string, StickyTint> = {
  mint: 'green',
  lavender: 'purple',
}

function isTint(v: unknown): v is StickyTint {
  return typeof v === 'string' && (STICKY_TINT_ORDER as readonly string[]).includes(v)
}

function normalizeTint(v: unknown): StickyTint {
  if (typeof v !== 'string') return 'yellow'
  if (LEGACY_TINT[v]) return LEGACY_TINT[v]
  if (isTint(v)) return v
  return 'yellow'
}

export function loadStickyNotes(): CalendarStickyNote[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(CALENDAR_STICKY_NOTES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: CalendarStickyNote[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const o = item as Record<string, unknown>
      const id = typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID()
      const body = typeof o.body === 'string' ? o.body : ''
      const bodyHtml =
        typeof o.bodyHtml === 'string' && o.bodyHtml.trim() ? o.bodyHtml : undefined
      const tint = normalizeTint(o.tint)
      const updatedAt =
        typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString()
      out.push({ id, body, bodyHtml, tint, updatedAt })
    }
    return out
  } catch {
    return []
  }
}

export function saveStickyNotes(notes: CalendarStickyNote[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CALENDAR_STICKY_NOTES_KEY, JSON.stringify(notes))
  } catch {
    /* quota */
  }
}

export function loadStickyViewMode(): 'compact' | 'expanded' {
  if (typeof localStorage === 'undefined') return 'compact'
  try {
    const v = localStorage.getItem(CALENDAR_STICKY_VIEW_KEY)
    return v === 'expanded' ? 'expanded' : 'compact'
  } catch {
    return 'compact'
  }
}

export function saveStickyViewMode(mode: 'compact' | 'expanded'): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CALENDAR_STICKY_VIEW_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function nextTint(index: number): StickyTint {
  return STICKY_TINT_ORDER[index % STICKY_TINT_ORDER.length]!
}
