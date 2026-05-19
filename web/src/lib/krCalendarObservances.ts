import KoreanLunarCalendar from 'korean-lunar-calendar'
import type { CalendarLabelEntry } from './calendarLabelTypes'

export type { CalendarLabelEntry } from './calendarLabelTypes'

/** 법정 공휴일이 아닌 고정 기념일 (MM-DD) */
const FIXED_OBSERVANCES: { mmdd: string; name: string }[] = [
  { mmdd: '03-03', name: '삼짇날' },
  { mmdd: '04-05', name: '식목일' },
  { mmdd: '04-20', name: '장애인의 날' },
  { mmdd: '04-28', name: '충무공 탄신일' },
  { mmdd: '05-01', name: '근로자의 날' },
  { mmdd: '05-08', name: '어버이날' },
  { mmdd: '05-15', name: '스승의날' },
  { mmdd: '06-05', name: '환경의 날' },
  { mmdd: '06-25', name: '6·25 전쟁일' },
  { mmdd: '10-01', name: '국군의날' },
  { mmdd: '10-02', name: '노인의 날' },
  { mmdd: '10-24', name: '국제연합일' },
]

/** 음력 기념일 — 매년 양력일 계산 */
const LUNAR_OBSERVANCES: {
  lunarMonth: number
  lunarDay: number
  lunarLeap: boolean
  name: string
}[] = [
  { lunarMonth: 1, lunarDay: 15, lunarLeap: false, name: '정월대보름' },
  { lunarMonth: 5, lunarDay: 5, lunarLeap: false, name: '단오' },
  { lunarMonth: 7, lunarDay: 7, lunarLeap: false, name: '칠석' },
]

const observanceCache = new Map<number, Map<string, CalendarLabelEntry[]>>()

function lunarToIso(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  lunarLeap: boolean,
): string | null {
  const c = new KoreanLunarCalendar()
  if (!c.setLunarDate(lunarYear, lunarMonth, lunarDay, lunarLeap)) return null
  const s = c.getSolarCalendar()
  return `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`
}

function pushEntry(
  map: Map<string, CalendarLabelEntry[]>,
  iso: string,
  entry: CalendarLabelEntry,
) {
  const list = map.get(iso)
  if (list) {
    if (!list.some((e) => e.name === entry.name)) list.push(entry)
  } else {
    map.set(iso, [entry])
  }
}

/** 고정·음력 기념일 (kind=observance) */
export function getObservanceMapForYear(
  year: number,
): Map<string, CalendarLabelEntry[]> {
  let m = observanceCache.get(year)
  if (m) return m
  m = new Map()

  for (const { mmdd, name } of FIXED_OBSERVANCES) {
    pushEntry(m, `${year}-${mmdd}`, { name, kind: 'observance' })
  }

  for (const lo of LUNAR_OBSERVANCES) {
    const iso = lunarToIso(year, lo.lunarMonth, lo.lunarDay, lo.lunarLeap)
    if (iso) pushEntry(m, iso, { name: lo.name, kind: 'observance' })
  }

  observanceCache.set(year, m)
  return m
}
