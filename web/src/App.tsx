import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { Fab } from './components/ui/Fab'
import { LedgerCalendar } from './components/LedgerCalendar'
import { CalendarHoverTooltip } from './components/CalendarHoverTooltip'
import { TransactionFormModal } from './components/TransactionFormModal'
import { DayDetailModal } from './components/DayDetailModal'
import { CardSpendModal } from './components/CardSpendModal'
import { useLedger } from './hooks/useLedger'
import { parseLedgerCsv } from './lib/importCsv'
import { rollupByDate } from './lib/dayTotals'
import { cardBrandLabel } from './constants/cardBrands'
import type { PaymentMethod, Transaction } from './types/transaction'

type SortOrder = 'amount-desc' | 'amount-asc'

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

function SortPair({
  value,
  onChange,
  label,
}: {
  value: SortOrder
  onChange: (v: SortOrder) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-text-soft">{label}</span>
      <Button
        type="button"
        variant={value === 'amount-desc' ? 'primary' : 'outlined'}
        className="!px-3 !py-1 !text-xs"
        onClick={() => onChange('amount-desc')}
      >
        금액 높은순
      </Button>
      <Button
        type="button"
        variant={value === 'amount-asc' ? 'primary' : 'outlined'}
        className="!px-3 !py-1 !text-xs"
        onClick={() => onChange('amount-asc')}
      >
        금액 낮은순
      </Button>
    </div>
  )
}

export default function App() {
  const {
    transactions,
    add,
    bulkAdd,
    update,
    remove,
    replaceAll,
    clear,
    syncState,
  } = useLedger()
  const now = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState({
    y: now.getFullYear(),
    m: now.getMonth(),
  })
  const [incomeSort, setIncomeSort] = useState<SortOrder>('amount-desc')
  const [expenseSort, setExpenseSort] = useState<SortOrder>('amount-desc')
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [hover, setHover] = useState<{
    iso: string
    clientX: number
    clientY: number
  } | null>(null)
  const [dayModalIso, setDayModalIso] = useState<string | null>(null)
  const [cardSpendBrandId, setCardSpendBrandId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState<Transaction | null>(null)
  const [formDefaultDate, setFormDefaultDate] = useState<string | undefined>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const settingsWrapRef = useRef<HTMLDivElement>(null)

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

  const fmtKrwCompact = useMemo(
    () =>
      new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
        notation: 'compact',
        compactDisplay: 'short',
      }),
    [],
  )

  const rollups = useMemo(() => rollupByDate(transactions), [transactions])

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
      transactions.filter((t) => isInMonth(t.date, cursor.y, cursor.m)),
    [transactions, cursor.y, cursor.m],
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

  const incomesSorted = useMemo(() => {
    const list = filtered.filter((t) => t.type === 'income')
    list.sort((a, b) =>
      incomeSort === 'amount-desc'
        ? b.amount - a.amount
        : a.amount - b.amount,
    )
    return list
  }, [filtered, incomeSort])

  const expensesSorted = useMemo(() => {
    const list = filtered.filter((t) => t.type === 'expense')
    list.sort((a, b) =>
      expenseSort === 'amount-desc'
        ? b.amount - a.amount
        : a.amount - b.amount,
    )
    return list
  }, [filtered, expenseSort])

  const expensePaymentBreakdown = useMemo(() => {
    let cash = 0
    let legacy = 0
    const cardMap = new Map<string, number>()
    for (const t of filtered) {
      if (t.type !== 'expense') continue
      if (t.paymentMethod === 'cash') cash += t.amount
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
    return { cash, legacy, cardRows }
  }, [filtered])

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
  }) {
    const common = {
      type: payload.type,
      amount: payload.amount,
      date: payload.date,
      category: payload.category,
      memo: payload.memo,
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

  function exportData() {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `가계부-백업-${todayIso()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importBundled2024Sample = useCallback(async () => {
    if (
      !confirm(
        '2024년 1~3월 캡처에 나온 금액(5건)을 지금 기록에 이어 붙일까요?\n이미 넣었다면 중복될 수 있어요.',
      )
    ) {
      return
    }
    try {
      const url = `${import.meta.env.BASE_URL}seed-2024-jan-mar.csv`
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      const text = await res.text()
      const r = parseLedgerCsv(text)
      if (!r.ok) {
        alert(r.message)
        return
      }
      bulkAdd(r.rows)
      alert(`${r.rows.length}건을 추가했어요. 달력에서 2024년 1~3월로 이동해 보세요.`)
      setSettingsOpen(false)
      setCursor({ y: 2024, m: 2 })
    } catch {
      alert('샘플 파일을 불러오지 못했어요. 개발 서버나 빌드된 앱에서 다시 시도해 주세요.')
    }
  }, [bulkAdd])

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result)
      const name = file.name.toLowerCase()
      const looksCsv = name.endsWith('.csv') || file.type === 'text/csv'

      if (looksCsv) {
        const r = parseLedgerCsv(text)
        if (!r.ok) {
          alert(r.message)
        } else {
          bulkAdd(r.rows)
          alert(`${r.rows.length}건을 기존 기록에 추가했어요.`)
          setSettingsOpen(false)
        }
        e.target.value = ''
        return
      }

      try {
        const data = JSON.parse(text) as unknown
        if (!Array.isArray(data)) throw new Error('invalid')
        replaceAll(data as Transaction[])
        alert('백업 데이터로 교체했어요.')
        setSettingsOpen(false)
      } catch {
        alert('JSON 배열 형식이 아니에요. 엑셀은 CSV로 저장해 가져오기 하세요.')
      }
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <>
      <div className="min-h-dvh bg-neutral-warm pb-28">
      {syncState.mode === 'cloud' && syncState.status === 'loading' ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-white/75 backdrop-blur-[1px]"
          aria-busy
          aria-live="polite"
        >
          <p className="rounded-[var(--radius-card)] border border-black/[0.08] bg-white px-5 py-4 text-sm text-[rgba(0,0,0,0.87)] shadow-[var(--shadow-card)]">
            서버와 동기화하는 중…
          </p>
        </div>
      ) : null}
      <header className="relative z-10 border-b border-black/[0.08] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 md:h-[4.5rem] md:px-6 lg:h-[5.2rem]">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="truncate text-lg font-semibold tracking-[-0.16px] text-starbucks-green md:text-xl">
              가계부
            </p>
            {syncState.mode === 'cloud' ? (
              <span
                title={
                  syncState.status === 'error' && syncState.errorMessage
                    ? syncState.errorMessage
                    : syncState.status === 'loading'
                      ? '서버에서 데이터를 불러오는 중입니다.'
                      : 'Supabase와 연결되어 있어요. 같은 주소로 들어온 기기와 공유됩니다.'
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
          <div ref={settingsWrapRef} className="relative flex items-center gap-2">
            <Button
              variant="darkOutlined"
              className="!py-2 !text-sm"
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              데이터
            </Button>
            {settingsOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-[var(--radius-card)] border border-black/[0.08] bg-white p-3 shadow-[var(--shadow-card)]">
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[rgba(0,0,0,0.87)] hover:bg-neutral-cool"
                  onClick={() => {
                    exportData()
                    setSettingsOpen(false)
                  }}
                >
                  내보내기 (JSON)
                </button>
                <button
                  type="button"
                  title="JSON: 백업 전체 복구(데이터 교체). CSV: 엑셀에서 만든 목록을 이어 붙임."
                  className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-[rgba(0,0,0,0.87)] hover:bg-neutral-cool"
                  onClick={() => importRef.current?.click()}
                >
                  가져오기 (JSON·CSV)
                </button>
                <button
                  type="button"
                  className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-[rgba(0,0,0,0.87)] hover:bg-neutral-cool"
                  onClick={() => void importBundled2024Sample()}
                >
                  2024년 1~3월 샘플 반영
                </button>
                <p className="mt-1 px-1 text-[11px] leading-snug text-text-soft">
                  CSV: 날짜·금액만 있어도 됩니다(그날 지출). 카드사 열 있으면 카드로
                  반영. JSON은 전체 교체.
                </p>
                <button
                  type="button"
                  className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-neutral-cool"
                  onClick={() => {
                    if (confirm('모든 기록을 지울까요? 이 작업은 되돌릴 수 없습니다.')) {
                      clear()
                      setSettingsOpen(false)
                    }
                  }}
                >
                  전체 삭제
                </button>
              </div>
            ) : null}
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json,text/csv,.csv"
              className="hidden"
              onChange={onImportFile}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-8">
        <section aria-label="월 선택">
          <Card className="flex flex-col gap-3 bg-ceramic/80 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between gap-2 md:justify-start">
              <Button
                variant="outlined"
                className="!min-h-11 min-w-11 !px-3"
                aria-label="이전 달"
                type="button"
                onClick={goPrevMonth}
              >
                ‹
              </Button>
              <p className="min-w-[10rem] flex-1 text-center text-base font-semibold text-[rgba(0,0,0,0.87)] md:text-lg">
                {formatMonthLabel(cursor.y, cursor.m)}
              </p>
              <Button
                variant="outlined"
                className="!min-h-11 min-w-11 !px-3"
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
              className="w-full md:w-auto"
              onClick={goThisMonth}
            >
              이번 달
            </Button>
          </Card>
        </section>

        <section
          className="grid gap-4 md:grid-cols-3"
          aria-label="요약"
        >
          <Card className="border-l-4 border-l-green-light bg-white">
            <p className="text-sm font-medium text-text-soft">수입</p>
            <p className="mt-2 text-2xl font-semibold text-semantic-income">
              {fmtKrw.format(incomeTotal)}
            </p>
          </Card>
          <Card className="border-l-4 border-l-[rgba(200,32,20,0.35)] bg-white ring-1 ring-inset ring-[#c82014]/10">
            <p className="text-sm font-medium text-text-soft">지출</p>
            <p className="mt-2 text-2xl font-semibold text-semantic-expense">
              {fmtKrw.format(expenseTotal)}
            </p>
          </Card>
          <Card className="border-l-4 border-l-starbucks-green bg-white">
            <p className="text-sm font-medium text-text-soft">이달 순액</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                incomeTotal - expenseTotal >= 0
                  ? 'text-semantic-income'
                  : 'text-semantic-expense'
              }`}
            >
              {fmtKrw.format(incomeTotal - expenseTotal)}
            </p>
          </Card>
        </section>

        <section aria-label="이달 지불 수단별 지출">
          <Card>
            <h2 className="!m-0 !text-lg font-semibold text-starbucks-green">
              이번 달 · 지불 수단·카드사별 지출
            </h2>
            <p className="mt-1 text-sm text-text-soft">
              지출만 집계합니다. 카드로 기록하면 카드사별로 한 달 합계를 볼 수
              있어요.
            </p>
            {expenseTotal === 0 ? (
              <p className="mt-6 py-4 text-center text-sm text-text-soft">
                이번 달 지출 기록이 없습니다.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-black/[0.06]">
                <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <span className="text-sm font-medium text-[rgba(0,0,0,0.87)]">
                    현금
                  </span>
                  <span className="text-base font-semibold tabular-nums text-semantic-expense">
                    {fmtKrw.format(expensePaymentBreakdown.cash)}
                  </span>
                </li>
                {expensePaymentBreakdown.cardRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-neutral-cool/40"
                      onClick={() => setCardSpendBrandId(row.id)}
                    >
                      <span className="text-sm font-medium text-starbucks-green underline decoration-starbucks-green/25 underline-offset-2">
                        {row.label}
                      </span>
                      <span className="text-base font-semibold tabular-nums text-semantic-expense">
                        {fmtKrw.format(row.sum)}
                      </span>
                    </button>
                  </li>
                ))}
                {expensePaymentBreakdown.legacy > 0 ? (
                  <li className="flex items-center justify-between gap-3 py-3">
                    <span className="text-sm text-text-soft">
                      미입력 · 과거 기록 등
                    </span>
                    <span className="text-base font-semibold tabular-nums text-semantic-expense">
                      {fmtKrw.format(expensePaymentBreakdown.legacy)}
                    </span>
                  </li>
                ) : null}
              </ul>
            )}
          </Card>
        </section>

        <section aria-label="연간 합계">
          <Card className="border border-gold/25 bg-gold-lightest/50">
            <h2 className="!m-0 !text-lg font-semibold text-starbucks-green">
              {cursor.y}년 누적 합계
            </h2>
            <p className="mt-1 text-sm text-text-soft">
              위에서 고른 달이 속한 연도(1~12월) 기준이에요. 총{' '}
              <span className="font-medium text-[rgba(0,0,0,0.87)]">
                {yearTxCount}건
              </span>
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-[var(--radius-card)] border border-black/[0.06] bg-white px-4 py-4">
                <p className="text-sm font-medium text-text-soft">연 수입</p>
                <p className="mt-2 text-xl font-semibold text-semantic-income md:text-2xl">
                  {fmtKrw.format(yearIncomeTotal)}
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-black/[0.06] bg-white px-4 py-4">
                <p className="text-sm font-medium text-text-soft">연 지출</p>
                <p className="mt-2 text-xl font-semibold text-semantic-expense md:text-2xl">
                  {fmtKrw.format(yearExpenseTotal)}
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-black/[0.08] bg-white px-4 py-4">
                <p className="text-sm font-medium text-text-soft">연 순액</p>
                <p
                  className={`mt-2 text-xl font-semibold md:text-2xl ${
                    yearIncomeTotal - yearExpenseTotal >= 0
                      ? 'text-semantic-income'
                      : 'text-semantic-expense'
                  }`}
                >
                  {fmtKrw.format(yearIncomeTotal - yearExpenseTotal)}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section aria-label="달력">
          <Card>
            <h2 className="!m-0 !mb-3 !text-lg font-semibold text-starbucks-green">
              달력 · 공휴일
            </h2>
            <p className="mb-4 text-sm text-text-soft">
              날짜에 마우스를 올리면 요약이 보이고, 클릭하면 상세 내역을 볼 수
              있어요.
            </p>
            <LedgerCalendar
              year={cursor.y}
              monthIndex={cursor.m}
              todayIso={todayIso()}
              selectedIso={selectedIso}
              rollups={rollups}
              fmtCompact={fmtKrwCompact}
              onSelectDay={onSelectDay}
              onHover={onCalendarHover}
            />
          </Card>
        </section>

        <section
          className="grid gap-4 lg:grid-cols-2"
          aria-label="월별 내역"
        >
          <Card>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="!m-0 !text-lg font-semibold text-starbucks-green">
                  수입 내역
                </h2>
                <p className="mt-1 text-sm text-text-soft">
                  {incomesSorted.length}건 · 합계{' '}
                  {fmtKrw.format(incomeTotal)}
                </p>
              </div>
              <SortPair
                label="정렬"
                value={incomeSort}
                onChange={setIncomeSort}
              />
            </div>
            {incomesSorted.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-soft">
                이번 달 수입 기록이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {incomesSorted.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-neutral-cool/50"
                      onClick={() => {
                        setDayModalIso(t.date)
                        setSelectedIso(t.date)
                      }}
                    >
                      <span className="min-w-0">
                        <span className="text-sm text-text-soft">
                          {t.date}
                          {t.category ? ` · ${t.category}` : ''}
                        </span>
                        {t.memo ? (
                          <span className="mt-0.5 block truncate text-sm text-[rgba(0,0,0,0.87)]">
                            {t.memo}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-semibold text-semantic-income">
                        +{fmtKrw.format(t.amount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="!m-0 !text-lg font-semibold text-starbucks-green">
                  지출 내역
                </h2>
                <p className="mt-1 text-sm text-text-soft">
                  {expensesSorted.length}건 · 합계{' '}
                  {fmtKrw.format(expenseTotal)}
                </p>
              </div>
              <SortPair
                label="정렬"
                value={expenseSort}
                onChange={setExpenseSort}
              />
            </div>
            {expensesSorted.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-soft">
                이번 달 지출 기록이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {expensesSorted.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-lg py-1 text-left transition-colors hover:bg-neutral-cool/50"
                      onClick={() => {
                        setDayModalIso(t.date)
                        setSelectedIso(t.date)
                      }}
                    >
                      <span className="block text-sm text-text-soft">
                        {t.date}
                        {t.category ? ` · ${t.category}` : ''}
                      </span>
                      {t.memo ? (
                        <span className="mt-0.5 block truncate text-sm text-[rgba(0,0,0,0.87)]">
                          {t.memo}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1 self-center">
                      {t.paymentMethod === 'card' && t.cardBrand ? (
                        <button
                          type="button"
                          className="max-w-[7.5rem] truncate text-xs font-medium text-starbucks-green underline decoration-starbucks-green/25 underline-offset-2 hover:opacity-80"
                          onClick={() => setCardSpendBrandId(t.cardBrand!)}
                        >
                          {cardBrandLabel(t.cardBrand) ?? '카드'}
                        </button>
                      ) : (
                        <span className="text-xs text-text-soft">
                          {t.paymentMethod === 'cash'
                            ? '현금'
                            : t.paymentMethod === 'card'
                              ? '카드'
                              : '미입력'}
                        </span>
                      )}
                      <span className="font-semibold tabular-nums text-semantic-expense">
                        −{fmtKrw.format(t.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <footer className="border-t border-white/10 bg-house-green px-4 py-6 text-text-on-dark-soft md:px-6 lg:rounded-[var(--radius-card)] lg:shadow-[var(--shadow-card)]">
          <p className="text-center text-sm text-text-on-dark-soft/80">
            {syncState.mode === 'cloud'
              ? '가계부 · Supabase에 저장되어 같은 사이트 주소로 들어오면 함께 볼 수 있어요. 백업은「데이터」메뉴도 활용하세요.'
              : '가계부 · 이 기기(localStorage)에만 저장됩니다. 같이 쓰려면 .env에 Supabase를 설정하고 배포하세요.'}
          </p>
        </footer>
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

          <CardSpendModal
            open={cardSpendBrandId !== null}
            cardBrandId={cardSpendBrandId}
            year={cursor.y}
            monthIndex={cursor.m}
            transactions={transactions}
            fmt={fmtKrw}
            onClose={() => setCardSpendBrandId(null)}
            onPickDay={(iso) => {
              setCardSpendBrandId(null)
              setDayModalIso(iso)
              setSelectedIso(iso)
            }}
          />

          <TransactionFormModal
            open={formOpen}
            initial={formInitial}
            defaultDate={formDefaultDate}
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
