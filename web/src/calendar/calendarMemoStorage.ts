export const CALENDAR_MEMO_STORAGE_KEY = 'gaegyeobu-calendar-v1'

/** 구버전 데이터 파싱용 (priority → important) */
const LEGACY_PRIORITIES = ['none', 'low', 'normal', 'high'] as const
type LegacyPriority = (typeof LEGACY_PRIORITIES)[number]

function isLegacyPriority(v: unknown): v is LegacyPriority {
  return (
    typeof v === 'string' &&
    (LEGACY_PRIORITIES as readonly string[]).includes(v)
  )
}

export type CalendarDayMemo = {
  title: string
  body: string
  /** HH:mm (optional) */
  time?: string
  /** 장소 (optional, 구 데이터) */
  location?: string
  /** 별표 중요 표시 */
  important?: boolean
  updatedAt: string
}

type MemoMap = Record<string, CalendarDayMemo>

/** Supabase payload / 로컬 JSON 객체에서 메모 맵 파싱 */
export function parseMemoMapPayload(raw: unknown): MemoMap {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: MemoMap = {}
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue
    const o = val as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title : ''
    const body = typeof o.body === 'string' ? o.body : ''
    const time = typeof o.time === 'string' ? o.time : undefined
    const location = typeof o.location === 'string' ? o.location : undefined
    const updatedAt =
      typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString()

    const legacy = isLegacyPriority(o.priority) ? o.priority : undefined
    const important = o.important === true || legacy === 'high'

    const rec: CalendarDayMemo = { title, body, time, updatedAt }
    if (location !== undefined && location.length > 0) rec.location = location
    if (important) rec.important = true
    out[k] = rec
  }
  return out
}

function safeParse(raw: string | null): MemoMap {
  if (!raw) return {}
  try {
    return parseMemoMapPayload(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

export function loadCalendarMemos(): MemoMap {
  if (typeof localStorage === 'undefined') return {}
  return safeParse(localStorage.getItem(CALENDAR_MEMO_STORAGE_KEY))
}

export function saveCalendarMemos(map: MemoMap): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CALENDAR_MEMO_STORAGE_KEY, JSON.stringify(map))
}

export function getCalendarMemo(
  map: MemoMap,
  iso: string,
): CalendarDayMemo | undefined {
  return map[iso]
}

/** 빈 제목·본문이면 해당 날짜 항목 제거 */
export function upsertCalendarMemo(
  map: MemoMap,
  iso: string,
  draft: Pick<CalendarDayMemo, 'title' | 'body' | 'time' | 'location' | 'important'>,
): MemoMap {
  const trimmedTitle = draft.title.trim()
  const trimmedBody = draft.body.trim()
  const next = { ...map }
  if (!trimmedTitle && !trimmedBody) {
    delete next[iso]
    return next
  }
  const loc = draft.location?.trim()
  next[iso] = {
    title: trimmedTitle,
    body: trimmedBody,
    time: draft.time?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  }
  if (loc) next[iso].location = loc
  if (draft.important) next[iso].important = true
  return next
}

export function deleteCalendarMemo(map: MemoMap, iso: string): MemoMap {
  const n = { ...map }
  delete n[iso]
  return n
}
