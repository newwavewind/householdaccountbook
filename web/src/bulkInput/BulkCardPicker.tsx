import { useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { CARD_BRANDS } from '../constants/cardBrands'
import { BulkListPicker, type BulkListPickerRow } from './BulkListPicker'

type Props = {
  ariaLabel: string
  rowLocalKey: string
  value: string
  disabled?: boolean
  isOpen: boolean
  onOpenThis: () => void
  onClose: () => void
  onPick: (cardBrandId: string) => void
  onFieldKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onNavigateAfterPick?: (fromTrigger: HTMLButtonElement) => void
}

export function BulkCardPicker({
  ariaLabel,
  rowLocalKey,
  value,
  disabled,
  isOpen,
  onOpenThis,
  onClose,
  onPick,
  onFieldKeyDown,
  onNavigateAfterPick,
}: Props) {
  const rows = useMemo((): BulkListPickerRow[] => {
    const head: BulkListPickerRow = { value: '', label: '카드 선택' }
    return [
      head,
      ...CARD_BRANDS.map((b) => ({ value: b.id, label: b.label })),
    ]
  }, [])

  return (
    <BulkListPicker
      ariaLabel={ariaLabel}
      rowLocalKey={rowLocalKey}
      pickerRole="card"
      rows={rows}
      value={value}
      isOpen={isOpen}
      disabled={disabled}
      onOpenThis={onOpenThis}
      onClose={onClose}
      onPick={onPick}
      onFieldKeyDown={onFieldKeyDown}
      onNavigateAfterPick={onNavigateAfterPick}
      triggerClassName="max-w-[10rem] min-h-[42px] w-full truncate rounded-lg border border-input-border bg-white px-2 py-1.5 text-left text-xs outline-none focus:border-green-accent disabled:opacity-40"
    />
  )
}
