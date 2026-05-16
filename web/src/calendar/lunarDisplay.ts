import KoreanLunarCalendar from 'korean-lunar-calendar'

export type LunarCellInfo = {
  /** 짧은 음력 표기 (예: 12.3, 윤4.1) */
  label: string
  /** 음력 1일·윤달·명절 풍의 공휴일 등 강조 */
  emphasize: boolean
}

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (![y, m, d].every((n) => Number.isFinite(n))) return null
  return { y, m, d }
}

function holidaySuggestsLunarEmphasis(hol: string | undefined): boolean {
  if (!hol) return false
  return /설날|설\s|추석|구정/.test(hol)
}

/** 양력 yyyy-mm-dd → 셀용 음력 소표기 */
export function lunarCellInfo(iso: string, holidayName?: string): LunarCellInfo | null {
  const parts = parseIsoParts(iso)
  if (!parts) return null
  const cal = new KoreanLunarCalendar()
  if (!cal.setSolarDate(parts.y, parts.m, parts.d)) return null
  const l = cal.getLunarCalendar()
  const leap = l.intercalation ? '윤' : ''
  const label = `${leap}${l.month}.${l.day}`
  const emphasize =
    l.day === 1 ||
    !!l.intercalation ||
    holidaySuggestsLunarEmphasis(holidayName)
  return { label, emphasize }
}
