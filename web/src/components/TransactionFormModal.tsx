import { useEffect, useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { CARD_BRANDS } from '../constants/cardBrands'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../constants/categories'
import type { PaymentMethod, Transaction } from '../types/transaction'

function todayIso() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export interface TransactionFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    id?: string
    type: 'income' | 'expense'
    amount: number
    date: string
    category?: string
    memo?: string
    paymentMethod?: PaymentMethod
    cardBrand?: string
    memberName?: string
  }) => void
  initial?: Transaction | null
  defaultDate?: string
  members?: string[]
}

export function TransactionFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  defaultDate,
  members = [],
}: TransactionFormModalProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [category, setCategory] = useState('')
  const [memo, setMemo] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [cardBrand, setCardBrand] = useState('')
  const [memberName, setMemberName] = useState('')

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      if (initial) {
        setType(initial.type)
        setAmount(String(initial.amount))
        setDate(initial.date)
        setCategory(initial.category ?? '')
        setMemo(initial.memo ?? '')
        setPaymentMethod(initial.paymentMethod ?? 'cash')
        setCardBrand(initial.cardBrand ?? '')
        setMemberName(initial.memberName ?? '')
      } else {
        setType('expense')
        setAmount('')
        setDate(defaultDate ?? todayIso())
        setCategory('')
        setMemo('')
        setPaymentMethod('cash')
        setCardBrand('')
        setMemberName('')
      }
    })
  }, [open, initial, defaultDate])

  if (!open) return null

  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount.replace(/,/g, '').replace(/\s/g, ''))
    if (!Number.isFinite(n) || n <= 0) return

    if (type === 'expense' && paymentMethod === 'card' && !cardBrand) {
      alert('카드를 선택해 주세요.')
      return
    }

    onSubmit({
      id: initial?.id,
      type,
      amount: Math.round(n),
      date,
      category: category || undefined,
      memo: memo.trim() || undefined,
      memberName: memberName.trim() || undefined,
      ...(type === 'expense'
        ? {
            paymentMethod,
            cardBrand:
              paymentMethod === 'card' && cardBrand ? cardBrand : undefined,
          }
        : {}),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="tx-form-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-card)] sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="tx-form-title"
          className="!m-0 !text-lg font-semibold text-starbucks-green"
        >
          {initial ? '거래 수정' : '거래 추가'}
        </h2>

        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <fieldset className="flex gap-2 border-0 p-0">
            <legend className="sr-only">유형</legend>
            <Button
              type="button"
              variant={type === 'income' ? 'primary' : 'outlined'}
              className="flex-1"
              onClick={() => setType('income')}
            >
              수입
            </Button>
            <Button
              type="button"
              variant={type === 'expense' ? 'primary' : 'outlined'}
              className="flex-1"
              onClick={() => setType('expense')}
            >
              지출
            </Button>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm font-medium text-[rgba(0,0,0,0.87)]">
            금액 (원)
            <input
              required
              inputMode="numeric"
              className="rounded-lg border border-input-border px-3 py-2.5 text-base outline-none focus:border-green-accent"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^\d]/g, ''))
              }
              placeholder="0"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[rgba(0, 0, 0, 0.87)]">
            날짜
            <input
              required
              type="date"
              className="rounded-lg border border-input-border px-3 py-2.5 text-base outline-none focus:border-green-accent"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[rgba(0, 0, 0, 0.87)]">
            분류
            <select
              className="rounded-lg border border-input-border bg-white px-3 py-2.5 text-base outline-none focus:border-green-accent"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">선택</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {type === 'expense' ? (
            <>
              <fieldset className="flex flex-col gap-2 border-0 p-0">
                <legend className="text-sm font-medium text-[rgba(0, 0, 0, 0.87)]">
                  지불 수단
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant={paymentMethod === 'cash' ? 'primary' : 'outlined'}
                    className="flex-1"
                    onClick={() => {
                      setPaymentMethod('cash')
                      setCardBrand('')
                    }}
                  >
                    현금
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === 'ieum' ? 'primary' : 'outlined'}
                    className="flex-1"
                    onClick={() => {
                      setPaymentMethod('ieum')
                      setCardBrand('')
                    }}
                  >
                    이음카드
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === 'card' ? 'primary' : 'outlined'}
                    className="flex-1"
                    onClick={() => setPaymentMethod('card')}
                  >
                    카드
                  </Button>
                </div>
              </fieldset>

              {paymentMethod === 'card' ? (
                <label className="flex flex-col gap-1 text-sm font-medium text-[rgba(0, 0, 0, 0.87)]">
                  카드사
                  <select
                    required
                    className="rounded-lg border border-input-border bg-white px-3 py-2.5 text-base outline-none focus:border-green-accent"
                    value={cardBrand}
                    onChange={(e) => setCardBrand(e.target.value)}
                  >
                    <option value="">카드사 선택</option>
                    {CARD_BRANDS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}

          {members.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[rgba(0,0,0,0.87)]">구성원 (선택)</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMemberName('')}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${memberName === '' ? 'border-starbucks-green bg-starbucks-green text-white' : 'border-black/20 text-text-soft hover:bg-neutral-cool'}`}
                >
                  전체
                </button>
                {members.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMemberName(m === memberName ? '' : m)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${memberName === m ? 'border-starbucks-green bg-starbucks-green text-white' : 'border-black/20 text-text-soft hover:bg-neutral-cool'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium text-[rgba(0, 0, 0, 0.87)]">
            메모 (선택)
            <textarea
              rows={2}
              className="resize-none rounded-lg border border-input-border px-3 py-2 text-base outline-none focus:border-green-accent"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outlined"
              className="flex-1"
              onClick={onClose}
            >
              취소
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              저장
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
