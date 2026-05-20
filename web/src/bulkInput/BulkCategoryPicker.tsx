import { useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
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
    return [
      head,
      ...options.map((o) => ({
        value: o,
        label: o,
        icon: <CategoryIcon name={o} />,
      })),
    ]
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
      triggerClassName="h-9 min-h-9 w-full min-w-0 truncate rounded-lg border border-input-border bg-surface-raised px-2 text-center text-sm outline-none focus:border-green-accent"
    />
  )
}
