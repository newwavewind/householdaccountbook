import { useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { BulkListPicker, type BulkListPickerRow } from './BulkListPicker'

/** '' = 미선택(선택 라벨) */
type Props = {
  ariaLabel: string
  rowLocalKey: string
  options: readonly string[]
  value: string
  isOpen: boolean
  onOpenThis: () => void
  onClose: () => void
  onPick: (category: string) => void
  onFieldKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onNavigateAfterPick?: (fromTrigger: HTMLButtonElement) => void
}

export function BulkCategoryPicker({
  ariaLabel,
  rowLocalKey,
  options,
  value,
  isOpen,
  onOpenThis,
  onClose,
  onPick,
  onFieldKeyDown,
  onNavigateAfterPick,
}: Props) {
  const rows = useMemo((): BulkListPickerRow[] => {
    const head: BulkListPickerRow = { value: '', label: '선택' }
    return [head, ...options.map((o) => ({ value: o, label: o }))]
  }, [options])

  return (
    <BulkListPicker
      ariaLabel={ariaLabel}
      rowLocalKey={rowLocalKey}
      pickerRole="category"
      rows={rows}
      value={value}
      isOpen={isOpen}
      onOpenThis={onOpenThis}
      onClose={onClose}
      onPick={onPick}
      onFieldKeyDown={onFieldKeyDown}
      onNavigateAfterPick={onNavigateAfterPick}
      triggerClassName="max-w-[12rem] min-h-[42px] w-full truncate rounded-lg border border-input-border bg-white px-3 py-1.5 text-left text-sm outline-none focus:border-green-accent"
    />
  )
}
