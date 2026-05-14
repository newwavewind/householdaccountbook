import type { Transaction } from '../types/transaction'

export type DraftLedgerComparison = {
  /** 유효 입력 줄들의 정렬 fingerprint 집합 */
  multisetMatch: boolean
  ledgerInMonthCount: number
  draftEligibleCount: number
  ledgerIncomeSum: number
  ledgerExpenseSum: number
  draftIncomeSum: number
  draftExpenseSum: number
}

/** 날짜·종류·금액 등 정규 fingerprint (중복 줄 multiset 비교용) */
export function transactionFingerprintNormalized(
  tx: Omit<Transaction, 'id'> | Transaction,
): string {
  const memo = tx.memo ?? ''
  const cat = tx.category ?? ''
  const pm = tx.paymentMethod ?? ''
  const card = tx.cardBrand ?? ''
  return `${tx.date}|${tx.type}|${tx.amount}|${cat}|${memo}|${pm}|${card}`
}



export function multisetKeyFromTransactions(
  list: Omit<Transaction, 'id'>[],
): string {
  return JSON.stringify(list.map(transactionFingerprintNormalized).sort())
}

export function ledgerMonthMultisetKey(
  year: number,
  monthIndex: number,
  txs: Transaction[],
): string {
  const ledgerMonth = txs.filter((t) =>
    isTxInCalendarMonth(t, year, monthIndex),
  )
  const asEligible: Omit<Transaction, 'id'>[] = ledgerMonth.map((tx) => {
    const { id: _omitId, ...rest } = tx
    void _omitId
    return rest
  })
  return multisetKeyFromTransactions(asEligible)
}

export function isTxInCalendarMonth(
  tx: Transaction,
  year: number,
  monthIndex: number,
): boolean {
  const parts = tx.date.split('-').map(Number)
  const yy = parts[0]
  const mm = parts[1]
  return yy === year && mm === monthIndex + 1
}

/** 해당 연·월 캘린더 장부 줄의 수입·지출 합계 */
export function ledgerMonthIncomeExpenseSums(
  txs: Transaction[],
  year: number,
  monthIndex: number,
): { income: number; expense: number } {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (!isTxInCalendarMonth(t, year, monthIndex)) continue
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense }
}

/**
 * 해당 연·월 장부 줄 집합 vs 입력 탭에서 `draftsToTransactions`로 만들 수 있는 줄 집합이
 * (날짜·유형·금액·메모·카테고리·결제까지) 순서 무관 동일한지 비교합니다.
 */
export function compareDraftMultisetToLedgerMonth(
  year: number,
  monthIndex: number,
  ledger: Transaction[],
  draftEligible: Omit<Transaction, 'id'>[],
): DraftLedgerComparison {
  const { income: ledgerIncomeSum, expense: ledgerExpenseSum } =
    ledgerMonthIncomeExpenseSums(ledger, year, monthIndex)

  const ledgerMonth = ledger.filter((t) =>
    isTxInCalendarMonth(t, year, monthIndex),
  )

  const draftIncomeSum = draftEligible
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const draftExpenseSum = draftEligible
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  const lfp = ledgerMonth.map(transactionFingerprintNormalized).sort()
  const dfp = draftEligible.map(transactionFingerprintNormalized).sort()

  const multisetMatch =
    lfp.length === dfp.length && lfp.every((v, i) => v === dfp[i])

  return {
    multisetMatch,
    ledgerInMonthCount: ledgerMonth.length,
    draftEligibleCount: draftEligible.length,
    ledgerIncomeSum,
    ledgerExpenseSum,
    draftIncomeSum,
    draftExpenseSum,
  }
}
