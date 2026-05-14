import type { Transaction } from '../types/transaction'
import type { BulkDraftRow } from './draftRow'
import { emptyDraftRow } from './draftRow'
import {
  isTxInCalendarMonth,
  multisetKeyFromTransactions,
  ledgerMonthMultisetKey,
} from './compareMonthDraftLedger'
import { draftsToTransactions } from './buildFromDrafts'

function initialMonthsRows(): BulkDraftRow[][] {
  return Array.from({ length: 12 }, () => [emptyDraftRow()])
}

/** 장부 줄 → 표 입력 줄 (안정적인 React key 위해 `localKey = tx.id`) */
export function transactionToBulkDraftRow(tx: Transaction): BulkDraftRow {
  const parts = tx.date.split('-')
  const ddRaw = parts[2] ?? '1'
  const dayNum = Number(ddRaw.replace(/\D/g, ''))

  const kind = tx.type
  const expensePm = kind === 'expense' ? (tx.paymentMethod ?? 'cash') : 'cash'
  const cardBrand =
    kind === 'expense' &&
    expensePm === 'card' &&
    typeof tx.cardBrand === 'string'
      ? tx.cardBrand
      : ''

  return {
    localKey: tx.id,
    day: Number.isFinite(dayNum) ? String(dayNum) : '',
    kind,
    amount: Number.isFinite(tx.amount)
      ? String(Math.round(tx.amount))
      : '',
    memo: typeof tx.memo === 'string' ? tx.memo : '',
    category: typeof tx.category === 'string' ? tx.category : '',
    paymentMethod: expensePm,
    cardBrand,
  }
}

/** 해당 달 장부 거래 → 입력 표 (맨 아래 빈 줄 한 줄 포함) */
export function ledgerMonthDraftRows(
  year: number,
  monthIndex: number,
  txs: Transaction[],
): BulkDraftRow[] {
  const rows = txs
    .filter((t) => isTxInCalendarMonth(t, year, monthIndex))
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      if (d !== 0) return d
      return a.id.localeCompare(b.id)
    })

  const mapped = rows.map(transactionToBulkDraftRow)
  return [...mapped, emptyDraftRow()]
}

function yearFromTxDate(date: string): number | undefined {
  const y = Number(date.split('-')[0])
  return Number.isFinite(y) ? y : undefined
}

export function collectConcernedYears(
  prev: { year: number; years: Partial<Record<number, BulkDraftRow[][]>> },
  txs: Transaction[],
): Set<number> {
  const ys = new Set<number>()
  ys.add(prev.year)
  for (const key of Object.keys(prev.years)) {
    ys.add(Number(key))
  }
  for (const t of txs) {
    const yy = yearFromTxDate(t.date)
    if (yy !== undefined) ys.add(yy)
  }
  return ys
}

/**
 * 장부에 줄이 하나라도 있는 동안, 연·달마다 장부 multiset과 표의 반영 가능 multiset이 다르면
 * 그 달 표를 장부에서 다시 채웁니다. 장부가 완전히 비어 있으면 저장된 초안을 건드리지 않습니다.
 */
export function reconcileYearsFromLedger<
  T extends {
    year: number
    years: Partial<Record<number, BulkDraftRow[][]>>
  },
>(prev: T, txs: Transaction[]): T {
  if (!txs.length) return prev

  const years = [...collectConcernedYears(prev, txs)]
  let nextYears: Partial<Record<number, BulkDraftRow[][]>> = { ...prev.years }
  let mutated = false

  for (const y of years) {
    const base = [...(nextYears[y] ?? initialMonthsRows())]
    const nm = [...base]
    let monthMutated = false

    for (let mi = 0; mi < 12; mi++) {
      const ledgerKey = ledgerMonthMultisetKey(y, mi, txs)
      const { ok } = draftsToTransactions(y, mi, nm[mi] ?? [])
      const draftKey = multisetKeyFromTransactions(ok)
      if (ledgerKey === draftKey) continue
      nm[mi] = ledgerMonthDraftRows(y, mi, txs)
      monthMutated = true
    }

    if (monthMutated) {
      nextYears = { ...nextYears, [y]: nm }
      mutated = true
    }
  }

  return mutated ? { ...prev, years: nextYears } : prev
}
