import { useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { BulkListPicker, type BulkListPickerRow } from './BulkListPicker'

type Props = {
  ariaLabel: string
  rowLocalKey: string
  members: readonly string[]
  value: string
  isOpen: boolean
  onOpenThis: () => void
  onClose: () => void
  onPick: (memberName: string) => void
  onFieldKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onNavigateAfterPick?: (fromTrigger: HTMLButtonElement) => void
}

export function BulkMemberPicker({
  ariaLabel,
  rowLocalKey,
  members,
  value,
  isOpen,
  onOpenThis,
  onClose,
  onPick,
  onFieldKeyDown,
  onNavigateAfterPick,
}: Props) {
  const rows = useMemo((): BulkListPickerRow[] => {
    const head: BulkListPickerRow = { value: '', label: '—' }
    return [head, ...members.map((m) => ({ value: m, label: m }))]
  }, [members])

  return (
    <BulkListPicker
      ariaLabel={ariaLabel}
      rowLocalKey={rowLocalKey}
      pickerRole="member"
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
