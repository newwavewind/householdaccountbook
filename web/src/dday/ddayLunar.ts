import KoreanLunarCalendar from 'korean-lunar-calendar'

/** 음력 기념일이 올해·내년 중 다음으로 오는 양력 날짜 */
export function nextLunarAnniversarySolar(
  lunarMonth: number,
  lunarDay: number,
  lunarLeap: boolean,
  from: Date = new Date(),
): Date {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const probe = new KoreanLunarCalendar()
  probe.setSolarDate(from.getFullYear(), from.getMonth() + 1, from.getDate())
  const baseLunarYear = probe.getLunarCalendar().year

  for (let delta = -1; delta <= 5; delta++) {
    const ly = baseLunarYear + delta
    const c = new KoreanLunarCalendar()
    if (!c.setLunarDate(ly, lunarMonth, lunarDay, lunarLeap)) continue
    const s = c.getSolarCalendar()
    const dayStart = new Date(s.year, s.month - 1, s.day)
    if (dayStart >= start) return dayStart
  }
  return start
}

export function formatLunarMd(
  lunarMonth: number,
  lunarDay: number,
  lunarLeap: boolean,
): string {
  return `${lunarLeap ? '윤' : ''}${lunarMonth}.${lunarDay}`
}

/**
 * 해당 양력 하루가, 그 해의 음력 월일·윤달과 setLunarDate로 돌아오는 날과 일치하는지
 * (getLunarCalendar().intercalation 신뢰 불가 대비)
 */
export function solarIsoMatchesLunarAnnual(
  iso: string,
  lunarMonth: number,
  lunarDay: number,
  lunarLeap: boolean,
): boolean {
  const [y, sm, sd] = iso.split('-').map(Number)
  const probe = new KoreanLunarCalendar()
  if (!probe.setSolarDate(y, sm, sd)) return false
  const ly = probe.getLunarCalendar().year
  const t = new KoreanLunarCalendar()
  if (!t.setLunarDate(ly, lunarMonth, lunarDay, lunarLeap)) return false
  const s = t.getSolarCalendar()
  return s.year === y && s.month === sm && s.day === sd
}

/** 아기 출생: 음력만 알 때 → 양력 생일 ISO (korean-lunar-calendar) */
export function solarIsoFromLunarBirth(
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
