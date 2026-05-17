import { useMemo } from 'react'
import { Button } from './ui/Button'
import { holidayLabel } from '../lib/holidays'
import { cardBrandLabel } from '../constants/cardBrands'
import type { Transaction } from '../types/transaction'

export interface DayDetailModalProps {
  open: boolean
  iso: string | null
  transactions: Transaction[]
  onClose: () => void
  onDelete: (id: string) => void
  onEdit: (t: Transaction) => void
  onAddForDay: () => void
  fmt: Intl.NumberFormat
}

export function DayDetailModal({
  open,
  iso,
  transactions,
  onClose,
  onDelete,
  onEdit,
  onAddForDay,
  fmt,
}: DayDetailModalProps) {
  const sorted = useMemo(() => {
    const list = [...transactions]
    list.sort((a, b) => b.amount - a.amount)
    return list
  }, [transactions])

  if (!open || !iso) return null

  const hol = holidayLabel(iso)
  const title = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${iso}T12:00:00`))

  const incomeSum = sorted
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const expenseSum = sorted
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[var(--radius-card)] bg-white shadow-[var(--shadow-card)] sm:max-h-[85dvh] sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-black/[0.06] px-5 py-4">
          <p className="text-base font-semibold text-starbucks-green">{title}</p>
          {hol ? (
            <p className="mt-1 text-sm font-medium text-gold">{hol}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="text-semantic-income">
              수입 합계 {fmt.format(incomeSum)}
            </span>
            <span className="text-text-soft">|</span>
            <span className="text-semantic-expense">
              지출 합계 {fmt.format(expenseSum)}
            </span>
            <span className="text-text-soft">|</span>
            <span className="text-text-soft">
              순액 {fmt.format(incomeSum - expenseSum)}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-text-soft">
              이 날짜에 기록이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {sorted.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          t.type === 'income'
                            ? 'rounded-full bg-semantic-income/15 px-2 py-0.5 text-xs font-semibold text-semantic-income'
                            : 'rounded-full bg-semantic-expense/10 px-2 py-0.5 text-xs font-semibold text-semantic-expense'
                        }
                      >
                        {t.type === 'income' ? '수입' : '지출'}
                      </span>
                      {t.category ? (
                        <span className="text-xs text-text-soft">
                          {t.category}
                        </span>
                      ) : null}
                      {t.type === 'expense' ? (
                        <span className="rounded-full bg-neutral-cool px-2 py-0.5 text-xs font-medium text-[rgba(0,0,0,0.87)]">
                          {t.paymentMethod === 'cash'
                            ? '현금'
                            : t.paymentMethod === 'ieum'
                              ? '이음카드'
                            : t.paymentMethod === 'card'
                              ? cardBrandLabel(t.cardBrand) ?? '카드'
                              : '미입력'}
                        </span>
                      ) : null}
                    </div>
                    {t.memo ? (
                      <p className="mt-1 text-sm text-[rgba(0,0,0,0.87)]">
                        {t.memo}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <span
                      className={
                        t.type === 'income'
                          ? 'text-lg font-semibold text-semantic-income'
                          : 'text-lg font-semibold text-semantic-expense'
                      }
                    >
                      {t.type === 'expense' ? '−' : '+'}
                      {fmt.format(t.amount)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outlined"
                        className="!px-3 !py-1 !text-xs"
                        onClick={() => onEdit(t)}
                      >
                        수정
                      </Button>
                      <Button
                        type="button"
                        variant="darkOutlined"
                        className="!border-danger !px-3 !py-1 !text-xs !text-danger"
                        onClick={() => {
                          if (confirm('이 거래를 삭제할까요?')) onDelete(t.id)
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2 border-t border-black/[0.06] p-4">
          <Button
            type="button"
            variant="outlined"
            className="flex-1"
            onClick={onClose}
          >
            닫기
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            onClick={onAddForDay}
          >
            이 날짜에 추가
          </Button>
        </div>
      </div>
    </div>
  )
}
