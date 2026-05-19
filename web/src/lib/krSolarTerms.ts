import type { CalendarLabelEntry, CalendarLabelKind } from './calendarLabelTypes'

const TERM_NAMES = [
  '소한',
  '대한',
  '입춘',
  '우수',
  '경칩',
  '춘분',
  '청명',
  '곡우',
  '입하',
  '소만',
  '망종',
  '하지',
  '소서',
  '대서',
  '입추',
  '처서',
  '백로',
  '추분',
  '한로',
  '상강',
  '입동',
  '소설',
  '대설',
  '동지',
] as const

/** 24절기 시각 오프셋 (분) — 1900-01-06 02:05 기준 */
const TERM_INFO_MIN = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551,
  218072, 240693, 263343, 285989, 308563, 331033, 353350, 375494, 397447,
  419210, 440795, 462224, 483532, 504758,
]

const MS_PER_YEAR = 31556925974.7
const BASE_UTC = Date.UTC(1900, 0, 6, 2, 5)

const solarCache = new Map<number, Map<string, CalendarLabelEntry[]>>()

function isoInSeoul(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** 해당 연도 24절기 (kind=solar) */
export function getSolarTermMapForYear(
  year: number,
): Map<string, CalendarLabelEntry[]> {
  let m = solarCache.get(year)
  if (m) return m
  m = new Map()

  for (let i = 0; i < 24; i++) {
    const ms = MS_PER_YEAR * (year - 1900) + TERM_INFO_MIN[i]! * 60_000
    const iso = isoInSeoul(new Date(BASE_UTC + ms))
    m.set(iso, [{ name: TERM_NAMES[i]!, kind: 'solar' as CalendarLabelKind }])
  }

  solarCache.set(year, m)
  return m
}
