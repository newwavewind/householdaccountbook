import type { KeyboardEvent } from 'react'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../constants/categories'
import type { PaymentMethod } from '../types/transaction'
import type { BulkDraftRow, BulkRowsUpdater } from './draftRow'
import {
  BULK_ACTION_BTN,
  BULK_ACTION_BTN_PRIMARY,
  BULK_INPUT_CONTROL_SM,
} from './bulkInputControls'
import { BulkCardPicker } from './BulkCardPicker'
import { BulkCategoryPicker } from './BulkCategoryPicker'
import { BulkMemberPicker } from './BulkMemberPicker'
import { bulkTdClass } from './bulkInputTableLayout'

export type BulkInputDraftRowProps = {
  r: BulkDraftRow
  rowIndex: number
  /** working: 맨 위 입력 칸 · history-edit: 확인된 내역 인라인 수정 */
  mode?: 'working' | 'history-edit'
  onSaveHistory?: () => void
  onCancelHistory?: () => void
  monthIndex: number
  members: string[]
  rows: BulkDraftRow[]
  onChangeRows: (payload: BulkRowsUpdater) => void
  amountFocusLocalKey: string | null
  setAmountFocusLocalKey: (key: string | null) => void
  categoryOpenLocalKey: string | null
  setCategoryOpenLocalKey: (key: string | null) => void
  cardOpenLocalKey: string | null
  setCardOpenLocalKey: (key: string | null) => void
  memberOpenLocalKey: string | null
  setMemberOpenLocalKey: (key: string | null) => void
  confirmFlashLocalKey: string | null
  onConfirm: (localKey: string) => void
  onFieldKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onNavigateAfterPick: (fromTrigger: HTMLButtonElement) => void
  formatAmountCommas: (digits: string) => string
  amountDigitsOnly: (raw: string) => string
}

export function BulkInputDraftRow({
  r,
  rowIndex: i,
  mode = 'working',
  onSaveHistory,
  onCancelHistory,
  monthIndex,
  members,
  rows,
  onChangeRows,
  amountFocusLocalKey,
  setAmountFocusLocalKey,
  categoryOpenLocalKey,
  setCategoryOpenLocalKey,
  cardOpenLocalKey,
  setCardOpenLocalKey,
  memberOpenLocalKey,
  setMemberOpenLocalKey,
  confirmFlashLocalKey,
  onConfirm,
  onFieldKeyDown,
  onNavigateAfterPick,
  formatAmountCommas,
  amountDigitsOnly,
}: BulkInputDraftRowProps) {
  const patch = (patchRow: Partial<BulkDraftRow>) => {
    const next = [...rows]
    next[i] = { ...r, ...patchRow }
    onChangeRows(next)
  }

  const closePickers = () => {
    setCategoryOpenLocalKey(null)
    setCardOpenLocalKey(null)
    setMemberOpenLocalKey(null)
  }

  const isHistoryEdit = mode === 'history-edit'

  return (
    <tr
      data-bulk-row={r.localKey}
      {...(mode === 'working'
        ? { 'data-bulk-working-row': true }
        : { 'data-bulk-history-edit': true })}
      className={`align-middle ${
        isHistoryEdit
          ? 'border-b border-green-accent/35 bg-green-light/25 ring-1 ring-inset ring-green-accent/20'
          : ''
      }`}
    >
      <td className={bulkTdClass()}>
        <input
          aria-label={`${monthIndex + 1}월 일`}
          inputMode="numeric"
          placeholder="일"
          className={`${BULK_INPUT_CONTROL_SM} tabular-nums`}
          maxLength={2}
          value={r.day}
          onChange={(e) => patch({ day: e.target.value.replace(/\D/g, '') })}
          onKeyDown={onFieldKeyDown}
        />
      </td>
      <td className={bulkTdClass()}>
        <select
          aria-label={`${monthIndex + 1}월 구분`}
          className={BULK_INPUT_CONTROL_SM}
          value={r.kind}
          onChange={(e) => {
            const k = e.target.value === 'income' ? 'income' : 'expense'
            closePickers()
            patch({
              kind: k,
              category: '',
              ...(k === 'income'
                ? { paymentMethod: 'cash' as PaymentMethod, cardBrand: '' }
                : {}),
            })
          }}
          onKeyDown={onFieldKeyDown}
        >
          <option value="expense">지출</option>
          <option value="income">수입</option>
        </select>
      </td>
      <td className={bulkTdClass()}>
        <input
          aria-label="금액"
          inputMode="numeric"
          placeholder="0"
          className={`${BULK_INPUT_CONTROL_SM} tabular-nums`}
          value={
            amountFocusLocalKey === r.localKey
              ? amountDigitsOnly(r.amount)
              : formatAmountCommas(r.amount)
          }
          onChange={(e) => patch({ amount: amountDigitsOnly(e.target.value) })}
          onFocus={() => setAmountFocusLocalKey(r.localKey)}
          onBlur={() => setAmountFocusLocalKey(null)}
          onKeyDown={onFieldKeyDown}
        />
      </td>
      <td className={bulkTdClass()}>
        <BulkCategoryPicker
          ariaLabel={`${monthIndex + 1}월 카테고리`}
          rowLocalKey={r.localKey}
          options={
            r.kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
          }
          value={r.category}
          isOpen={categoryOpenLocalKey === r.localKey}
          onOpenThis={() => {
            setCardOpenLocalKey(null)
            setMemberOpenLocalKey(null)
            setCategoryOpenLocalKey(r.localKey)
          }}
          onClose={() => setCategoryOpenLocalKey(null)}
          onPick={(category) => patch({ category })}
          onFieldKeyDown={onFieldKeyDown}
          onNavigateAfterPick={onNavigateAfterPick}
        />
      </td>
      <td className={bulkTdClass()}>
        <input
          aria-label="메모"
          className={BULK_INPUT_CONTROL_SM}
          value={r.memo}
          onChange={(e) => patch({ memo: e.target.value })}
          onKeyDown={onFieldKeyDown}
        />
      </td>
      <td className={bulkTdClass()}>
        <select
          aria-label="결제 수단"
          disabled={r.kind !== 'expense'}
          className={`${BULK_INPUT_CONTROL_SM} disabled:opacity-40`}
          value={r.paymentMethod}
          onChange={(e) => {
            const v = e.target.value
            const pm: PaymentMethod =
              v === 'cash' ? 'cash' : v === 'ieum' ? 'ieum' : 'card'
            if (pm === 'cash' || pm === 'ieum') setCardOpenLocalKey(null)
            patch({
              paymentMethod: pm,
              ...(pm === 'cash' || pm === 'ieum' ? { cardBrand: '' } : {}),
            })
          }}
          onKeyDown={onFieldKeyDown}
        >
          <option value="card">카드</option>
          <option value="ieum">이음카드</option>
          <option value="cash">현금</option>
        </select>
      </td>
      <td className={bulkTdClass()}>
        <BulkCardPicker
          ariaLabel="카드사"
          rowLocalKey={r.localKey}
          value={r.cardBrand}
          disabled={r.kind !== 'expense' || r.paymentMethod !== 'card'}
          isOpen={cardOpenLocalKey === r.localKey}
          onOpenThis={() => {
            setCategoryOpenLocalKey(null)
            setMemberOpenLocalKey(null)
            setCardOpenLocalKey(r.localKey)
          }}
          onClose={() => setCardOpenLocalKey(null)}
          onPick={(cardBrand) => patch({ cardBrand })}
          onFieldKeyDown={onFieldKeyDown}
          onNavigateAfterPick={onNavigateAfterPick}
        />
      </td>
      {members.length > 0 && (
        <td className={bulkTdClass()}>
          <BulkMemberPicker
            ariaLabel="구성원"
            rowLocalKey={r.localKey}
            members={members}
            value={r.memberName}
            isOpen={memberOpenLocalKey === r.localKey}
            onOpenThis={() => {
              setCategoryOpenLocalKey(null)
              setCardOpenLocalKey(null)
              setMemberOpenLocalKey(r.localKey)
            }}
            onClose={() => setMemberOpenLocalKey(null)}
            onPick={(memberName) => patch({ memberName })}
            onFieldKeyDown={onFieldKeyDown}
            onNavigateAfterPick={onNavigateAfterPick}
          />
        </td>
      )}
      <td className={bulkTdClass()}>
        {isHistoryEdit ? (
          <div className="flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              data-cancel-row="true"
              className={`${BULK_ACTION_BTN} !border-border-subtle !bg-surface-raised !text-text-secondary hover:!bg-neutral-cool/50`}
              onClick={() => onCancelHistory?.()}
            >
              취소
            </button>
            <button
              type="button"
              data-save-row="true"
              className={BULK_ACTION_BTN_PRIMARY}
              onClick={() => onSaveHistory?.()}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSaveHistory?.()
                }
              }}
            >
              저장
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-confirm-row="true"
            className={`${BULK_ACTION_BTN_PRIMARY} transition-all duration-200 active:scale-[0.98] ${
              confirmFlashLocalKey === r.localKey
                ? 'ring-2 ring-amber-200/90 brightness-105'
                : ''
            }`}
            onClick={() => onConfirm(r.localKey)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onConfirm(r.localKey)
              }
            }}
          >
            확인
          </button>
        )}
      </td>
    </tr>
  )
}
