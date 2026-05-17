import { normalizeCalendarEventInk, type CalendarEventInkId } from './calendarEventInk'
import { htmlToPlain, sanitizeCalendarEventHtml } from './calendarHtmlSanitize'

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

/** 하루에 여러 개 둘 수 있는 일정·메모 한 줄 */
export type CalendarDayEvent = {
  id: string
  /** 짧은 일정 이름(조동친구, 장보기 등) */
  label: string
  /** 추가 메모(선택) */
  note?: string
  /** 표시용 리치 텍스트 HTML(선택) */
  labelHtml?: string
  noteHtml?: string
  /** HH:mm (선택) */
  time?: string
  important?: boolean
  /** 제목·메모 글자색 (미지정이면 검정 계열) */
  ink?: CalendarEventInkId
}

export type CalendarDayMemo = {
  title: string
  body: string
  /** 여러 일정 (v2). 없으면 title/body 등 구형 필드로 복원 */
  events?: CalendarDayEvent[]
  /** HH:mm (optional) — 구형 단일 시간 */
  time?: string
  /** 장소 (optional, 구 데이터) */
  location?: string
  /** 별표 중요 표시 — 구형 단일 */
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

    if (Array.isArray(o.events)) {
      const parsed: CalendarDayEvent[] = []
      for (const item of o.events) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const r = item as Record<string, unknown>
        const id =
          typeof r.id === 'string' && r.id.trim() ? r.id : crypto.randomUUID()
        const label = typeof r.label === 'string' ? r.label : ''
        const note = typeof r.note === 'string' ? r.note : undefined
        const labelHtmlRaw = typeof r.labelHtml === 'string' ? r.labelHtml : ''
        const noteHtmlRaw = typeof r.noteHtml === 'string' ? r.noteHtml : ''
        const evTime = typeof r.time === 'string' ? r.time : undefined
        const evImportant = r.important === true
        const evInk = normalizeCalendarEventInk(r.ink)
        const ev: CalendarDayEvent = {
          id,
          label,
          note,
          time: evTime,
          important: evImportant,
        }
        if (evInk && evInk !== 'default') ev.ink = evInk
        if (labelHtmlRaw.trim()) {
          ev.labelHtml = sanitizeCalendarEventHtml(labelHtmlRaw)
        }
        if (noteHtmlRaw.trim()) {
          ev.noteHtml = sanitizeCalendarEventHtml(noteHtmlRaw)
        }
        parsed.push(ev)
      }
      if (parsed.length > 0) rec.events = parsed
    }

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

function migrateLegacyToEvents(memo: CalendarDayMemo): CalendarDayEvent[] {
  const title = memo.title?.trim() ?? ''
  const bodyFull = memo.body ?? ''
  const lines = bodyFull
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const t = memo.time?.trim()

  // 제목 없이 여러 줄이면 줄마다 따로 일정으로 (기존 메모를 자동 분할)
  if (!title && lines.length > 1) {
    return lines.map((line) => ({
      id: crypto.randomUUID(),
      label: line,
      important: memo.important === true,
    }))
  }

  if (!title && lines.length === 1) {
    return [
      {
        id: crypto.randomUUID(),
        label: lines[0]!,
        time: t || undefined,
        important: memo.important === true,
      },
    ]
  }

  if (!title && lines.length === 0) {
    if (!t) return []
    return [
      {
        id: crypto.randomUUID(),
        label: '일정',
        time: t,
        important: memo.important === true,
      },
    ]
  }

  return [
    {
      id: crypto.randomUUID(),
      label: title,
      note: bodyFull.trim() || undefined,
      time: t || undefined,
      important: memo.important === true,
    },
  ]
}

/** 저장본·구형(title/body) 필드를 이벤트 배열로 통일해 읽기 */
export function getDayEvents(
  memo: CalendarDayMemo | undefined,
): CalendarDayEvent[] {
  if (!memo) return []
  if (Array.isArray(memo.events) && memo.events.length > 0) {
    return memo.events.map((e) => {
      const ink = normalizeCalendarEventInk(e.ink)
      const base: CalendarDayEvent = {
        id: typeof e.id === 'string' && e.id.trim() ? e.id : crypto.randomUUID(),
        label: typeof e.label === 'string' ? e.label : '',
        note:
          typeof e.note === 'string' && e.note.trim()
            ? e.note.trim()
            : undefined,
        time:
          typeof e.time === 'string' && e.time.trim()
            ? e.time.trim()
            : undefined,
        important: e.important === true,
      }
      if (typeof e.labelHtml === 'string' && e.labelHtml.trim()) {
        base.labelHtml = e.labelHtml
      }
      if (typeof e.noteHtml === 'string' && e.noteHtml.trim()) {
        base.noteHtml = e.noteHtml
      }
      if (ink && ink !== 'default') base.ink = ink
      return base
    })
  }
  return migrateLegacyToEvents(memo)
}

/** 여러 일정을 한 번에 저장(빈 목록이면 해당 날짜 키 삭제) */
export function setCalendarDayEvents(
  map: MemoMap,
  iso: string,
  events: CalendarDayEvent[],
): MemoMap {
  const cleaned = events
    .map((e) => {
      const ink = normalizeCalendarEventInk(e.ink)
      const labelHtml = e.labelHtml?.trim()
        ? sanitizeCalendarEventHtml(e.labelHtml)
        : undefined
      const noteHtml = e.noteHtml?.trim()
        ? sanitizeCalendarEventHtml(e.noteHtml)
        : undefined
      const row: CalendarDayEvent = {
        id: e.id?.trim() ? e.id.trim() : crypto.randomUUID(),
        label: (e.label ?? '').trim(),
        note: e.note?.trim() || undefined,
        time: e.time?.trim() || undefined,
        important: e.important === true,
      }
      if (labelHtml) row.labelHtml = labelHtml
      if (noteHtml) row.noteHtml = noteHtml
      if (ink && ink !== 'default') row.ink = ink
      return row
    })
    .filter(
      (row) =>
        !!(
          row.label ||
          row.note ||
          row.time ||
          htmlToPlain(row.labelHtml) ||
          htmlToPlain(row.noteHtml)
        ),
    )

  const next = { ...map }
  if (cleaned.length === 0) {
    delete next[iso]
    return next
  }
  next[iso] = {
    title: '',
    body: '',
    events: cleaned,
    updatedAt: new Date().toISOString(),
  }
  return next
}
