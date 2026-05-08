import type { Transaction } from '../types/transaction'

export interface DayRollup {
  income: number
  expense: number
  count: number
  /** 비어 있지 않은 메모, 금액 큰 거래 우선·중복 제거, 달력 하단 미리보기용 최대 2개. */
  memoLines: string[]
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
    const memoLines: string[] = []
    const memoSeen = new Set<string>()
    for (const t of sorted) {
      const raw = t.memo?.trim()
      if (!raw) continue
      if (memoSeen.has(raw)) continue
      memoSeen.add(raw)
      memoLines.push(raw)
      if (memoLines.length >= 2) break
    }

    m.set(date, {
      income,
      expense,
      count: txs.length,
      memoLines,
    })
  }
  return m
}
