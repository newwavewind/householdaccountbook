import { getCalendarDayLabels } from './holidays'
import type { DayRollup } from './dayTotals'

export type TickerSegment = { id: string; text: string }

const fmtPlain = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
})

/** 공휴일·메모 등 — 칸 본문, 줄마다 독립 티커 */
export function buildLedgerContentLines(
  iso: string,
  rollup: DayRollup | undefined,
): TickerSegment[] {
  const lines: TickerSegment[] = []
  const labels = getCalendarDayLabels(iso)
  if (labels) {
    for (const e of labels.entries) {
      lines.push({ id: `label-${e.kind}-${e.name}`, text: e.name })
    }
  }
  if (rollup) {
    for (const memo of rollup.memoLines) {
      lines.push({ id: `memo-${memo}`, text: memo })
    }
  }
  return lines
}

export type LedgerAmountSummary = {
  income: number
  expense: number
}

export function ledgerAmountSummary(
  rollup: DayRollup | undefined,
): LedgerAmountSummary | null {
  if (!rollup) return null
  if (rollup.income <= 0 && rollup.expense <= 0) return null
  return { income: rollup.income, expense: rollup.expense }
}

export function formatLedgerIncome(n: number): string {
  return `+${fmtPlain.format(n)}`
}

export function formatLedgerExpense(n: number): string {
  return `−${fmtPlain.format(n)}`
}

/** 일정 달력 — 일정·공휴일·D-day (장부 건수 제외) */
export function buildCalendarContentLines(opts: {
  labelNames: string[]
  eventRows: { id: string; text: string }[]
  ddayTitles: string[]
}): TickerSegment[] {
  const lines: TickerSegment[] = []
  for (const name of opts.labelNames) {
    lines.push({ id: `label-${name}`, text: name })
  }
  for (const row of opts.eventRows) {
    lines.push({ id: `event-${row.id}`, text: row.text })
  }
  for (const title of opts.ddayTitles) {
    lines.push({ id: `dday-${title}`, text: `D ${title}` })
  }
  return lines
}
