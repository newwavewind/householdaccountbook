export type TransactionType = 'income' | 'expense'

export type PaymentMethod = 'cash' | 'card'

/** Ledger line — 브라우저 localStorage에 저장됩니다. */
export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  /** ISO date (yyyy-mm-dd). */
  date: string
  memo?: string
  category?: string
  /** 지출일 때: 현금 또는 카드 */
  paymentMethod?: PaymentMethod
  /**
   * 지출 + 카드일 때 `CARD_BRANDS`의 id (예: hyundai).
   * @see ../constants/cardBrands
   */
  cardBrand?: string
  /** 가족 구성원 이름 (선택). */
  memberName?: string
}
