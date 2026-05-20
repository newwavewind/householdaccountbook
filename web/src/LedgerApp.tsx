import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useSearchParams } from 'react-router-dom'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { Fab } from './components/ui/Fab'
import { LedgerCalendar } from './components/LedgerCalendar'
import { NoSpendChallengeBanner } from './components/NoSpendChallengeBanner'
import { burstNoSpendConfetti } from './lib/noSpendConfetti'
import { CalendarHoverTooltip } from './components/CalendarHoverTooltip'
import { TransactionFormModal } from './components/TransactionFormModal'
import { BulkRowManageIcon } from './bulkInput/BulkRowManageIcon'
import { CategoryLabel } from './components/CategoryLabel'
import { DayDetailModal } from './components/DayDetailModal'
import { ExpenseCategoryBreakdown } from './components/ExpenseCategoryBreakdown'
import { useLedger } from './hooks/useLedger'
import { rollupByDate } from './lib/dayTotals'
import { ledgerStartIso, monthNoSpendStats } from './lib/noSpendChallenge'
import { cardBrandLabel } from './constants/cardBrands'
import type { PaymentMethod, Transaction } from './types/transaction'
import HouseholdSetupModal from './components/HouseholdSetupModal'
import { getSupabase } from './lib/supabaseClient'
import { ledgerBackendMode } from './lib/ledgerBackend'
import { useThemePreference } from './theme/ThemeContext'

type TxListSort = {
  /** 현재 사용자가 선택한 우선 정렬 기준 */
  primary: 'amount' | 'date'
  amountDir: 'desc' | 'asc'
  dateDir: 'desc' | 'asc'
}

function compareTransactions(a: Transaction, b: Transaction, cfg: TxListSort) {
  const amtCmp =
    cfg.amountDir === 'desc'
      ? b.amount - a.amount
      : a.amount - b.amount
  const dateCmp =
    cfg.dateDir === 'desc'
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date)
  if (cfg.primary === 'amount') {
    if (amtCmp !== 0) return amtCmp
    return dateCmp
  }
  if (dateCmp !== 0) return dateCmp
  return amtCmp
}

const LEGACY_CARD_BRAND_SENTINEL = '__legacy_card__'
type ExpensePayFilter = 'all' | 'cash' | 'ieum' | 'card'
type TxListTab = 'all' | 'income' | 'expense'
type LedgerDetailPanel = 'transactions' | 'category'

const LEDGER_DETAIL_PANELS: { id: LedgerDetailPanel; label: string }[] = [
  { id: 'transactions', label: '거래 내역' },
  { id: 'category', label: '분류별 지출' },
]

function LedgerPanelNavButton({
  direction,
  label,
  onClick,
}: {
  direction: 'prev' | 'next'
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-starbucks-green/15 bg-surface-raised/90 text-starbucks-green shadow-[var(--shadow-frap-base)] backdrop-blur-sm transition-all hover:border-starbucks-green/35 hover:bg-house-green/10 active:scale-[0.97]"
      onClick={onClick}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {direction === 'prev' ? (
          <path d="M15 18l-6-6 6-6" />
        ) : (
          <path d="M9 18l6-6-6-6" />
        )}
      </svg>
    </button>
  )
}

function LedgerDetailPanelHeader({
  detailPanel,
  onSelect,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  detailPanel: LedgerDetailPanel
  onSelect: (id: LedgerDetailPanel) => void
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-subtle/80 bg-gradient-to-br from-house-green/[0.07] via-ceramic/50 to-surface-raised p-2 shadow-[var(--shadow-card)]">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-starbucks-green/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-2">
        <LedgerPanelNavButton direction="prev" label={prevLabel} onClick={onPrev} />
        <div
          role="tablist"
          aria-label="화면 전환"
          className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1 theme2:bg-neutral-cool/50"
        >
          {LEDGER_DETAIL_PANELS.map((panel) => {
            const active = detailPanel === panel.id
            return (
              <button
                key={panel.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`rounded-lg px-2 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-surface-raised text-starbucks-green shadow-[var(--shadow-frap-base)] ring-1 ring-starbucks-green/20'
                    : 'text-text-soft hover:bg-surface-raised/60 hover:text-text-primary'
                }`}
                onClick={() => onSelect(panel.id)}
              >
                {panel.label}
              </button>
            )
          })}
        </div>
        <LedgerPanelNavButton direction="next" label={nextLabel} onClick={onNext} />
      </div>
    </div>
  )
}

function PaymentFilterIcon({ id }: { id: ExpensePayFilter }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (id === 'all') {
    return (
      <svg {...common}>
        <path d="M4 6h16M4 12h10M4 18h6" />
      </svg>
    )
  }
  if (id === 'cash') {
    return (
      <svg {...common}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    )
  }
  if (id === 'ieum') {
    return (
      <svg {...common}>
        <path d="M3 10h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z" />
        <path d="M3 10l2-4h14l2 4" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

const EXPENSE_PAY_FILTERS: { id: ExpensePayFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'cash', label: '현금' },
  { id: 'ieum', label: '이음카드' },
  { id: 'card', label: '신용카드' },
]

function LedgerSectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-starbucks-green to-house-green"
        aria-hidden
      />
      <h2 className="!m-0 text-lg font-bold tracking-tight text-starbucks-green md:text-xl">
        {title}
      </h2>
    </div>
  )
}

function ExpensePayFilterBar({
  value,
  cardBrandFilter,
  cardRows,
  legacyCount,
  selectedTotal,
  fmtKrw,
  onChange,
  onCardBrandChange,
}: {
  value: ExpensePayFilter
  cardBrandFilter: string | null
  cardRows: { id: string; label: string; sum: number }[]
  legacyCount: number
  selectedTotal: number
  fmtKrw: Intl.NumberFormat
  onChange: (id: ExpensePayFilter) => void
  onCardBrandChange: (id: string | null) => void
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {EXPENSE_PAY_FILTERS.map((chip) => {
          const active = value === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={active}
              aria-label={
                active
                  ? `${chip.label} 합계 ${fmtKrw.format(selectedTotal)}`
                  : chip.label
              }
              onClick={() => onChange(chip.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'border-starbucks-green/35 bg-starbucks-green/10 text-starbucks-green ring-1 ring-starbucks-green/20'
                  : 'border-border-subtle/80 bg-surface-raised text-text-secondary hover:border-starbucks-green/25 hover:text-starbucks-green'
              }`}
            >
              <PaymentFilterIcon id={chip.id} />
              <span>{chip.label}</span>
              {active ? (
                <span className="tabular-nums text-semantic-expense">
                  −{fmtKrw.format(selectedTotal)}
                </span>
              ) : null}
            </button>
          )
        })}
        {value === 'card' ? (
          <label className="inline-flex items-center gap-2 rounded-lg border border-border-subtle/80 bg-surface-raised px-3 py-2">
            <span className="text-xs text-text-soft">카드사</span>
            <select
              className="cursor-pointer bg-transparent text-xs font-semibold text-text-primary outline-none"
              aria-label="신용 카드사 선택"
              value={cardBrandFilter ?? ''}
              onChange={(e) =>
                onCardBrandChange(e.target.value ? e.target.value : null)
              }
            >
              <option value="">전체</option>
              {cardRows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
              {legacyCount > 0 ? (
                <option value={LEGACY_CARD_BRAND_SENTINEL}>미입력</option>
              ) : null}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  )
}

function filterExpenseTransactions(
  base: Transaction[],
  payFilter: ExpensePayFilter,
  cardBrandFilter: string | null,
): Transaction[] {
  if (payFilter === 'all') return base
  if (payFilter === 'cash') return base.filter((t) => t.paymentMethod === 'cash')
  if (payFilter === 'ieum') return base.filter((t) => t.paymentMethod === 'ieum')
  let list = base.filter((t) => t.paymentMethod === 'card')
  if (cardBrandFilter === null) return list
  if (cardBrandFilter === LEGACY_CARD_BRAND_SENTINEL) {
    return list.filter((t) => !t.cardBrand)
  }
  return list.filter((t) => t.cardBrand === cardBrandFilter)
}

function expensePaymentLabel(t: Transaction): string {
  if (t.paymentMethod === 'cash') return '현금'
  if (t.paymentMethod === 'ieum') return '이음카드'
  if (t.paymentMethod === 'card') {
    return t.cardBrand
      ? (cardBrandLabel(t.cardBrand) ?? t.cardBrand)
      : '신용카드(미입력)'
  }
  return '미입력'
}

function TransactionLedgerRow({
  t,
  fmtKrw,
  onSelectDate,
}: {
  t: Transaction
  fmtKrw: Intl.NumberFormat
  onSelectDate: (iso: string) => void
}) {
  const isIncome = t.type === 'income'
  return (
    <li className="flex items-start gap-3 py-3">
      <button
        type="button"
        className="min-w-0 flex-1 rounded-lg py-0.5 text-left transition-colors hover:bg-neutral-cool/40"
        onClick={() => onSelectDate(t.date)}
      >
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-text-soft">
          <span className="tabular-nums">{t.date}</span>
          {t.category ? (
            <CategoryLabel
              name={t.category}
              textClassName="text-text-primary/80"
            />
          ) : null}
        </span>
        {t.memo ? (
          <span className="mt-0.5 block truncate text-sm font-medium text-text-primary">
            {t.memo}
          </span>
        ) : null}
      </button>
      <div className="flex shrink-0 flex-col items-end gap-0.5 self-center">
        {!isIncome ? (
          <span className="max-w-[8.5rem] truncate text-[0.7rem] text-text-soft">
            {expensePaymentLabel(t)}
          </span>
        ) : null}
        <span
          className={`text-sm font-semibold tabular-nums tracking-tight ${
            isIncome ? 'text-semantic-income' : 'text-semantic-expense'
          }`}
        >
          {isIncome ? '+' : '−'}
          {fmtKrw.format(t.amount)}
        </span>
      </div>
    </li>
  )
}

function SortToggleRow({
  value,
  onToggleAmount,
  onToggleDate,
}: {
  value: TxListSort
  onToggleAmount: () => void
  onToggleDate: () => void
}) {
  const amountSubs =
    value.amountDir === 'desc' ? '높은순' : '낮은순'
  const dateSubs =
    value.dateDir === 'desc' ? '내림차순' : '오름차순'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        aria-pressed={value.primary === 'amount'}
        variant={value.primary === 'amount' ? 'primary' : 'outlined'}
        className="!px-3 !py-1 !text-xs"
        onClick={onToggleAmount}
      >
        금액순{' '}
        <span className="tabular-nums">{amountSubs}</span>
      </Button>
      <Button
        type="button"
        aria-pressed={value.primary === 'date'}
        variant={value.primary === 'date' ? 'primary' : 'outlined'}
        className="!px-3 !py-1 !text-xs"
        onClick={onToggleDate}
      >
        날짜순{' '}
        <span className="tabular-nums">{dateSubs}</span>
      </Button>
    </div>
  )
}

function formatMonthLabel(year: number, monthIndex: number) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, monthIndex))
}

function monthPrefix(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

function isInMonth(dateIso: string, year: number, monthIndex: number) {
  return dateIso.startsWith(monthPrefix(year, monthIndex))
}

function isInYear(dateIso: string, year: number) {
  return dateIso.startsWith(`${year}-`)
}

function todayIso() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export default function LedgerApp() {
  const {
    transactions,
    add,
    update,
    remove,
    syncState,
    userId,
    householdId,
    cloudMembers,
    setCloudMembers,
  } = useLedger()

  const { preference: uiTheme } = useThemePreference()

  const isSupabase = ledgerBackendMode() === 'supabase'
  const showHouseholdSetup = isSupabase && !!userId && !householdId

  const [householdCode, setHouseholdCode] = useState<string | null>(null)
  useEffect(() => {
    if (!householdId) { setHouseholdCode(null); return }
    const sb = getSupabase()
    if (!sb) return
    void sb.from('households').select('code').eq('id', householdId).maybeSingle()
      .then(({ data }) => { if (data) setHouseholdCode(data.code as string) })
  }, [householdId])
  const now = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState({
    y: now.getFullYear(),
    m: now.getMonth(),
  })
  const [detailPanel, setDetailPanel] = useState<LedgerDetailPanel>('transactions')
  const [txListTab, setTxListTab] = useState<TxListTab>('all')
  const [txSort, setTxSort] = useState<TxListSort>({
    primary: 'amount',
    amountDir: 'desc',
    dateDir: 'desc',
  })
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [hover, setHover] = useState<{
    iso: string
    clientX: number
    clientY: number
  } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [dayModalIso, setDayModalIso] = useState<string | null>(null)
  const [expensePayFilter, setExpensePayFilter] =
    useState<ExpensePayFilter>('all')
  const [expenseCardBrandFilter, setExpenseCardBrandFilter] = useState<
    string | null
  >(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState<Transaction | null>(null)
  const [formDefaultDate, setFormDefaultDate] = useState<string | undefined>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsWrapRef = useRef<HTMLDivElement>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [newMemberName, setNewMemberName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ member: string; step: 1 | 2 } | null>(null)
  const [memberManageOpen, setMemberManageOpen] = useState(false)
  const [noSpendCelebrate, setNoSpendCelebrate] = useState(false)

  const toggleNoSpendCelebrate = useCallback(() => {
    setNoSpendCelebrate((on) => {
      if (!on) burstNoSpendConfetti()
      return !on
    })
  }, [])

  useEffect(() => {
    setNoSpendCelebrate(false)
  }, [cursor.y, cursor.m])

  const moveMember = useCallback(
    (index: number, dir: -1 | 1) => {
      setCloudMembers((prev) => {
        const j = index + dir
        if (j < 0 || j >= prev.length) return prev
        const next = [...prev]
        ;[next[index], next[j]] = [next[j]!, next[index]!]
        return next
      })
    },
    [setCloudMembers],
  )

  useEffect(() => {
    if (!settingsOpen) return
    const onDown = (e: MouseEvent) => {
      const el = settingsWrapRef.current
      if (el && !el.contains(e.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [settingsOpen])

  const fmtKrw = useMemo(
    () =>
      new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
      }),
    [],
  )

  const filteredTransactions = useMemo(
    () =>
      selectedMember
        ? transactions.filter(t => t.memberName === selectedMember)
        : transactions,
    [transactions, selectedMember],
  )

  const rollups = useMemo(
    () => rollupByDate(filteredTransactions),
    [filteredTransactions],
  )

  const noSpendStats = useMemo(
    () =>
      monthNoSpendStats(
        cursor.y,
        cursor.m,
        rollups,
        todayIso(),
        ledgerStartIso(filteredTransactions),
      ),
    [rollups, cursor.y, cursor.m, filteredTransactions],
  )

  const yearIncomeTotal = useMemo(
    () =>
      transactions
        .filter((t) => isInYear(t.date, cursor.y) && t.type === 'income')
        .reduce((s, t) => s + t.amount, 0),
    [transactions, cursor.y],
  )

  const yearExpenseTotal = useMemo(
    () =>
      transactions
        .filter((t) => isInYear(t.date, cursor.y) && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0),
    [transactions, cursor.y],
  )

  const yearTxCount = useMemo(
    () => transactions.filter((t) => isInYear(t.date, cursor.y)).length,
    [transactions, cursor.y],
  )

  const filtered = useMemo(
    () =>
      transactions.filter(
        (t) =>
          isInMonth(t.date, cursor.y, cursor.m) &&
          (selectedMember === null || t.memberName === selectedMember),
      ),
    [transactions, cursor.y, cursor.m, selectedMember],
  )

  const incomeTotal = useMemo(
    () =>
      filtered
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0),
    [filtered],
  )

  const expenseTotal = useMemo(
    () =>
      filtered
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0),
    [filtered],
  )

  const monthExpenseTransactions = useMemo(
    () => filtered.filter((t) => t.type === 'expense'),
    [filtered],
  )

  const toggleTxAmount = useCallback(() => {
    setTxSort((prev) => ({
      ...prev,
      primary: 'amount',
      amountDir: prev.amountDir === 'desc' ? 'asc' : 'desc',
    }))
  }, [])

  const toggleTxDate = useCallback(() => {
    setTxSort((prev) => ({
      ...prev,
      primary: 'date',
      dateDir: prev.dateDir === 'desc' ? 'asc' : 'desc',
    }))
  }, [])

  const monthIncomeTransactions = useMemo(
    () => filtered.filter((t) => t.type === 'income'),
    [filtered],
  )

  const incomesSorted = useMemo(() => {
    const next = [...monthIncomeTransactions]
    next.sort((a, b) => compareTransactions(a, b, txSort))
    return next
  }, [monthIncomeTransactions, txSort])

  const expensesFilteredSorted = useMemo(() => {
    const list = filterExpenseTransactions(
      monthExpenseTransactions,
      expensePayFilter,
      expenseCardBrandFilter,
    )
    const next = [...list]
    next.sort((a, b) => compareTransactions(a, b, txSort))
    return next
  }, [
    monthExpenseTransactions,
    expensePayFilter,
    expenseCardBrandFilter,
    txSort,
  ])

  const displayedTransactions = useMemo(() => {
    if (txListTab === 'income') return incomesSorted
    if (txListTab === 'expense') return expensesFilteredSorted
    const combined = [
      ...monthIncomeTransactions,
      ...filterExpenseTransactions(
        monthExpenseTransactions,
        expensePayFilter,
        expenseCardBrandFilter,
      ),
    ]
    const next = [...combined]
    next.sort((a, b) => compareTransactions(a, b, txSort))
    return next
  }, [
    txListTab,
    incomesSorted,
    expensesFilteredSorted,
    monthIncomeTransactions,
    monthExpenseTransactions,
    expensePayFilter,
    expenseCardBrandFilter,
    txSort,
  ])

  const monthNetTotal = incomeTotal - expenseTotal

  const expenseFilteredTotal = useMemo(
    () => expensesFilteredSorted.reduce((s, t) => s + t.amount, 0),
    [expensesFilteredSorted],
  )

  const detailPanelIndex = LEDGER_DETAIL_PANELS.findIndex((p) => p.id === detailPanel)
  const shiftDetailPanel = useCallback((delta: -1 | 1) => {
    const next =
      (detailPanelIndex + delta + LEDGER_DETAIL_PANELS.length) %
      LEDGER_DETAIL_PANELS.length
    setDetailPanel(LEDGER_DETAIL_PANELS[next].id)
  }, [detailPanelIndex])

  const expensePaymentBreakdown = useMemo(() => {
    let cash = 0
    let ieum = 0
    let legacy = 0
    const cardMap = new Map<string, number>()
    for (const t of filtered) {
      if (t.type !== 'expense') continue
      if (t.paymentMethod === 'cash') cash += t.amount
      else if (t.paymentMethod === 'ieum') ieum += t.amount
      else if (t.paymentMethod === 'card') {
        if (t.cardBrand) {
          cardMap.set(
            t.cardBrand,
            (cardMap.get(t.cardBrand) ?? 0) + t.amount,
          )
        } else {
          legacy += t.amount
        }
      } else {
        legacy += t.amount
      }
    }
    const cardRows = [...cardMap.entries()]
      .map(([id, sum]) => ({
        id,
        label: cardBrandLabel(id) ?? id,
        sum,
      }))
      .filter((r) => r.sum > 0)
      .sort((a, b) => b.sum - a.sum)
    return { cash, ieum, legacy, cardRows }
  }, [filtered])

  useEffect(() => {
    if (expensePayFilter !== 'card') return
    if (expenseCardBrandFilter === null) return
    if (expenseCardBrandFilter === LEGACY_CARD_BRAND_SENTINEL) {
      if (expensePaymentBreakdown.legacy <= 0) {
        setExpenseCardBrandFilter(null)
      }
      return
    }
    if (
      expensePaymentBreakdown.cardRows.some(
        (r) => r.id === expenseCardBrandFilter,
      )
    ) {
      return
    }
    setExpenseCardBrandFilter(null)
  }, [
    expensePayFilter,
    expenseCardBrandFilter,
    expensePaymentBreakdown.cardRows,
    expensePaymentBreakdown.legacy,
  ])

  const dayModalTxs = useMemo(
    () =>
      dayModalIso
        ? transactions.filter((t) => t.date === dayModalIso)
        : [],
    [transactions, dayModalIso],
  )

  const onCalendarHover = useCallback(
    (detail: null | { iso: string; clientX: number; clientY: number }) => {
      if (!detail) {
        setHover(null)
        return
      }
      if (
        !detail.iso.startsWith(monthPrefix(cursor.y, cursor.m))
      ) {
        setHover(null)
        return
      }
      setHover(detail)
    },
    [cursor.y, cursor.m],
  )

  const onSelectDay = useCallback((iso: string) => {
    const [ys, ms] = iso.split('-')
    const y = Number(ys)
    const m = Number(ms) - 1
    if (!Number.isFinite(y) || !Number.isFinite(m)) return
    setCursor({ y, m })
    setSelectedIso(iso)
    setDayModalIso(iso)
  }, [])

  useEffect(() => {
    const raw = searchParams.get('ledgerDay')
    if (!raw) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      setSearchParams({}, { replace: true })
      return
    }
    const [y, mo, dd] = raw.split('-').map(Number)
    const dt = new Date(y, mo - 1, dd)
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== dd
    ) {
      setSearchParams({}, { replace: true })
      return
    }
    setCursor({ y, m: mo - 1 })
    setSelectedIso(raw)
    setDayModalIso(raw)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  function goPrevMonth() {
    setCursor(({ y, m }) => {
      if (m === 0) return { y: y - 1, m: 11 }
      return { y, m: m - 1 }
    })
  }

  function goNextMonth() {
    setCursor(({ y, m }) => {
      if (m === 11) return { y: y + 1, m: 0 }
      return { y, m: m + 1 }
    })
  }

  function goThisMonth() {
    const n = new Date()
    setCursor({ y: n.getFullYear(), m: n.getMonth() })
  }

  function openAddForm(iso?: string) {
    setFormInitial(null)
    setFormDefaultDate(iso ?? selectedIso ?? todayIso())
    setFormOpen(true)
  }

  function handleFormSubmit(payload: {
    id?: string
    type: 'income' | 'expense'
    amount: number
    date: string
    category?: string
    memo?: string
    paymentMethod?: PaymentMethod
    cardBrand?: string
    memberName?: string
  }) {
    const common = {
      type: payload.type,
      amount: payload.amount,
      date: payload.date,
      category: payload.category,
      memo: payload.memo,
      memberName: payload.memberName,
    }
    const pay =
      payload.type === 'expense'
        ? {
            paymentMethod: payload.paymentMethod ?? 'cash',
            cardBrand:
              payload.paymentMethod === 'card' && payload.cardBrand
                ? payload.cardBrand
                : undefined,
          }
        : {
            paymentMethod: undefined,
            cardBrand: undefined,
          }

    if (payload.id) {
      update(payload.id, { ...common, ...pay })
    } else {
      add({ ...common, ...pay })
    }
  }

  return (
    <>
      {showHouseholdSetup && <HouseholdSetupModal />}
      <div className="min-h-dvh bg-neutral-warm pb-28">
      {syncState.mode === 'cloud' && syncState.status === 'loading' ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-surface-raised/75 backdrop-blur-[1px]"
          aria-busy
          aria-live="polite"
        >
          <p className="rounded-[var(--radius-card)] border border-border-subtle bg-surface-raised px-5 py-4 text-sm text-text-primary shadow-[var(--shadow-card)]">
            서버와 동기화하는 중…
          </p>
        </div>
      ) : null}
      <header className="relative z-10 border-b border-border-subtle bg-gradient-to-r from-surface-raised via-ceramic/30 to-surface-raised">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 md:h-[4.5rem] md:px-6 lg:h-[5.2rem]">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="truncate text-xl font-bold tracking-tight text-starbucks-green">
              가계부
            </p>
            <NavLink
              to="/input"
              className={({ isActive }) =>
                uiTheme === 'theme3'
                  ? `shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors active:scale-[0.98] md:px-3 md:py-1.5 md:text-sm ${
                      isActive
                        ? 'border-green-accent bg-green-accent text-on-accent'
                        : 'border-border-strong bg-surface-raised text-midnight-ink hover:bg-neutral-cool'
                    }`
                  : `shrink-0 rounded-full border border-green-accent px-2.5 py-1 text-xs font-semibold transition-colors active:scale-[0.98] theme2:rounded-md md:px-3 md:py-1.5 md:text-sm ${
                      isActive
                        ? 'bg-green-accent text-on-accent theme2:border-charcoal-border theme2:shadow-[var(--shadow-frap-base)]'
                        : 'text-green-accent hover:bg-green-light/60 theme2:hover:bg-green-light/70'
                    }`
              }
            >
              PC입력
            </NavLink>
            {syncState.mode === 'cloud' ? (
              <span
                title={
                  syncState.status === 'error' && syncState.errorMessage
                    ? syncState.errorMessage
                    : syncState.status === 'loading'
                      ? '서버에서 데이터를 불러오는 중입니다.'
                      : syncState.cloudBackend === 'prisma'
                        ? '로컬 SQLite API와 연결되어 있어요. 같은 API를 쓰는 브라우저와 장부를 맞출 수 있어요.'
                        : '내 계정(Supabase)에 저장됩니다. 어떤 기기에서 로그인해도 같은 장부를 볼 수 있어요.'
                }
                className={
                  syncState.status === 'error'
                    ? 'shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 md:text-xs'
                    : syncState.status === 'loading'
                      ? 'shrink-0 rounded-full bg-neutral-cool px-2 py-0.5 text-[11px] font-medium text-text-soft md:text-xs'
                      : 'shrink-0 rounded-full bg-starbucks-green/15 px-2 py-0.5 text-[11px] font-medium text-starbucks-green md:text-xs'
                }
              >
                {syncState.status === 'error'
                  ? '동기화 오류'
                  : syncState.status === 'loading'
                    ? '연결 중…'
                    : '공유됨'}
              </span>
            ) : null}
          </div>
          {householdCode && (
            <div ref={settingsWrapRef} className="relative flex items-center gap-2">
              <Button
                variant="darkOutlined"
                className="!py-2 !text-sm"
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
              >
                공유코드
              </Button>
              {settingsOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-border-subtle bg-surface-raised p-4 shadow-[var(--shadow-card)]">
                  <p className="text-sm font-semibold text-starbucks-green">가족 공유코드</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                    같은 가구에 속한 사람끼리 장부·일정을 함께 보는 6자리 코드예요. 로그인한
                    계정마다 따로 저장되는 것이 아니라, 이 코드로 한 가구를 묶습니다.
                  </p>
                  <ul className="mt-2.5 space-y-1 text-xs leading-relaxed text-text-secondary">
                    <li className="flex gap-1.5">
                      <span className="shrink-0 text-green-accent" aria-hidden>
                        ·
                      </span>
                      <span>가계부 수입·지출 내역 (실시간 동기화)</span>
                    </li>
                    <li className="flex gap-1.5">
                      <span className="shrink-0 text-green-accent" aria-hidden>
                        ·
                      </span>
                      <span>가족 구성원 목록·필터</span>
                    </li>
                    <li className="flex gap-1.5">
                      <span className="shrink-0 text-green-accent" aria-hidden>
                        ·
                      </span>
                      <span>캘린더 일정·메모·D-day</span>
                    </li>
                  </ul>
                  <p className="mt-2.5 text-xs leading-relaxed text-text-soft">
                    <span className="font-medium text-text-secondary">가족이 참여하는 방법</span>
                    <br />
                    1. 가계부 앱에 로그인
                    <br />
                    2. 처음이면 「코드로 참여」에서 아래 코드 입력
                    <br />
                    3. 참여 후 같은 장부·캘린더가 보여요
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="flex-1 rounded-lg bg-emerald-50 px-3 py-2.5 text-center text-base font-bold tracking-[0.25em] text-emerald-700">
                      {householdCode}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-border-subtle px-3 py-2.5 text-xs font-medium text-text-secondary hover:bg-neutral-cool"
                      onClick={() => {
                        void navigator.clipboard.writeText(householdCode)
                        alert('공유코드를 복사했어요. 카톡 등으로 가족에게 보내 주세요.')
                      }}
                    >
                      복사
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-text-soft">
                    코드는 가족에게만 알려 주세요. 본인만 다른 가구에 참여하려면 로그아웃 후 다시
                    「코드로 참여」를 선택하면 됩니다.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-8">

        {/* 가족 구성원 관리 + 필터 */}
        <section aria-label="가족 구성원">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle/60 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <LedgerSectionTitle title="가족 구성원" />
                {cloudMembers.length > 0 ? (
                  <Button
                    type="button"
                    variant="outlined"
                    className="!inline-flex !items-center !gap-1.5 !rounded-full !px-3 !py-1 !text-xs"
                    onClick={() => setMemberManageOpen(true)}
                  >
                    <BulkRowManageIcon className="size-3.5" />
                    관리
                  </Button>
                ) : null}
              </div>
              <form
                className="flex gap-2 rounded-2xl border border-border-subtle/70 bg-ceramic/40 p-1.5 shadow-sm"
                onSubmit={(e) => {
                  e.preventDefault()
                  const trimmed = newMemberName.trim()
                  if (!trimmed) return
                  if (cloudMembers.includes(trimmed)) return
                  setCloudMembers((prev) =>
                    prev.includes(trimmed) ? prev : [...prev, trimmed],
                  )
                  setNewMemberName('')
                }}
              >
                <input
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="이름 입력"
                  maxLength={20}
                  className="w-28 rounded-full border border-input-border px-3 py-1 text-sm outline-none focus:border-green-accent"
                />
                <Button type="submit" variant="outlined" className="!rounded-full !px-3 !py-1 !text-sm">
                  추가
                </Button>
              </form>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedMember === null
                    ? 'border-starbucks-green/40 bg-starbucks-green/10 text-starbucks-green ring-1 ring-starbucks-green/25'
                    : 'border-border-pill bg-surface-raised text-text-soft hover:bg-neutral-cool/60'
                }`}
              >
                전체
              </button>
              {cloudMembers.map((m) => {
                const active = selectedMember === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMember(active ? null : m)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'border-starbucks-green/40 bg-starbucks-green/10 text-starbucks-green ring-1 ring-starbucks-green/25'
                        : 'border-border-pill bg-surface-raised text-text-primary hover:bg-neutral-cool/60'
                    }`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold-lightest/80 to-transparent px-3 py-3 md:px-4 md:py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                {cursor.y}년 누적 · 전체{' '}
                <span className="font-semibold tabular-nums text-text-secondary">
                  {yearTxCount}건
                </span>
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="min-w-0 rounded-lg border border-border-muted bg-surface-raised px-2 py-2 sm:px-3 sm:py-2.5">
                  <p className="text-[0.65rem] font-medium text-text-soft sm:text-xs">
                    연 수입
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold tabular-nums text-semantic-income sm:text-base md:text-lg">
                    {fmtKrw.format(yearIncomeTotal)}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-border-muted bg-surface-raised px-2 py-2 sm:px-3 sm:py-2.5">
                  <p className="text-[0.65rem] font-medium text-text-soft sm:text-xs">
                    연 지출
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold tabular-nums text-semantic-expense sm:text-base md:text-lg">
                    {fmtKrw.format(yearExpenseTotal)}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-border-muted bg-surface-raised px-2 py-2 sm:px-3 sm:py-2.5">
                  <p className="text-[0.65rem] font-medium text-text-soft sm:text-xs">
                    연 순액
                  </p>
                  <p
                    className={`mt-1 truncate text-sm font-semibold tabular-nums sm:text-base md:text-lg ${
                      yearIncomeTotal - yearExpenseTotal >= 0
                        ? 'text-semantic-income'
                        : 'text-semantic-expense'
                    }`}
                  >
                    {fmtKrw.format(yearIncomeTotal - yearExpenseTotal)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* 구성원 관리 모달 — 순서·삭제 */}
        {memberManageOpen ? (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onClick={() => setMemberManageOpen(false)}
          >
            <div
              role="dialog"
              aria-modal
              aria-labelledby="member-manage-title"
              className="flex max-h-[min(85dvh,24rem)] w-full max-w-sm flex-col rounded-[var(--radius-card)] bg-surface-raised shadow-[var(--shadow-card)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-border-muted px-5 py-4">
                <h3
                  id="member-manage-title"
                  className="text-base font-semibold text-starbucks-green"
                >
                  구성원 관리
                </h3>
                <p className="mt-1 text-xs text-text-soft">
                  위·아래로 순서를 바꿀 수 있습니다. 삭제는 목록에서 이름을
                  지웁니다.
                </p>
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-border-subtle/80 overflow-y-auto px-3 py-2">
                {cloudMembers.map((m, index) => (
                  <li
                    key={m}
                    className="flex items-center gap-1.5 py-2.5 first:pt-1"
                  >
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`${m} 위로`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-xs font-semibold text-text-secondary outline-none transition-colors hover:bg-green-light/40 disabled:opacity-35"
                        onClick={() => moveMember(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === cloudMembers.length - 1}
                        aria-label={`${m} 아래로`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-xs font-semibold text-text-secondary outline-none transition-colors hover:bg-green-light/40 disabled:opacity-35"
                        onClick={() => moveMember(index, 1)}
                      >
                        ↓
                      </button>
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                      {m}
                    </span>
                    <Button
                      type="button"
                      variant="darkOutlined"
                      className="!shrink-0 !rounded-full !border-danger !px-3 !py-1 !text-xs !text-danger"
                      onClick={() => {
                        setMemberManageOpen(false)
                        setDeleteConfirm({ member: m, step: 1 })
                      }}
                    >
                      삭제
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border-muted p-4">
                <Button
                  type="button"
                  variant="outlined"
                  className="w-full"
                  onClick={() => setMemberManageOpen(false)}
                >
                  닫기
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* 구성원 삭제 확인 모달 */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="w-72 rounded-[var(--radius-card)] bg-surface-raised p-6 shadow-[var(--shadow-card)]"
              onClick={(e) => e.stopPropagation()}
            >
              {deleteConfirm.step === 1 ? (
                <>
                  <p className="text-center text-base font-semibold text-text-primary">
                    「{deleteConfirm.member}」을(를)<br />삭제하시겠습니까?
                  </p>
                  <div className="mt-5 flex gap-3">
                    <Button type="button" variant="outlined" className="flex-1" onClick={() => setDeleteConfirm(null)}>아니오</Button>
                    <Button type="button" variant="primary" className="flex-1" onClick={() => setDeleteConfirm({ ...deleteConfirm, step: 2 })}>네</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-center text-base font-semibold text-danger">
                    정말 삭제하시겠습니까?
                  </p>
                  <p className="mt-1 text-center text-xs text-text-soft">
                    이 작업은 되돌릴 수 없습니다.
                  </p>
                  <div className="mt-5 flex gap-3">
                    <Button type="button" variant="outlined" className="flex-1" onClick={() => setDeleteConfirm(null)}>아니오</Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="flex-1 !bg-danger !border-danger"
                      onClick={() => {
                        setCloudMembers((prev) => prev.filter((m) => m !== deleteConfirm.member))
                        if (selectedMember === deleteConfirm.member) setSelectedMember(null)
                        setDeleteConfirm(null)
                      }}
                    >
                      네, 삭제
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <section aria-label="달력">
          <Card className="overflow-hidden">
            <LedgerSectionTitle title="달력" />
            <div className="mb-4 mt-4 flex flex-col gap-3 rounded-2xl border border-border-subtle/60 bg-gradient-to-r from-ceramic/70 via-surface-raised to-ceramic/40 p-2 shadow-[var(--shadow-frap-base)] md:flex-row md:items-center md:justify-between md:p-3">
              <div className="flex flex-1 items-center justify-between gap-1 md:justify-start md:gap-2">
                <Button
                  variant="outlined"
                  className="!min-h-11 !min-w-11 !rounded-xl !px-0"
                  aria-label="이전 달"
                  type="button"
                  onClick={goPrevMonth}
                >
                  ‹
                </Button>
                <p className="min-w-[10rem] flex-1 text-center text-base font-bold tracking-tight text-starbucks-green md:text-lg">
                  {formatMonthLabel(cursor.y, cursor.m)}
                </p>
                <Button
                  variant="outlined"
                  className="!min-h-11 !min-w-11 !rounded-xl !px-0"
                  aria-label="다음 달"
                  type="button"
                  onClick={goNextMonth}
                >
                  ›
                </Button>
              </div>
              <Button
                variant="outlined"
                type="button"
                className="w-full shrink-0 !rounded-xl md:w-auto"
                onClick={goThisMonth}
              >
                이번 달
              </Button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-card)] border border-border-muted border-l-4 border-l-green-light bg-surface-raised px-3 py-3 md:px-4 md:py-4">
                <p className="text-sm font-medium text-text-soft">수입</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-semantic-income md:text-2xl">
                  {fmtKrw.format(incomeTotal)}
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-border-muted border-l-4 border-l-[rgba(200,32,20,0.35)] bg-surface-raised px-3 py-3 ring-1 ring-inset ring-[#c82014]/10 md:px-4 md:py-4">
                <p className="text-sm font-medium text-text-soft">지출</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-semantic-expense md:text-2xl">
                  {fmtKrw.format(expenseTotal)}
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-border-muted border-l-4 border-l-starbucks-green bg-surface-raised px-3 py-3 md:px-4 md:py-4">
                <p className="text-sm font-medium text-text-soft">이달 순액</p>
                <p
                  className={`mt-1 text-xl font-semibold tabular-nums md:text-2xl ${
                    incomeTotal - expenseTotal >= 0
                      ? 'text-semantic-income'
                      : 'text-semantic-expense'
                  }`}
                >
                  {fmtKrw.format(incomeTotal - expenseTotal)}
                </p>
              </div>
            </div>

            <NoSpendChallengeBanner
              count={noSpendStats.count}
              eligibleDayCount={noSpendStats.eligibleDayCount}
              monthLabel={formatMonthLabel(cursor.y, cursor.m)}
              active={noSpendCelebrate}
              onToggleCelebrate={toggleNoSpendCelebrate}
            />

            <LedgerCalendar
              year={cursor.y}
              monthIndex={cursor.m}
              todayIso={todayIso()}
              selectedIso={selectedIso}
              rollups={rollups}
              noSpendDays={noSpendStats.noSpendDays}
              celebrateNoSpend={noSpendCelebrate}
              onSelectDay={onSelectDay}
              onHover={onCalendarHover}
            />
          </Card>
        </section>

        <section aria-label="거래·분류 상세">
          <Card>
            <LedgerDetailPanelHeader
              detailPanel={detailPanel}
              onSelect={setDetailPanel}
              onPrev={() => shiftDetailPanel(-1)}
              onNext={() => shiftDetailPanel(1)}
              prevLabel={`${LEDGER_DETAIL_PANELS[(detailPanelIndex - 1 + LEDGER_DETAIL_PANELS.length) % LEDGER_DETAIL_PANELS.length].label} 보기`}
              nextLabel={`${LEDGER_DETAIL_PANELS[(detailPanelIndex + 1) % LEDGER_DETAIL_PANELS.length].label} 보기`}
            />

            {detailPanel === 'transactions' ? (
              <>
            <div className="mt-5 flex justify-end">
              <div
                role="tablist"
                aria-label="거래 유형"
                className="inline-flex w-full max-w-md rounded-xl border border-border-subtle/60 bg-black/[0.03] p-1 sm:w-auto theme2:bg-neutral-cool/40"
              >
                {(
                  [
                    { id: 'all' as const, label: '전체' },
                    { id: 'income' as const, label: '수입' },
                    { id: 'expense' as const, label: '지출' },
                  ] as const
                ).map((tab) => {
                  const active = txListTab === tab.id
                  const tone =
                    tab.id === 'income'
                      ? active
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700/20'
                        : 'text-emerald-800/70 hover:bg-emerald-50'
                      : tab.id === 'expense'
                        ? active
                          ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-700/20'
                          : 'text-rose-800/70 hover:bg-rose-50'
                        : active
                          ? 'bg-starbucks-green text-white shadow-sm'
                          : 'text-text-soft hover:bg-surface-raised/70'
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${tone}`}
                      onClick={() => setTxListTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border border-emerald-200/50 bg-gradient-to-b from-emerald-50/80 to-transparent px-3 py-2.5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-900/55">
                  수입
                </p>
                <p className="mt-1 text-base font-semibold tabular-nums text-semantic-income sm:text-lg">
                  +{fmtKrw.format(incomeTotal)}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-text-soft">
                  {monthIncomeTransactions.length}건
                </p>
              </div>
              <div className="rounded-xl border border-rose-200/50 bg-gradient-to-b from-rose-50/70 to-transparent px-3 py-2.5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-rose-900/55">
                  지출
                </p>
                <p className="mt-1 text-base font-semibold tabular-nums text-semantic-expense sm:text-lg">
                  −{fmtKrw.format(expenseTotal)}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-text-soft">
                  {monthExpenseTransactions.length}건
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-ceramic/40 px-3 py-2.5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-text-soft">
                  순액
                </p>
                <p
                  className={`mt-1 text-base font-semibold tabular-nums sm:text-lg ${
                    monthNetTotal >= 0
                      ? 'text-semantic-income'
                      : 'text-semantic-expense'
                  }`}
                >
                  {monthNetTotal >= 0 ? '+' : '−'}
                  {fmtKrw.format(Math.abs(monthNetTotal))}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-text-soft">
                  {filtered.length}건
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle/80 pt-4 lg:flex-row lg:items-stretch lg:justify-between">
              {txListTab !== 'income' ? (
                <ExpensePayFilterBar
                  value={expensePayFilter}
                  cardBrandFilter={expenseCardBrandFilter}
                  cardRows={expensePaymentBreakdown.cardRows}
                  legacyCount={expensePaymentBreakdown.legacy}
                  selectedTotal={expenseFilteredTotal}
                  fmtKrw={fmtKrw}
                  onChange={(id) => {
                    setExpensePayFilter(id)
                    if (id !== 'card') setExpenseCardBrandFilter(null)
                  }}
                  onCardBrandChange={setExpenseCardBrandFilter}
                />
              ) : (
                <div className="flex-1" />
              )}
              <div className="flex shrink-0 items-center lg:pl-2">
                <SortToggleRow
                  value={txSort}
                  onToggleAmount={toggleTxAmount}
                  onToggleDate={toggleTxDate}
                />
              </div>
            </div>

            {displayedTransactions.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-soft">
                {txListTab === 'income' && monthIncomeTransactions.length === 0
                  ? '이번 달 수입 기록이 없습니다.'
                  : txListTab === 'expense' && expenseTotal === 0
                    ? '이번 달 지출 기록이 없습니다.'
                    : txListTab === 'expense'
                      ? '선택한 수단에 해당하는 지출이 없습니다.'
                      : filtered.length === 0
                        ? '이번 달 거래 기록이 없습니다.'
                        : '선택한 수단에 해당하는 거래가 없습니다.'}
              </p>
            ) : (
              <ul className="mt-1 divide-y divide-border-subtle/70">
                {displayedTransactions.map((t) => (
                  <TransactionLedgerRow
                    key={t.id}
                    t={t}
                    fmtKrw={fmtKrw}
                    onSelectDate={(iso) => {
                      setDayModalIso(iso)
                      setSelectedIso(iso)
                    }}
                  />
                ))}
              </ul>
            )}
              </>
            ) : (
              <div className="mt-5">
                <ExpenseCategoryBreakdown
                  expenses={monthExpenseTransactions}
                  fmtKrw={fmtKrw}
                />
              </div>
            )}
          </Card>
        </section>
      </main>
      </div>

      {createPortal(
        <>
          <CalendarHoverTooltip
            show={hover !== null}
            x={hover?.clientX ?? 0}
            y={hover?.clientY ?? 0}
            iso={hover?.iso ?? null}
            rollup={hover ? rollups.get(hover.iso) : undefined}
            fmt={fmtKrw}
          />

          <DayDetailModal
            open={dayModalIso !== null}
            iso={dayModalIso}
            transactions={dayModalTxs}
            fmt={fmtKrw}
            onClose={() => setDayModalIso(null)}
            onDelete={(id) => {
              if (dayModalTxs.length <= 1) setDayModalIso(null)
              remove(id)
            }}
            onEdit={(t) => {
              setDayModalIso(null)
              setFormInitial(t)
              setFormDefaultDate(t.date)
              setFormOpen(true)
            }}
            onAddForDay={() => {
              const d = dayModalIso
              setDayModalIso(null)
              if (d) openAddForm(d)
            }}
          />

          <TransactionFormModal
            open={formOpen}
            initial={formInitial}
            defaultDate={formDefaultDate}
            members={cloudMembers}
            onClose={() => {
              setFormOpen(false)
              setFormInitial(null)
            }}
            onSubmit={handleFormSubmit}
          />

          <Fab
            label="거래 추가"
            type="button"
            onClick={() => openAddForm()}
          />
        </>,
        document.body,
      )}
    </>
  )
}
