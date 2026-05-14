import { useMemo } from 'react'
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

function cardSlices(
  transactions: Transaction[],
  cardBrandId: string,
  year: number,
  monthIndex: number,
): {
  monthList: Transaction[]
  yearList: Transaction[]
  allList: Transaction[]
  monthSum: number
  yearSum: number
  allSum: number
} {
  const forCard = transactions.filter(
    (t) =>
      t.type === 'expense' &&
      t.paymentMethod === 'card' &&
      t.cardBrand === cardBrandId,
  )
  const month = forCard.filter((t) => isInMonth(t.date, year, monthIndex))
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
}

export interface CardPaymentBreakdownProps {
  cash: number
  legacy: number
  cardRows: readonly { id: string; label: string; sum: number }[]
  /** 전 장부(카드별 연간·전체 집계용) */
  transactions: Transaction[]
  year: number
  monthIndex: number
  fmt: Intl.NumberFormat
  /** 거래 줄에서 해당 일 상세 모달 */
  onPickDay: (iso: string) => void
  expandedBrandId: string | null
  onExpandedBrandIdChange: (id: string | null) => void
}

export function CardPaymentBreakdown({
  cash,
  legacy,
  cardRows,
  transactions,
  year,
  monthIndex,
  fmt,
  onPickDay,
  expandedBrandId,
  onExpandedBrandIdChange,
}: CardPaymentBreakdownProps) {
  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
      }).format(new Date(year, monthIndex)),
    [year, monthIndex],
  )

  return (
    <ul className="mt-4 divide-y divide-black/[0.06]">
      <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
        <span className="text-sm font-medium text-[rgba(0,0,0,0.87)]">
          현금
        </span>
        <span className="text-base font-semibold tabular-nums text-semantic-expense">
          {fmt.format(cash)}
        </span>
      </li>

      {cardRows.map((row) => {
        const isOn = expandedBrandId === row.id
        const detailId = `card-pay-detail-${String(row.id).replace(/\W/g, '_')}`
        const {
          monthList,
          yearList,
          allList,
          monthSum,
          yearSum,
          allSum,
        } = isOn ? cardSlices(transactions, row.id, year, monthIndex) : {
          monthList: [] as Transaction[],
          yearList: [] as Transaction[],
          allList: [] as Transaction[],
          monthSum: 0,
          yearSum: 0,
          allSum: 0,
        }

        const shell = [
          'overflow-hidden rounded-lg border transition-colors',
          isOn
            ? 'border-green-accent bg-green-light/55 shadow-[inset_0_0_0_1px_rgba(0,117,74,0.12)]'
            : 'border-transparent bg-transparent',
        ].join(' ')

        return (
          <li key={row.id}>
            <div className={shell}>
              <button
                type="button"
                aria-expanded={isOn}
                aria-controls={detailId}
                className={`flex w-full items-center justify-between gap-3 py-3 text-left transition-colors ${
                  isOn ? '' : 'rounded-lg hover:bg-neutral-cool/40'
                }`}
                onClick={() =>
                  onExpandedBrandIdChange(isOn ? null : row.id)
                }
              >
                <span
                  className={`text-sm font-medium ${
                    isOn
                      ? 'text-starbucks-green'
                      : 'text-starbucks-green underline decoration-starbucks-green/25 underline-offset-2'
                  }`}
                >
                  {row.label}
                </span>
                <span className="text-base font-semibold tabular-nums text-semantic-expense">
                  {fmt.format(row.sum)}
                </span>
              </button>
              {isOn ? (
                <div
                  id={detailId}
                  role="region"
                  aria-label={`${cardBrandLabel(row.id) ?? row.label} 거래`}
                  className="border-t border-black/[0.08] bg-white/85 px-3 py-4"
                >
                  <div className="grid gap-3 rounded-[var(--radius-card)] border border-black/[0.06] bg-neutral-cool/40 p-3">
                    <div>
                      <p className="text-xs font-medium text-text-soft">
                        {monthTitle}
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-semantic-expense md:text-2xl">
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

                  <p className="mb-2 mt-4 text-xs font-medium text-text-soft">
                    {monthTitle} 상세
                  </p>
                  {monthList.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-black/[0.1] bg-neutral-cool/30 py-5 text-center text-sm text-text-soft">
                      이 달에는 이 카드 지출이 없어요.
                    </p>
                  ) : (
                    <ul className="divide-y divide-black/[0.06] rounded-lg border border-black/[0.06] bg-white">
                      {monthList.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-neutral-cool/50"
                            onClick={() => onPickDay(t.date)}
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
              ) : null}
            </div>
          </li>
        )
      })}

      {legacy > 0 ? (
        <li className="flex items-center justify-between gap-3 py-3">
          <span className="text-sm text-text-soft">미입력 · 과거 기록 등</span>
          <span className="text-base font-semibold tabular-nums text-semantic-expense">
            {fmt.format(legacy)}
          </span>
        </li>
      ) : null}
    </ul>
  )
}
