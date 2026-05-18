/** 일정 제목·메모 글자색 (Tailwind 클래스로 매핑) */
export const CALENDAR_EVENT_INK_IDS = [
  'default',
  'blue',
  'sky',
  'emerald',
  'amber',
  'orange',
  'rose',
  'violet',
  'slate',
] as const

export type CalendarEventInkId = (typeof CALENDAR_EVENT_INK_IDS)[number]

const INK_SET = new Set<string>(CALENDAR_EVENT_INK_IDS)

export function normalizeCalendarEventInk(
  raw: unknown,
): CalendarEventInkId | undefined {
  if (typeof raw !== 'string' || !raw) return undefined
  return INK_SET.has(raw) ? (raw as CalendarEventInkId) : undefined
}

/** 저장 필드 `ink`(구버전)까지 고려한 제목용 색 */
export function resolveCalendarEventLabelInk(e: {
  labelInk?: CalendarEventInkId
  ink?: CalendarEventInkId
}): CalendarEventInkId | undefined {
  const a = normalizeCalendarEventInk(e.labelInk)
  if (a && a !== 'default') return a
  const b = normalizeCalendarEventInk(e.ink)
  return b && b !== 'default' ? b : undefined
}

/** 저장 필드 `ink`(구버전)까지 고려한 내용(메모)용 색 */
export function resolveCalendarEventNoteInk(e: {
  noteInk?: CalendarEventInkId
  ink?: CalendarEventInkId
}): CalendarEventInkId | undefined {
  const a = normalizeCalendarEventInk(e.noteInk)
  if (a && a !== 'default') return a
  const b = normalizeCalendarEventInk(e.ink)
  return b && b !== 'default' ? b : undefined
}

/** 제목·내용 색 필드를 통합했을 때 사용하는 표시용 색 */
export function resolveCalendarEventMemoInk(e: {
  noteInk?: CalendarEventInkId
  labelInk?: CalendarEventInkId
  ink?: CalendarEventInkId
}): CalendarEventInkId | undefined {
  const a = normalizeCalendarEventInk(e.noteInk)
  if (a && a !== 'default') return a
  const b = normalizeCalendarEventInk(e.labelInk)
  if (b && b !== 'default') return b
  const c = normalizeCalendarEventInk(e.ink)
  return c && c !== 'default' ? c : undefined
}

/** 달력 칸·요약·입력란 공통 — 클래스 문자열은 여기서만 조합 (Tailwind가 수집하도록) */
export function calendarEventInkTextClass(
  ink: CalendarEventInkId | undefined,
): string {
  switch (ink ?? 'default') {
    case 'blue':
      return 'text-blue-600'
    case 'sky':
      return 'text-sky-600'
    case 'emerald':
      return 'text-emerald-700'
    case 'amber':
      return 'text-amber-700'
    case 'orange':
      return 'text-orange-600'
    case 'rose':
      return 'text-rose-600'
    case 'violet':
      return 'text-violet-600'
    case 'slate':
      return 'text-slate-600'
    default:
      return 'text-text-primary'
  }
}

export const CALENDAR_EVENT_INK_SWATCHES: {
  id: CalendarEventInkId
  label: string
  ring: string
  dot: string
}[] = [
  {
    id: 'default',
    label: '검정',
    ring: 'ring-text-primary/35',
    dot: 'bg-text-primary',
  },
  { id: 'blue', label: '파랑', ring: 'ring-blue-600', dot: 'bg-blue-600' },
  { id: 'sky', label: '하늘', ring: 'ring-sky-500', dot: 'bg-sky-500' },
  { id: 'emerald', label: '초록', ring: 'ring-emerald-600', dot: 'bg-emerald-600' },
  { id: 'amber', label: '노랑', ring: 'ring-amber-500', dot: 'bg-amber-500' },
  { id: 'orange', label: '주황', ring: 'ring-orange-500', dot: 'bg-orange-500' },
  { id: 'rose', label: '분홍', ring: 'ring-rose-500', dot: 'bg-rose-500' },
  { id: 'violet', label: '보라', ring: 'ring-violet-500', dot: 'bg-violet-500' },
  { id: 'slate', label: '회색', ring: 'ring-slate-500', dot: 'bg-slate-500' },
]
