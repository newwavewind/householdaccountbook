import type { Transaction } from '../types/transaction'

/** 금액 큰 순 미리보기 한 줄 (최대 3개). */
export interface DayPreviewLine {
  type: 'income' | 'expense'
  amount: number
}

export interface DayRollup {
  income: number
  expense: number
  count: number
  preview: DayPreviewLine[]
  /** 미리보기에 안 실린 나머지 건수 (4건 이상일 때 1 이상). */
  restCount: number
}

export function rollupByDate(transactions: Transaction[]): Map<string, DayRollup> {
  const byDate = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const arr = byDate.get(t.date) ?? []
    arr.push(t)
    byDate.set(t.date, arr)
  }

  const m = new Map<string, DayRollup>()
  for (const [date, txs] of byDate) {
    let income = 0
    let expense = 0
    for (const t of txs) {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    }

    const sorted = [...txs].sort((a, b) => b.amount - a.amount)
    const preview = sorted
      .slice(0, 3)
      .map((t) => ({ type: t.type, amount: t.amount }))
    const restCount = Math.max(0, txs.length - 3)

    m.set(date, {
      income,
      expense,
      count: txs.length,
      preview,
      restCount,
    })
  }
  return m
}
