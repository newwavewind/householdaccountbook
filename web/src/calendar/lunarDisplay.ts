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

/** 칸 중앙용 — 음력 1일은 "6.1", 그 외는 일만 */
export function lunarCenterDayText(label: string, emphasize: boolean): string {
  const dot = label.indexOf('.')
  if (dot < 0) return label
  if (emphasize) return label
  return label.slice(dot + 1)
}

/** 양력 한 달에 걸친 음력 월 범위 (헤더 부제) */
export function lunarMonthRangeLabel(year: number, monthIndex: number): string {
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0)
  const labels = new Set<string>()
  const d = new Date(start)
  while (d <= end) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const info = lunarCellInfo(iso)
    if (info) {
      const m = info.label.split('.')[0] ?? info.label
      labels.add(m.startsWith('윤') ? m : `${m}월`)
    }
    d.setDate(d.getDate() + 1)
  }
  const list = [...labels]
  if (list.length === 0) return ''
  if (list.length === 1) return `음력 ${list[0]}`
  return `음력 ${list[0]}~${list[list.length - 1]}`
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
