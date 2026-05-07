import Holidays from 'date-holidays'

const kr = new Holidays('KR')

const mapCache = new Map<number, Map<string, string>>()

/** yyyy-mm-dd → 공휴일 이름 (복수면 쉼표로 연결). */
export function getHolidayMapForYear(year: number): Map<string, string> {
  let m = mapCache.get(year)
  if (m) return m
  m = new Map()
  const list = kr.getHolidays(year, 'ko')
  if (list) {
    for (const h of list) {
      const key = h.date.slice(0, 10)
      const prev = m.get(key)
      m.set(key, prev ? `${prev}, ${h.name}` : h.name)
    }
  }
  mapCache.set(year, m)
  return m
}

export function holidayLabel(isoDate: string): string | undefined {
  const y = Number(isoDate.slice(0, 4))
  if (!Number.isFinite(y)) return undefined
  return getHolidayMapForYear(y).get(isoDate)
}
