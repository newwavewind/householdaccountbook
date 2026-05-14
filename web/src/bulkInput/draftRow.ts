import type { PaymentMethod } from '../types/transaction'

export type BulkDraftRow = {
  localKey: string
  day: string
  kind: 'income' | 'expense'
  amount: string
  memo: string
  category: string
  paymentMethod: PaymentMethod
  cardBrand: string
}

export function emptyDraftRow(): BulkDraftRow {
  return {
    localKey: crypto.randomUUID(),
    day: '',
    kind: 'expense',
    amount: '',
    memo: '',
    category: '',
    paymentMethod: 'card',
    cardBrand: '',
  }
}
