import type { BulkDraftRow } from './draftRow'
import { draftsToTransactions } from './buildFromDrafts'

/** 입력 표의 유효 줄만 반영한 달 합계(당월이면 오늘 일자까지만, 그 외 달이면 전체). */
export function draftMonthTotalsForDisplay(
  year: number,
  monthIndex: number,
  rows: BulkDraftRow[],
): { income: number; expense: number } {
  const { ok } = draftsToTransactions(year, monthIndex, rows)
  const today = new Date()
  const isThisCalendarMonth =
    today.getFullYear() === year && today.getMonth() === monthIndex
  const list = isThisCalendarMonth
    ? ok.filter((tx) => {
        const dd = Number(tx.date.split('-')[2])
        return Number.isFinite(dd) && dd <= today.getDate()
      })
    : ok
  let income = 0
  let expense = 0
  for (const t of list) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense }
}
