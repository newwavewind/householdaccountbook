import specialDaysJson from '../data/krSpecialDays.json'
import type { CalendarLabelEntry, CalendarLabelKind } from './calendarLabelTypes'

type SpecialDayRow = { name: string; kind: CalendarLabelKind }

const specialDays = specialDaysJson as Record<string, SpecialDayRow>

export function getSpecialDayEntry(iso: string): CalendarLabelEntry | undefined {
  const row = specialDays[iso]
  if (!row) return undefined
  return { name: row.name, kind: row.kind }
}
