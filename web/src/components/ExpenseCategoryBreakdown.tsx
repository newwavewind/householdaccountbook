import { useEffect, useMemo, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../constants/categories'
import { cardBrandLabel } from '../constants/cardBrands'
import type { Transaction } from '../types/transaction'

const BAR_TONES = [
  'bg-green-accent',
  'bg-starbucks-green',
  'bg-green-uplift',
  'bg-[#3d8b73]',
  'bg-[#5a9e89]',
] as const

function categoryKey(t: Transaction) {
  return t.category?.trim() || '미분류'
}

function shortLedgerDate(iso: string): string {
  const p = iso.split('-').map(Number)
  if (p.length < 3 || !p.every(Number.isFinite)) return iso
  return `${p[1]}월 ${p[2]}일`
}

function paymentCaption(t: Transaction): string | null {
  if (t.paymentMethod === 'cash') return '현금'
  if (t.paymentMethod === 'ieum') return '이음카드'
  if (t.paymentMethod === 'card')
    return cardBrandLabel(t.cardBrand) ?? '카드'
  return null
}

export interface ExpenseCategoryBreakdownProps {
  /** 이번 달 지출 거래만 */
  expenses: Transaction[]
  fmtKrw: Intl.NumberFormat
}

export function ExpenseCategoryBreakdown({
  expenses,
  fmtKrw,
}: ExpenseCategoryBreakdownProps) {
  const { totals, totalSum, orderedKeys, keyIndex } = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of expenses) {
      const k = categoryKey(t)
      totals.set(k, (totals.get(k) ?? 0) + t.amount)
    }
    const known = new Set<string>([...EXPENSE_CATEGORIES])
    const extra = [...totals.keys()].filter((k) => !known.has(k))
    extra.sort((a, b) => a.localeCompare(b, 'ko'))
    const orderedKeys = [...EXPENSE_CATEGORIES, ...extra]
    const totalSum = [...totals.values()].reduce((s, v) => s + v, 0)
    const keyIndex = new Map<string, number>()
    orderedKeys.forEach((k, i) => keyIndex.set(k, i))
    return { totals, totalSum, orderedKeys, keyIndex }
  }, [expenses])

  const visibleKeys = useMemo(
    () => orderedKeys.filter((k) => (totals.get(k) ?? 0) > 0),
    [orderedKeys, totals],
  )

  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (selected && !visibleKeys.includes(selected)) {
      setSelected(null)
    }
  }, [selected, visibleKeys])

  const detailsForCategory = (cat: string): Transaction[] => {
    return expenses
      .filter((t) => categoryKey(t) === cat)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
  }

  if (expenses.length === 0) {
    return (
      <p className="mt-6 py-4 text-center text-sm text-text-soft">
        이번 달 지출 기록이 없습니다.
      </p>
    )
  }

  return (
    <div className="mt-4">
      <ul className="flex flex-col gap-1.5">
        {visibleKeys.map((key) => {
          const sum = totals.get(key) ?? 0
          const barPct = totalSum > 0 ? (sum / totalSum) * 100 : 0
          const isOn = selected === key
          const tone =
            BAR_TONES[(keyIndex.get(key) ?? 0) % BAR_TONES.length]!
          const rowIdx = keyIndex.get(key) ?? 0
          const detailId = `exp-cat-detail-${rowIdx}`
          const pct =
            totalSum > 0
              ? Math.min(100, Math.round((sum / totalSum) * 1000) / 10)
              : 0
          const lines = isOn ? detailsForCategory(key) : []
          const n = lines.length

          const shell = [
            'overflow-hidden rounded-lg border transition-colors',
            isOn
              ? 'border-green-accent bg-green-light/60 shadow-[inset_0_0_0_1px_rgba(0,117,74,0.12)]'
              : 'border-black/[0.06] bg-white',
          ].join(' ')

          return (
            <li key={key}>
              <div className={shell}>
                <button
                  type="button"
                  aria-expanded={isOn}
                  aria-controls={detailId}
                  onClick={() => setSelected((prev) => (prev === key ? null : key))}
                  className={[
                    'w-full px-3 py-2.5 text-left transition-colors',
                    isOn ? '' : 'hover:bg-neutral-cool/70',
                  ].join(' ')}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 shrink text-sm font-medium text-[rgba(0,0,0,0.87)]">
                      {key}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-semantic-expense">
                      {fmtKrw.format(sum)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ceramic/90">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        sum > 0 ? tone : 'opacity-0'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </button>
                {isOn ? (
                  <div
                    id={detailId}
                    role="region"
                    aria-label={`${key} 분류 상세`}
                    className="border-t border-black/[0.08] bg-white/80 px-3 py-3"
                  >
                    <p className="text-[0.7rem] font-medium uppercase tracking-wide text-text-soft">
                      이번 달 이 분류
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-[rgba(0,0,0,0.78)]">
                      <span className="font-semibold tabular-nums text-semantic-expense">
                        {fmtKrw.format(sum)}
                      </span>
                      <span className="text-text-soft">·</span>
                      <span>
                        비율{' '}
                        <span className="font-semibold tabular-nums">
                          {pct}%
                        </span>
                      </span>
                      <span className="text-text-soft">·</span>
                      <span>{n}건</span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-soft">
                      전체 지출 합계 {fmtKrw.format(totalSum)}
                    </p>
                    {n === 0 ? (
                      <p className="mt-3 text-sm text-text-soft">
                        표시할 거래가 없습니다.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-black/[0.06]">
                        {lines.map((t) => {
                          const cap = paymentCaption(t)
                          return (
                            <li key={t.id} className="py-2.5">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                <span className="text-[0.7rem] font-medium uppercase tracking-wide text-text-soft tabular-nums">
                                  {shortLedgerDate(t.date)}
                                </span>
                                <span className="shrink-0 text-sm font-semibold tabular-nums text-semantic-expense">
                                  {fmtKrw.format(t.amount)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 text-xs leading-snug text-text-soft">
                                {t.memo?.trim() ? (
                                  <span className="min-w-0 break-words text-[rgba(0,0,0,0.65)]">
                                    {t.memo.trim()}
                                  </span>
                                ) : (
                                  <span className="text-text-soft/90">메모 없음</span>
                                )}
                                {cap ? (
                                  <>
                                    <span aria-hidden className="text-text-soft/50">
                                      ·
                                    </span>
                                    <span>{cap}</span>
                                  </>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {!selected ? (
        <p className="mt-4 text-center text-sm text-text-soft">
          분류를 누르면 해당 분류 거래 목록과 합계·비율이 펼쳐져 보여요.
        </p>
      ) : null}
    </div>
  )
}
