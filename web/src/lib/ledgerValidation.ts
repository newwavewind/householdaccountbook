import type { Transaction } from '../types/transaction'

export function isValidTx(x: unknown): x is Transaction {
  if (!x || typeof x !== 'object') return false
  const t = x as Record<string, unknown>
  if (typeof t.id !== 'string') return false
  if (t.type !== 'income' && t.type !== 'expense') return false
  if (typeof t.amount !== 'number' || !Number.isFinite(t.amount)) return false
  if (typeof t.date !== 'string') return false
  if (
    t.paymentMethod !== undefined &&
    t.paymentMethod !== 'cash' &&
    t.paymentMethod !== 'card' &&
    t.paymentMethod !== 'ieum'
  ) {
    return false
  }
  if (t.cardBrand !== undefined && typeof t.cardBrand !== 'string') return false
  return true
}

export function parseTransactionsPayload(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isValidTx)
}
