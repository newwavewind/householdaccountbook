import { cardBrandLabel } from '../constants/cardBrands'
import type { BulkDraftRow } from './draftRow'
import {
  formatBulkAmountDisplay,
  formatBulkKindLabel,
  formatBulkPaymentLabel,
} from './bulkInputDisplay'
import { BulkRowManageIcon } from './BulkRowManageIcon'
import {
  bulkAmountClass,
  bulkKindClass,
  bulkTdClass,
  BULK_CELL_TEXT,
  BULK_CELL_NUM,
} from './bulkInputTableLayout'

type Props = {
  r: BulkDraftRow
  showMembers: boolean
  rowIndex: number
  isEditing: boolean
  onOpenMenu: (localKey: string) => void
}

export function BulkInputHistoryRow({
  r,
  showMembers,
  rowIndex,
  isEditing,
  onOpenMenu,
}: Props) {
  if (isEditing) return null

  const zebra = rowIndex % 2 === 1 ? 'bg-neutral-cool/25' : 'bg-surface-raised'

  return (
    <tr
      data-bulk-row={r.localKey}
      className={`border-b border-border-muted/60 ${zebra}`}
    >
      <td className={bulkTdClass()}>
        <span className={`${BULK_CELL_NUM} font-medium`}>
          {r.day.trim() ? `${r.day}일` : '—'}
        </span>
      </td>
      <td className={bulkTdClass()}>
        <span className={bulkKindClass(r.kind)}>
          {formatBulkKindLabel(r.kind)}
        </span>
      </td>
      <td className={bulkTdClass()}>
        <span className={bulkAmountClass(r.kind)}>
          {formatBulkAmountDisplay(r.amount)}
        </span>
      </td>
      <td className={bulkTdClass()}>
        <span className={BULK_CELL_TEXT}>{r.category.trim() || '—'}</span>
      </td>
      <td className={bulkTdClass()}>
        <span className={BULK_CELL_TEXT}>{r.memo.trim() || '—'}</span>
      </td>
      <td className={bulkTdClass()}>
        <span className={BULK_CELL_TEXT}>{formatBulkPaymentLabel(r)}</span>
      </td>
      <td className={bulkTdClass()}>
        <span className={BULK_CELL_TEXT}>
          {r.kind === 'expense' && r.paymentMethod === 'card'
            ? cardBrandLabel(r.cardBrand) ?? '—'
            : '—'}
        </span>
      </td>
      {showMembers && (
        <td className={bulkTdClass()}>
          <span className={BULK_CELL_TEXT}>{r.memberName.trim() || '—'}</span>
        </td>
      )}
      <td className={bulkTdClass()}>
        <button
          type="button"
          aria-label="항목 관리"
          title="수정·삭제"
          className="mx-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised text-text-muted shadow-sm transition-colors hover:border-green-accent/45 hover:bg-green-light/50 hover:text-green-accent"
          onClick={() => onOpenMenu(r.localKey)}
        >
          <BulkRowManageIcon />
        </button>
      </td>
    </tr>
  )
}
