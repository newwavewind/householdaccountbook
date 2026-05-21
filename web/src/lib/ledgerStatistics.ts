import {
  CARD_BRAND_LEGACY_CHART_ID,
  cardBrandChartColor,
  cardBrandLabel,
} from '../constants/cardBrands'
import type { Transaction } from '../types/transaction'

export type CardBrandStatRow = {
  id: string
  label: string
  amount: number
  /** 카드 지출 합계 대비 % */
  pct: number
  color: string
}

export type LedgerStatSegment = {
  id: string
  label: string
  value: number
  color: string
}

export type LedgerMonthStats = {
  year: number
  month: number
  monthLabel: string
  daysInMonth: number
  incomeTotal: number
  expenseTotal: number
  netTotal: number
  incomeCount: number
  expenseCount: number
  /** 수입이 있을 때 (지출/수입)×100, 없으면 null */
  expenseRatioPct: number | null
  avgExpensePerDay: number
  peakExpenseDay: { day: number; amount: number } | null
  dailyExpense: number[]
  weekdayExpense: number[]
  weekdayLabels: string[]
  flowSegments: LedgerStatSegment[]
  paymentSegments: LedgerStatSegment[]
  cardExpenseTotal: number
  cardBrandRows: CardBrandStatRow[]
  topCategories: { name: string; amount: number; pct: number }[]
  memberRows: { name: string; expense: number; income: number }[]
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#006241',
  ieum: '#2b5148',
  card: '#cba258',
  legacy: '#9ca3af',
}

const FLOW_COLORS = {
  income: '#00754a',
  expense: '#c82014',
}

function categoryKey(t: Transaction) {
  return t.category?.trim() || '미분류'
}

function paymentSegmentId(t: Transaction): string {
  if (t.paymentMethod === 'cash') return 'cash'
  if (t.paymentMethod === 'ieum') return 'ieum'
  if (t.paymentMethod === 'card') return 'card'
  return 'legacy'
}

function paymentLabel(id: string): string {
  if (id === 'cash') return '현금'
  if (id === 'ieum') return '이음카드'
  if (id === 'card') return '신용·체크카드'
  return '미지정'
}

export function buildLedgerMonthStats(
  transactions: Transaction[],
  year: number,
  monthIndex: number,
): LedgerMonthStats {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const dailyExpense = Array.from({ length: daysInMonth }, () => 0)
  const weekdayExpense = [0, 0, 0, 0, 0, 0, 0]

  let incomeTotal = 0
  let expenseTotal = 0
  let incomeCount = 0
  let expenseCount = 0

  const paymentTotals = new Map<string, number>()
  const cardBrandTotals = new Map<string, number>()
  const categoryTotals = new Map<string, number>()
  const memberExpense = new Map<string, number>()
  const memberIncome = new Map<string, number>()

  for (const t of transactions) {
    if (t.type === 'income') {
      incomeTotal += t.amount
      incomeCount += 1
      const m = t.memberName?.trim() || '미지정'
      memberIncome.set(m, (memberIncome.get(m) ?? 0) + t.amount)
      continue
    }

    expenseTotal += t.amount
    expenseCount += 1

    const parts = t.date.split('-').map(Number)
    const day = parts[2]
    if (day >= 1 && day <= daysInMonth) {
      dailyExpense[day - 1]! += t.amount
      const dow = new Date(year, monthIndex, day).getDay()
      weekdayExpense[dow]! += t.amount
    }

    const payId = paymentSegmentId(t)
    paymentTotals.set(payId, (paymentTotals.get(payId) ?? 0) + t.amount)

    if (t.paymentMethod === 'card') {
      const brandId = t.cardBrand?.trim() || CARD_BRAND_LEGACY_CHART_ID
      cardBrandTotals.set(
        brandId,
        (cardBrandTotals.get(brandId) ?? 0) + t.amount,
      )
    }

    const cat = categoryKey(t)
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + t.amount)

    const mem = t.memberName?.trim() || '미지정'
    memberExpense.set(mem, (memberExpense.get(mem) ?? 0) + t.amount)
  }

  let peakExpenseDay: { day: number; amount: number } | null = null
  let spendingDayCount = 0
  for (let i = 0; i < dailyExpense.length; i++) {
    const amt = dailyExpense[i]!
    if (amt > 0) spendingDayCount += 1
    if (!peakExpenseDay || amt > peakExpenseDay.amount) {
      peakExpenseDay = amt > 0 ? { day: i + 1, amount: amt } : peakExpenseDay
    }
  }

  const avgExpensePerDay =
    spendingDayCount > 0 ? Math.round(expenseTotal / spendingDayCount) : 0

  const expenseRatioPct =
    incomeTotal > 0
      ? Math.min(999, Math.round((expenseTotal / incomeTotal) * 1000) / 10)
      : null

  const flowSegments: LedgerStatSegment[] = []
  if (incomeTotal > 0) {
    flowSegments.push({
      id: 'income',
      label: '수입',
      value: incomeTotal,
      color: FLOW_COLORS.income,
    })
  }
  if (expenseTotal > 0) {
    flowSegments.push({
      id: 'expense',
      label: '지출',
      value: expenseTotal,
      color: FLOW_COLORS.expense,
    })
  }

  const cardExpenseTotal = [...cardBrandTotals.values()].reduce((s, v) => s + v, 0)
  const cardBrandRows: CardBrandStatRow[] = [...cardBrandTotals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => ({
      id,
      label:
        id === CARD_BRAND_LEGACY_CHART_ID
          ? '카드(브랜드 미지정)'
          : (cardBrandLabel(id) ?? id),
      amount,
      pct:
        cardExpenseTotal > 0
          ? Math.min(100, Math.round((amount / cardExpenseTotal) * 1000) / 10)
          : 0,
      color: cardBrandChartColor(id),
    }))

  const paymentSegments: LedgerStatSegment[] = [...paymentTotals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({
      id,
      label:
        id === 'card'
          ? '신용·체크카드'
          : paymentLabel(id),
      value,
      color: PAYMENT_COLORS[id] ?? '#5a9e89',
    }))

  const catTotalSum = [...categoryTotals.values()].reduce((s, v) => s + v, 0)
  const topCategories = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({
      name,
      amount,
      pct:
        catTotalSum > 0
          ? Math.min(100, Math.round((amount / catTotalSum) * 1000) / 10)
          : 0,
    }))

  const memberNames = new Set([
    ...memberExpense.keys(),
    ...memberIncome.keys(),
  ])
  const memberRows = [...memberNames]
    .map((name) => ({
      name,
      expense: memberExpense.get(name) ?? 0,
      income: memberIncome.get(name) ?? 0,
    }))
    .filter((r) => r.expense > 0 || r.income > 0)
    .sort((a, b) => b.expense + b.income - (a.expense + a.income))

  return {
    year,
    month: monthIndex + 1,
    monthLabel: `${year}년 ${monthIndex + 1}월`,
    daysInMonth,
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal,
    incomeCount,
    expenseCount,
    expenseRatioPct,
    avgExpensePerDay,
    peakExpenseDay,
    dailyExpense,
    weekdayExpense,
    weekdayLabels: [...WEEKDAY_KO],
    flowSegments,
    paymentSegments,
    cardExpenseTotal,
    cardBrandRows,
    topCategories,
    memberRows,
  }
}

export function segmentPercents(
  segments: LedgerStatSegment[],
): { segment: LedgerStatSegment; pct: number }[] {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total <= 0) return []
  return segments.map((segment) => ({
    segment,
    pct: Math.round((segment.value / total) * 1000) / 10,
  }))
}
