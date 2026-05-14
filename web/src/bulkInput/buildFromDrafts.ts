import type { Transaction } from '../types/transaction'
import type { BulkDraftRow } from './draftRow'
import { daysInMonth } from './monthUtils'

export function draftsToTransactions(
  year: number,
  monthIndex: number,
  rows: BulkDraftRow[],
): { ok: Omit<Transaction, 'id'>[]; skippedCard: number; skippedDay: number } {
  const maxDay = daysInMonth(year, monthIndex)
  const ok: Omit<Transaction, 'id'>[] = []
  let skippedCard = 0
  let skippedDay = 0

  for (const r of rows) {
    if (!String(r.day).trim()) continue
    const d = Number(r.day)
    if (!Number.isInteger(d) || d < 1 || d > maxDay) {
      skippedDay++
      continue
    }
    const amt = Number(
      String(r.amount).replace(/,/g, '').replace(/\s/g, ''),
    )
    if (!Number.isFinite(amt) || amt <= 0) continue

    const mm = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    if (r.kind === 'expense' && r.paymentMethod === 'card' && !r.cardBrand.trim()) {
      skippedCard++
      continue
    }

    const tx: Omit<Transaction, 'id'> = {
      type: r.kind,
      amount: amt,
      date: mm,
      memo: r.memo.trim() ? r.memo.trim() : undefined,
      category: r.category.trim() ? r.category.trim() : undefined,
      memberName: r.memberName.trim() ? r.memberName.trim() : undefined,
    }
    if (r.kind === 'expense') {
      tx.paymentMethod = r.paymentMethod
      if (r.paymentMethod === 'card') tx.cardBrand = r.cardBrand.trim()
    }
    ok.push(tx)
  }

  return { ok, skippedCard, skippedDay }
}
