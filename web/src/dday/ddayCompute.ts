import {
  formatLunarMd,
  nextLunarAnniversarySolar,
  solarIsoMatchesLunarAnnual,
} from './ddayLunar'
import type { DdayEvent } from './ddayTypes'

function atNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

/** 오늘 0시 기준 일 차이 (목표일 - 오늘) */
export function diffCalendarDaysFromToday(targetIso: string): number {
  const now = new Date()
  const t0 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const [y, m, d] = targetIso.split('-').map(Number)
  const t1 = Date.UTC(y, m - 1, d)
  return Math.round((t1 - t0) / 86_400_000)
}

/** 다음 양력 기념일 (2/29 → 평년 2/28) */
export function nextAnnualDate(
  month: number,
  day: number,
  from: Date = new Date(),
): Date {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const y = from.getFullYear()
  const clamp = (yy: number) => {
    const last = new Date(yy, month, 0).getDate()
    const safe = Math.min(day, last)
    return new Date(yy, month - 1, safe, 12, 0, 0)
  }
  let t = clamp(y)
  if (t < start) t = clamp(y + 1)
  return t
}

export function daysUntilAnnual(month: number, day: number): number {
  const n = nextAnnualDate(month, day)
  const iso = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  return diffCalendarDaysFromToday(iso)
}

export function babyAgeDetail(birthIso: string, from: Date = new Date()) {
  const birth = atNoon(birthIso)
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  if (birth > start) {
    return { months: 0, days: 0, label: '출생 전' }
  }
  let months =
    (from.getFullYear() - birth.getFullYear()) * 12 +
    (from.getMonth() - birth.getMonth())
  let rem = from.getDate() - birth.getDate()
  if (rem < 0) {
    months -= 1
    const prevM = new Date(from.getFullYear(), from.getMonth(), 0)
    rem += prevM.getDate()
  }
  return {
    months,
    days: rem,
    label: `${months}개월 ${rem}일`,
  }
}

/** 다음 생일까지 일수 */
export function daysUntilBabyBirthday(birthIso: string): number {
  const birth = atNoon(birthIso)
  const m = birth.getMonth() + 1
  const d = birth.getDate()
  return daysUntilAnnual(m, d)
}

export type DdaySummaryLine = {
  id: string
  title: string
  kind: DdayEvent['kind']
  /** 표시용 한 줄 */
  text: string
  /** 정렬용 (오름차순: 가까운 미래 우선) */
  sortKey: number
}

function sortKeyForDays(days: number): number {
  if (days >= 0) return days
  return 10_000 - days
}

export function buildDdaySummaryLines(events: DdayEvent[]): DdaySummaryLine[] {
  const lines: DdaySummaryLine[] = []
  for (const e of events) {
    if (e.kind === 'birthday' || e.kind === 'couple') {
      if (e.dateBasis === 'lunar') {
        const nextS = nextLunarAnniversarySolar(
          e.lunarMonth,
          e.lunarDay,
          e.lunarLeap,
        )
        const iso = `${nextS.getFullYear()}-${String(nextS.getMonth() + 1).padStart(2, '0')}-${String(nextS.getDate()).padStart(2, '0')}`
        const days = diffCalendarDaysFromToday(iso)
        const lm = formatLunarMd(e.lunarMonth, e.lunarDay, e.lunarLeap)
        const sm = `${nextS.getMonth() + 1}/${nextS.getDate()}`
        lines.push({
          id: e.id,
          title: e.title,
          kind: e.kind,
          text:
            days === 0
              ? `${e.title} 오늘 (음력 ${lm})`
              : `${e.title} ${formatDdayShort(days)} · 음력 ${lm} → ${sm}`,
          sortKey: sortKeyForDays(days),
        })
      } else {
        const days = daysUntilAnnual(e.month, e.day)
        const dm = `${e.month}.${e.day}`
        lines.push({
          id: e.id,
          title: e.title,
          kind: e.kind,
          text:
            days === 0
              ? `${e.title} 오늘`
              : days > 0
                ? `${e.title} ${formatDdayShort(days)} (${dm})`
                : `${e.title} ${formatDdayShort(days)} · ${dm}`,
          sortKey: sortKeyForDays(days),
        })
      }
    } else if (e.kind === 'baby') {
      const age = babyAgeDetail(e.birthDate)
      const untilBirth = daysUntilBabyBirthday(e.birthDate)
      lines.push({
        id: e.id,
        title: e.title,
        kind: e.kind,
        text:
          untilBirth === 0
            ? `${e.title} 돌 · ${age.label}`
            : `${e.title} ${age.label} · 생일 ${formatDdayShort(untilBirth)}`,
        sortKey: sortKeyForDays(untilBirth),
      })
    } else if (e.kind === 'exam' || e.kind === 'custom') {
      const days = diffCalendarDaysFromToday(e.targetDate)
      lines.push({
        id: e.id,
        title: e.title,
        kind: e.kind,
        text:
          days === 0
            ? `${e.title} D-Day`
            : `${e.title} ${formatDdayShort(days)}`,
        sortKey: sortKeyForDays(days),
      })
    }
  }
  lines.sort((a, b) => a.sortKey - b.sortKey)
  return lines
}

export function formatDdayShort(days: number): string {
  if (days === 0) return 'D-Day'
  if (days > 0) return `D-${days}`
  return `D+${Math.abs(days)}`
}

export function calendarDayMatchesEvent(iso: string, e: DdayEvent): boolean {
  const [, im, id] = iso.split('-').map(Number)
  if (e.kind === 'birthday' || e.kind === 'couple') {
    if (e.dateBasis === 'lunar') {
      return solarIsoMatchesLunarAnnual(
        iso,
        e.lunarMonth,
        e.lunarDay,
        e.lunarLeap,
      )
    }
    return im === e.month && id === e.day
  }
  if (e.kind === 'baby') {
    const b = atNoon(e.birthDate)
    return im === b.getMonth() + 1 && id === b.getDate()
  }
  if (e.kind === 'exam' || e.kind === 'custom') {
    return e.targetDate === iso
  }
  return false
}

export function eventsOnCalendarDay(
  iso: string,
  events: DdayEvent[],
): DdayEvent[] {
  return events.filter((e) => calendarDayMatchesEvent(iso, e))
}
