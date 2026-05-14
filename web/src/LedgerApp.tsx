import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './components/ui/Button'
import { addMember, removeMember } from './lib/memberStorage'
import { Card } from './components/ui/Card'
import { Fab } from './components/ui/Fab'
import { LedgerCalendar } from './components/LedgerCalendar'
import { CalendarHoverTooltip } from './components/CalendarHoverTooltip'
import { TransactionFormModal } from './components/TransactionFormModal'
import { DayDetailModal } from './components/DayDetailModal'
import { CardPaymentBreakdown } from './components/CardPaymentBreakdown'
import { ExpenseCategoryBreakdown } from './components/ExpenseCategoryBreakdown'
import { useLedger } from './hooks/useLedger'
import { rollupByDate } from './lib/dayTotals'
import { cardBrandLabel } from './constants/cardBrands'
import type { PaymentMethod, Transaction } from './types/transaction'
import HouseholdSetupModal from './components/HouseholdSetupModal'
import { getSupabase } from './lib/supabaseClient'
import { ledgerBackendMode } from './lib/ledgerBackend'

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
  const [incomeSort, setIncomeSort] = useState<SortOrder>('amount-desc')
  const [expenseSort, setExpenseSort] = useState<SortOrder>('amount-desc')
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [hover, setHover] = useState<{
    iso: string
    clientX: number
    clientY: number
  } | null>(null)
  const [dayModalIso, setDayModalIso] = useState<string | null>(null)
  const [expandedCardBrandId, setExpandedCardBrandId] = useState<string | null>(
    null,
  )
  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState<Transaction | null>(null)
  const [formDefaultDate, setFormDefaultDate] = useState<string | undefined>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsWrapRef = useRef<HTMLDivElement>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [newMemberName, setNewMemberName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ member: string; step: 1 | 2 } | null>(null)

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

  const resolvedExpandedCardBrandId = useMemo(() => {
    if (expandedCardBrandId === null) return null
    return expensePaymentBreakdown.cardRows.some(
      (r) => r.id === expandedCardBrandId,
    )
      ? expandedCardBrandId
      : null
  }, [expandedCardBrandId, expensePaymentBreakdown.cardRows])

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
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-[var(--radius-card)] border border-black/[0.08] bg-white p-3 shadow-[var(--shadow-card)]">
                  <p className="px-3 py-1 text-xs font-medium text-text-soft">가족 코드</p>
                  <div className="flex items-center gap-2 px-3 py-1">
                    <span className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-center text-base font-bold tracking-[0.25em] text-emerald-700">
                      {householdCode}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-black/[0.08] px-3 py-2 text-xs text-text-soft hover:bg-neutral-cool"
                      onClick={() => {
                        void navigator.clipboard.writeText(householdCode)
                        alert('코드를 복사했어요!')
                        setSettingsOpen(false)
                      }}
                    >
                      복사
                    </button>
                  </div>
                  <p className="px-3 pb-1 text-[11px] text-text-soft">
                    가족에게 이 코드를 공유하세요.
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
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="!m-0 !text-base font-semibold text-starbucks-green">가족 구성원</h2>
                <p className="mt-0.5 text-xs text-text-soft">이름을 클릭하면 해당 구성원만 필터. 우클릭하면 삭제.</p>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const trimmed = newMemberName.trim()
                  if (!trimmed) return
                  const next = addMember(trimmed)  // localStorage도 업데이트
                  setCloudMembers(next)             // Supabase에 저장
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

            {/* 구성원 탭 (필터) — 우클릭으로 삭제 */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${selectedMember === null ? 'border-starbucks-green bg-starbucks-green text-white' : 'border-black/20 text-text-soft hover:bg-neutral-cool'}`}
              >
                전체
              </button>
              {cloudMembers.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMember(selectedMember === m ? null : m)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setDeleteConfirm({ member: m, step: 1 })
                  }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${selectedMember === m ? 'border-starbucks-green bg-starbucks-green text-white' : 'border-black/20 text-[rgba(0,0,0,0.87)] hover:bg-neutral-cool'}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* 선택된 구성원의 이달 수입/지출 요약 */}
            {selectedMember !== null && (
              <div className="mt-4 rounded-[var(--radius-card)] border border-black/[0.06] bg-ceramic/60 p-4">
                <p className="mb-3 text-sm font-semibold text-[rgba(0,0,0,0.87)]">
                  {selectedMember} · {formatMonthLabel(cursor.y, cursor.m)} 요약
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white px-3 py-3">
                    <p className="text-xs text-text-soft">수입</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-semantic-income">
                      {fmtKrw.format(incomeTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-3">
                    <p className="text-xs text-text-soft">지출</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-semantic-expense">
                      {fmtKrw.format(expenseTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-3">
                    <p className="text-xs text-text-soft">순액</p>
                    <p className={`mt-1 text-base font-semibold tabular-nums ${incomeTotal - expenseTotal >= 0 ? 'text-semantic-income' : 'text-semantic-expense'}`}>
                      {fmtKrw.format(incomeTotal - expenseTotal)}
                    </p>
                  </div>
                </div>
                {incomeTotal === 0 && expenseTotal === 0 && (
                  <p className="mt-3 text-xs text-text-soft">
                    아직 이 달에 {selectedMember} 이름으로 기록된 거래가 없습니다.
                    거래 추가 시 구성원을 선택하면 여기서 확인할 수 있어요.
                  </p>
                )}
              </div>
            )}
          </Card>
        </section>

        {/* 구성원 삭제 확인 모달 */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="w-72 rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-card)]"
              onClick={(e) => e.stopPropagation()}
            >
              {deleteConfirm.step === 1 ? (
                <>
                  <p className="text-center text-base font-semibold text-[rgba(0,0,0,0.87)]">
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
                        const next = removeMember(deleteConfirm.member)  // localStorage 업데이트
                        setCloudMembers(next)                             // Supabase에 저장
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
          <Card>
            <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-card)] bg-ceramic/80 p-3 md:flex-row md:items-center md:justify-between md:p-4">
              <div className="flex flex-1 items-center justify-between gap-2 md:justify-start">
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
                className="w-full shrink-0 md:w-auto"
                onClick={goThisMonth}
              >
                이번 달
              </Button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-card)] border border-black/[0.06] border-l-4 border-l-green-light bg-white px-3 py-3 md:px-4 md:py-4">
                <p className="text-sm font-medium text-text-soft">수입</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-semantic-income md:text-2xl">
                  {fmtKrw.format(incomeTotal)}
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-black/[0.06] border-l-4 border-l-[rgba(200,32,20,0.35)] bg-white px-3 py-3 ring-1 ring-inset ring-[#c82014]/10 md:px-4 md:py-4">
                <p className="text-sm font-medium text-text-soft">지출</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-semantic-expense md:text-2xl">
                  {fmtKrw.format(expenseTotal)}
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-black/[0.06] border-l-4 border-l-starbucks-green bg-white px-3 py-3 md:px-4 md:py-4">
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
              onSelectDay={onSelectDay}
              onHover={onCalendarHover}
            />
          </Card>
        </section>

        <section
          id="ledger-card-payment-breakdown"
          aria-label="이달 지불 수단별 지출"
        >
          <Card>
            <h2 className="!m-0 !text-lg font-semibold text-starbucks-green">
              이번 달 · 지불 수단·카드사별 지출
            </h2>
            <p className="mt-1 text-sm text-text-soft">
              지출만 집계합니다. 카드사 줄을 누르면 이번 달·연간·상세 거래 목록이
              아래로 펼쳐져요.
            </p>
            {expenseTotal === 0 ? (
              <p className="mt-6 py-4 text-center text-sm text-text-soft">
                이번 달 지출 기록이 없습니다.
              </p>
            ) : (
              <CardPaymentBreakdown
                cash={expensePaymentBreakdown.cash}
                legacy={expensePaymentBreakdown.legacy}
                cardRows={expensePaymentBreakdown.cardRows}
                transactions={transactions}
                year={cursor.y}
                monthIndex={cursor.m}
                fmt={fmtKrw}
                onPickDay={(iso) => {
                  setDayModalIso(iso)
                  setSelectedIso(iso)
                }}
                expandedBrandId={resolvedExpandedCardBrandId}
                onExpandedBrandIdChange={setExpandedCardBrandId}
              />
            )}
          </Card>
        </section>

        <section aria-label="이번 달 분류별 지출">
          <Card>
            <h2 className="!m-0 !text-lg font-semibold text-starbucks-green">
              이번 달 · 분류별 지출
            </h2>
            <p className="mt-1 text-sm text-text-soft">
              등록 시 고른 분류 기준입니다. 분류를 누르면 해당 분류의 거래 목록과
              합계·이번 달 전체 지출 대비 비율이 펼쳐져 보여요.
            </p>
            <ExpenseCategoryBreakdown
              expenses={monthExpenseTransactions}
              fmtKrw={fmtKrw}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedCardBrandId(t.cardBrand!)
                            requestAnimationFrame(() => {
                              document
                                .getElementById('ledger-card-payment-breakdown')
                                ?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'nearest',
                                })
                            })
                          }}
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

        <footer className="border-t border-white/10 bg-house-green px-4 py-6 text-text-on-dark-soft md:px-6 lg:rounded-[var(--radius-card)] lg:shadow-[var(--shadow-card)]">
          <p className="text-center text-sm text-text-on-dark-soft/80">
            {syncState.mode === 'cloud'
              ? syncState.cloudBackend === 'prisma'
                ? '가계부 · 로컬 SQLite(Prisma)에 저장됩니다. API를 같이 띄운 기기·브라우저와 맞출 수 있어요.'
                : '가계부 · Supabase에 저장되어 같은 사이트 주소로 들어오면 함께 볼 수 있어요.'
              : (syncState as { hint?: string }).hint === 'login_required'
                ? '가계부 · 지금은 이 기기에만 저장됩니다. 로그인하면 Supabase에 저장되어 어떤 기기에서든 볼 수 있어요.'
                : '가계부 · 이 기기(localStorage)에만 저장됩니다. 같이 쓰려면 .env에서 Prisma API 또는 Supabase를 설정하고 배포하세요.'}
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
