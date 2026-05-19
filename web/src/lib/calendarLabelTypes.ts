export type CalendarLabelKind =
  | 'public'
  | 'substitute'
  | 'observance'
  | 'solar'
  | 'election'

export type CalendarLabelEntry = {
  name: string
  kind: CalendarLabelKind
}

export type CalendarDayLabels = {
  entries: CalendarLabelEntry[]
  /** 칸에 표시할 문자열 (우선순위 정렬·중복 제거 후) */
  text: string
  primaryKind: CalendarLabelKind
}

export const LABEL_KIND_PRIORITY: Record<CalendarLabelKind, number> = {
  public: 5,
  substitute: 5,
  election: 4,
  observance: 3,
  solar: 2,
}

export function isRedCalendarDay(kind: CalendarLabelKind | undefined): boolean {
  return kind === 'public' || kind === 'substitute' || kind === 'election'
}
