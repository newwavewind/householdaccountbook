import { useMemo, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../constants/categories'
import type { Transaction } from '../types/transaction'

const BAR_TONES = [
  'bg-green-accent',
  'bg-starbucks-green',
  'bg-green-uplift',
  'bg-[#3d8b73]',
  'bg-[#5a9e89]',
] as const

const DONUT_PALETTE = [
  '#00754a',
  '#006241',
  '#c82014',
  '#cba258',
  '#2b5148',
  '#33433d',
  '#007350',
  '#8b5a2b',
] as const

function categoryKey(t: Transaction) {
  return t.category?.trim() || '미분류'
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

  const [selected, setSelected] = useState<string | null>(null)

  const selAmount = selected ? (totals.get(selected) ?? 0) : 0
  const selCount = useMemo(() => {
    if (!selected) return 0
    return expenses.filter((t) => categoryKey(t) === selected).length
  }, [expenses, selected])

  const pct =
    totalSum > 0 ? Math.min(100, Math.round((selAmount / totalSum) * 1000) / 10) : 0

  const R = 42
  const stroke = 14
  const C = 2 * Math.PI * R
  const dashActive = (pct / 100) * C

  const donutColor =
    selected != null
      ? DONUT_PALETTE[(keyIndex.get(selected) ?? 0) % DONUT_PALETTE.length]!
      : DONUT_PALETTE[0]!

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
        {orderedKeys.map((key) => {
          const sum = totals.get(key) ?? 0
          const barPct = totalSum > 0 ? (sum / totalSum) * 100 : 0
          const isOn = selected === key
          const tone =
            BAR_TONES[(keyIndex.get(key) ?? 0) % BAR_TONES.length]!
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => setSelected((prev) => (prev === key ? null : key))}
                className={[
                  'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                  isOn
                    ? 'border-green-accent bg-green-light/60 shadow-[inset_0_0_0_1px_rgba(0,117,74,0.12)]'
                    : 'border-black/[0.06] bg-white hover:bg-neutral-cool/70',
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
            </li>
          )
        })}
      </ul>

      {selected != null ? (
        <div className="mt-6 flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-black/[0.08] bg-neutral-cool/40 px-4 py-5 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
          <div className="relative shrink-0" aria-hidden>
            <svg
              width="132"
              height="132"
              viewBox="0 0 132 132"
              className="drop-shadow-sm"
            >
              <circle
                cx="66"
                cy="66"
                r={R}
                fill="none"
                stroke="var(--color-ceramic)"
                strokeWidth={stroke}
              />
              {pct > 0 ? (
                <circle
                  cx="66"
                  cy="66"
                  r={R}
                  fill="none"
                  stroke={donutColor}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${dashActive} ${C}`}
                  transform="rotate(-90 66 66)"
                />
              ) : null}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-0.5 text-center">
              <span className="text-[0.7rem] font-medium text-text-soft">
                비율
              </span>
              <span className="text-xl font-bold tabular-nums text-[rgba(0,0,0,0.87)]">
                {pct}%
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-text-soft">
              선택한 분류
            </p>
            <p className="mt-1 text-lg font-semibold text-starbucks-green">
              {selected}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-semantic-expense">
              {fmtKrw.format(selAmount)}
            </p>
            <p className="mt-2 text-sm text-text-soft">
              이번 달 지출 합계{' '}
              <span className="font-medium text-[rgba(0,0,0,0.87)]">
                {fmtKrw.format(totalSum)}
              </span>
              {' · '}
              이 분류{' '}
              <span className="font-medium text-[rgba(0,0,0,0.87)]">
                {pct}%
              </span>
            </p>
            <p className="mt-1 text-xs text-text-soft">
              해당 분류 거래 {selCount}건
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-text-soft">
          분류 줄을 누르면 합계와 이번 달 지출 대비 비율이 도표로 보여요.
        </p>
      )}
    </div>
  )
}
