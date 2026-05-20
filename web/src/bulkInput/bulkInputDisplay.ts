import { cardBrandLabel } from '../constants/cardBrands'
import type { BulkDraftRow } from './draftRow'

export function formatBulkAmountDisplay(amount: string): string {
  const d = amount.replace(/\D/g, '')
  if (!d) return '—'
  return `${d.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
}

export function formatBulkPaymentLabel(r: BulkDraftRow): string {
  if (r.kind !== 'expense') return '—'
  if (r.paymentMethod === 'cash') return '현금'
  if (r.paymentMethod === 'ieum') return '이음카드'
  const card = cardBrandLabel(r.cardBrand)
  return card ?? '카드'
}

export function formatBulkKindLabel(kind: BulkDraftRow['kind']): string {
  return kind === 'income' ? '수입' : '지출'
}
