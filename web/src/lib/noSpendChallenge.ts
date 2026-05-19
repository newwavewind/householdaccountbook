import type { DayRollup } from './dayTotals'

export type MonthCell = { iso: string; day: number; inMonth: boolean }

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}

export function monthCalendarCells(
  year: number,
  monthIndex: number,
): MonthCell[] {
  const start = new Date(year, monthIndex, 1)
  const pad = start.getDay()
  const cells: MonthCell[] = []
  const gridStart = new Date(year, monthIndex, 1 - pad)
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push({
      iso: toIso(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === monthIndex,
    })
  }
  return cells
}

/** 해당 날짜에 지출 거래가 없으면 무지출 */
export function isNoSpendDay(rollup: DayRollup | undefined): boolean {
  if (!rollup) return true
  return rollup.expense <= 0
}

export type MonthNoSpendStats = {
  count: number
  noSpendDays: Set<string>
  /** 이번 달 중 오늘까지(포함) 집계한 날 수 */
  eligibleDayCount: number
}

export function monthNoSpendStats(
  year: number,
  monthIndex: number,
  rollups: Map<string, DayRollup>,
  todayIso: string,
): MonthNoSpendStats {
  const noSpendDays = new Set<string>()
  let eligibleDayCount = 0

  for (const { iso, inMonth } of monthCalendarCells(year, monthIndex)) {
    if (!inMonth) continue
    if (iso > todayIso) continue
    eligibleDayCount++
    if (isNoSpendDay(rollups.get(iso))) {
      noSpendDays.add(iso)
    }
  }

  return {
    count: noSpendDays.size,
    noSpendDays,
    eligibleDayCount,
  }
}

const BADGE_EMOJIS = ['🎉', '🏆', '✨', '🌟', '💪', '🍀', '🛡️', '👑', '💎', '🦸'] as const

export function noSpendBadgeEmoji(iso: string): string {
  let h = 0
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) | 0
  return BADGE_EMOJIS[Math.abs(h) % BADGE_EMOJIS.length]
}

export function noSpendBannerMessage(
  count: number,
  eligibleDayCount: number,
): string {
  if (eligibleDayCount === 0) return '이번 달 무지출 챌린지'
  if (count === 0) return '아직 무지출 날이 없어요 — 오늘부터 도전!'
  const pct = Math.round((count / eligibleDayCount) * 100)
  if (count >= 20) return `무지출 ${count}일 · 전설적인 절약 중!`
  if (count >= 10) return `무지출 ${count}일 · 이번 달 ${pct}% 무지출!`
  if (count >= 5) return `무지출 ${count}일 · 슬슬 습관이 됐어요`
  return `무지출 ${count}일 · 좋은 출발이에요!`
}
