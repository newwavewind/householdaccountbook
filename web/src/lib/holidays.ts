import Holidays from 'date-holidays'
import {
  LABEL_KIND_PRIORITY,
  type CalendarDayLabels,
  type CalendarLabelEntry,
  type CalendarLabelKind,
} from './calendarLabelTypes'
import { getObservanceMapForYear } from './krCalendarObservances'
import { getSolarTermMapForYear } from './krSolarTerms'
import { getSpecialDayEntry } from './krSpecialDays'
import specialDaysJson from '../data/krSpecialDays.json'

export type {
  CalendarDayLabels,
  CalendarLabelEntry,
  CalendarLabelKind,
} from './calendarLabelTypes'
export { isRedCalendarDay } from './calendarLabelTypes'
export { calendarLabelTextClass, calendarLabelMutedClass } from './calendarDayLabelStyles'

const kr = new Holidays('KR')

const publicCache = new Map<number, Map<string, CalendarLabelEntry[]>>()
const mergedCache = new Map<number, Map<string, CalendarDayLabels>>()

const specialDaysData = specialDaysJson as Record<
  string,
  { name: string; kind: CalendarLabelKind }
>

function parseYear(isoDate: string): number | undefined {
  const y = Number(isoDate.slice(0, 4))
  return Number.isFinite(y) ? y : undefined
}

function pushEntry(
  map: Map<string, CalendarLabelEntry[]>,
  iso: string,
  entry: CalendarLabelEntry,
) {
  const list = map.get(iso)
  if (list) {
    if (!list.some((e) => e.name === entry.name && e.kind === entry.kind)) {
      list.push(entry)
    }
  } else {
    map.set(iso, [entry])
  }
}

function mergeEntryMaps(
  maps: Map<string, CalendarLabelEntry[]>[],
): Map<string, CalendarLabelEntry[]> {
  const out = new Map<string, CalendarLabelEntry[]>()
  for (const m of maps) {
    for (const [iso, entries] of m) {
      for (const e of entries) {
        pushEntry(out, iso, e)
      }
    }
  }
  return out
}

/** date-holidays 법정 공휴일·대체공휴일 */
export function getPublicHolidayMapForYear(
  year: number,
): Map<string, CalendarLabelEntry[]> {
  let m = publicCache.get(year)
  if (m) return m
  m = new Map()
  const list = kr.getHolidays(year, 'ko')
  if (list) {
    for (const h of list) {
      const key = h.date.slice(0, 10)
      const kind: CalendarLabelKind = h.substitute ? 'substitute' : 'public'
      pushEntry(m, key, { name: h.name, kind })
    }
  }
  publicCache.set(year, m)
  return m
}

function getSpecialDayMapForYear(year: number): Map<string, CalendarLabelEntry[]> {
  const m = new Map<string, CalendarLabelEntry[]>()
  const prefix = `${year}-`
  for (const iso of Object.keys(specialDaysData)) {
    if (!iso.startsWith(prefix)) continue
    const e = getSpecialDayEntry(iso)
    if (e) pushEntry(m, iso, e)
  }
  return m
}

function getMergedEntryMapForYear(year: number): Map<string, CalendarLabelEntry[]> {
  return mergeEntryMaps([
    getPublicHolidayMapForYear(year),
    getObservanceMapForYear(year),
    getSolarTermMapForYear(year),
    getSpecialDayMapForYear(year),
  ])
}

function sortEntries(entries: CalendarLabelEntry[]): CalendarLabelEntry[] {
  return [...entries].sort(
    (a, b) => LABEL_KIND_PRIORITY[b.kind] - LABEL_KIND_PRIORITY[a.kind],
  )
}

function entriesToDayLabels(entries: CalendarLabelEntry[]): CalendarDayLabels {
  const sorted = sortEntries(entries)
  const deduped: CalendarLabelEntry[] = []
  const seen = new Set<string>()
  for (const e of sorted) {
    const key = `${e.kind}:${e.name}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(e)
  }
  const primaryKind = deduped[0]?.kind ?? 'observance'
  const text = deduped.map((e) => e.name).join(' · ')
  return { entries: deduped, text, primaryKind }
}

function getMergedMapForYear(year: number): Map<string, CalendarDayLabels> {
  let m = mergedCache.get(year)
  if (m) return m
  m = new Map()
  const raw = getMergedEntryMapForYear(year)
  for (const [iso, entries] of raw) {
    if (entries.length > 0) m.set(iso, entriesToDayLabels(entries))
  }
  mergedCache.set(year, m)
  return m
}

/** 통합 달력 라벨 (공휴일·기념일·절기·선거) */
export function getCalendarDayLabels(isoDate: string): CalendarDayLabels | undefined {
  const y = parseYear(isoDate)
  if (y === undefined) return undefined
  return getMergedMapForYear(y).get(isoDate)
}

/** 하위 호환 — 표시 문자열만 */
export function holidayLabel(isoDate: string): string | undefined {
  return getCalendarDayLabels(isoDate)?.text
}

/** @deprecated — getCalendarDayLabels 권장 */
export function getHolidayMapForYear(year: number): Map<string, string> {
  const m = new Map<string, string>()
  for (const [iso, labels] of getMergedMapForYear(year)) {
    m.set(iso, labels.text)
  }
  return m
}
