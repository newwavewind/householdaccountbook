import { useEffect, useMemo } from 'react'
import { Button } from './ui/Button'
import { cardBrandLabel } from '../constants/cardBrands'
import type { Transaction } from '../types/transaction'

function monthPrefix(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

function isInMonth(dateIso: string, year: number, monthIndex: number) {
  return dateIso.startsWith(monthPrefix(year, monthIndex))
}

function isInYear(dateIso: string, year: number) {
  return dateIso.startsWith(`${year}-`)
}

export interface CardSpendModalProps {
  open: boolean
  cardBrandId: string | null
  year: number
  monthIndex: number
  transactions: Transaction[]
  fmt: Intl.NumberFormat
  onClose: () => void
  onPickDay: (iso: string) => void
}

export function CardSpendModal({
  open,
  cardBrandId,
  year,
  monthIndex,
  transactions,
  fmt,
  onClose,
  onPickDay,
}: CardSpendModalProps) {
  const label = cardBrandId
    ? (cardBrandLabel(cardBrandId) ?? cardBrandId)
    : ''

  const { monthList, yearList, allList, monthSum, yearSum, allSum } =
    useMemo(() => {
      if (!cardBrandId) {
        return {
          monthList: [] as Transaction[],
          yearList: [] as Transaction[],
          allList: [] as Transaction[],
          monthSum: 0,
          yearSum: 0,
          allSum: 0,
        }
      }
      const forCard = transactions.filter(
        (t) =>
          t.type === 'expense' &&
          t.paymentMethod === 'card' &&
          t.cardBrand === cardBrandId,
      )
      const month = forCard.filter((t) =>
        isInMonth(t.date, year, monthIndex),
      )
      const yr = forCard.filter((t) => isInYear(t.date, year))
      const sum = (list: Transaction[]) =>
        list.reduce((s, t) => s + t.amount, 0)
      const sortByDate = (list: Transaction[]) => {
        const next = [...list]
        next.sort((a, b) =>
          a.date === b.date ? b.amount - a.amount : b.date.localeCompare(a.date),
        )
        return next
      }
      return {
        monthList: sortByDate(month),
        yearList: yr,
        allList: forCard,
        monthSum: sum(month),
        yearSum: sum(yr),
        allSum: sum(forCard),
      }
    }, [transactions, cardBrandId, year, monthIndex])

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
      }).format(new Date(year, monthIndex)),
    [year, monthIndex],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !cardBrandId) return null

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="card-spend-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[var(--radius-card)] bg-white shadow-[var(--shadow-card)] sm:max-h-[85dvh] sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-black/[0.06] px-5 py-4">
          <p
            id="card-spend-title"
            className="text-base font-semibold text-starbucks-green"
          >
            {label}
          </p>
          <p className="mt-1 text-sm text-text-soft">
            이 카드로 기록한 지출만 모았어요.
          </p>
          <div className="mt-4 grid gap-3 rounded-[var(--radius-card)] border border-black/[0.06] bg-neutral-cool/40 p-4">
            <div>
              <p className="text-xs font-medium text-text-soft">{monthTitle}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-semantic-expense">
                {fmt.format(monthSum)}
              </p>
              <p className="mt-0.5 text-xs text-text-soft">
                {monthList.length}건
              </p>
            </div>
            <div className="border-t border-black/[0.06] pt-3">
              <p className="text-xs font-medium text-text-soft">
                {year}년 누적
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-semantic-expense">
                {fmt.format(yearSum)}
              </p>
              <p className="mt-0.5 text-xs text-text-soft">
                {yearList.length}건
              </p>
            </div>
            {allSum !== yearSum ? (
              <div className="border-t border-black/[0.06] pt-3">
                <p className="text-xs font-medium text-text-soft">
                  전체 기간 누적
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[rgba(0,0,0,0.72)]">
                  {fmt.format(allSum)}
                </p>
                <p className="mt-0.5 text-xs text-text-soft">
                  {allList.length}건
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <p className="mb-2 text-xs font-medium text-text-soft">
            {monthTitle} 상세
          </p>
          {monthList.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-soft">
              이 달에는 이 카드 지출이 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {monthList.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-neutral-cool/50"
                    onClick={() => {
                      onPickDay(t.date)
                      onClose()
                    }}
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-medium text-[rgba(0,0,0,0.87)]">
                        {t.date}
                        {t.category ? ` · ${t.category}` : ''}
                      </span>
                      {t.memo ? (
                        <span className="mt-0.5 block truncate text-xs text-text-soft">
                          {t.memo}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-semantic-expense">
                      −{fmt.format(t.amount)}
                    </span>
                  </button>
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
        </div>
      </div>
    </div>
  )
}
