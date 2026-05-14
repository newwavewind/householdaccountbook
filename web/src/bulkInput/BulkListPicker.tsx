import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

const PANEL_GAP = 8
const PANEL_MIN_W = 176
const PANEL_MAX_W = 280
const PANEL_MAX_H = 288

export type BulkListPickerRole = 'category' | 'card'

export type BulkListPickerRow = { value: string; label: string }

type Props = {
  ariaLabel: string
  rowLocalKey: string
  pickerRole: BulkListPickerRole
  /** 첫 줄은 보통 value '' + 플레이스홀더 라벨 */
  rows: readonly BulkListPickerRow[]
  value: string
  isOpen: boolean
  disabled?: boolean
  onOpenThis: () => void
  onClose: () => void
  onPick: (pickedValue: string) => void
  onFieldKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  /** 항목 확정 후(Enter·클릭) 이 트리거 기준 다음 입력 칸으로 포커스 */
  onNavigateAfterPick?: (fromTrigger: HTMLButtonElement) => void
  triggerClassName: string
}

export function BulkListPicker({
  ariaLabel,
  rowLocalKey,
  pickerRole,
  rows: rowsProp,
  value,
  isOpen,
  disabled,
  onOpenThis,
  onClose,
  onPick,
  onFieldKeyDown,
  onNavigateAfterPick,
  triggerClassName,
}: Props) {
  const rowsList = useMemo(() => [...rowsProp], [rowsProp])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [highlight, setHighlight] = useState(0)

  const dataTriggerProps =
    pickerRole === 'category'
      ? { 'data-bulk-category-trigger': true as const }
      : { 'data-bulk-card-trigger': true as const }

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = rect.right + PANEL_GAP
    const top = rect.top
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800
    if (left + PANEL_MAX_W > vw - PANEL_GAP) {
      left = Math.max(PANEL_GAP, rect.left - PANEL_MAX_W - PANEL_GAP)
    }
    if (left < PANEL_GAP) left = PANEL_GAP
    setPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
    const pi = rowsList.findIndex((r: BulkListPickerRow) => r.value === value)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 패널 열릴 때 목록 하이라이트
    setHighlight(pi >= 0 ? pi : 0)
    const id = requestAnimationFrame(() => listRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
  }, [isOpen, rowLocalKey, value, rowsList, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    const onScrollResize = () => updatePosition()
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [isOpen, onClose, updatePosition])

  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const child = listRef.current.children[highlight] as HTMLElement | undefined
    child?.scrollIntoView({ block: 'nearest' })
  }, [highlight, isOpen])

  const pickAt = useCallback(
    (idx: number) => {
      const row = rowsList[idx]
      if (!row) return
      onPick(row.value)
      onClose()
      requestAnimationFrame(() => {
        const t = triggerRef.current
        if (t && onNavigateAfterPick) onNavigateAfterPick(t)
        else t?.focus({ preventScroll: true })
      })
    },
    [rowsList, onPick, onClose, onNavigateAfterPick],
  )

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !isOpen) {
      e.preventDefault()
      onOpenThis()
      return
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isOpen) {
      e.preventDefault()
      onOpenThis()
      if (e.key === 'ArrowUp') setHighlight(rowsList.length - 1)
      else setHighlight(0)
      return
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && isOpen) {
      e.preventDefault()
      onOpenThis()
      return
    }
    if (isOpen && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      return
    }
    onFieldKeyDown(e)
  }

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      triggerRef.current?.focus({ preventScroll: true })
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(rowsList.length - 1, h + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      pickAt(highlight)
      return
    }
  }

  const emptyLabel = rowsList[0]?.label ?? ''
  const shownOnTrigger =
    value.trim() === ''
      ? emptyLabel
      : rowsList.find((r: BulkListPickerRow) => r.value === value)?.label ??
        value

  const optPrefix = pickerRole === 'category' ? 'cat' : 'card'

  const panel =
    isOpen &&
    !disabled &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={listRef}
        role="listbox"
        tabIndex={-1}
        aria-label={`${ariaLabel} 목록`}
        aria-activedescendant={`${optPrefix}-opt-${rowLocalKey}-${highlight}`}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          maxHeight: PANEL_MAX_H,
          minWidth: PANEL_MIN_W,
          width: 'max-content',
          maxWidth: PANEL_MAX_W,
          overflowY: 'auto',
          zIndex: 10000,
          background: 'white',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '10px',
          boxShadow:
            '0 8px 24px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
          padding: '4px',
        }}
        onKeyDown={onListKeyDown}
      >
        {rowsList.map((row: BulkListPickerRow, idx: number) => {
          const selected =
            idx === 0
              ? value === '' || value.trim() === ''
              : value === row.value
          return (
            <div
              key={`${idx}-${row.value || 'none'}`}
              id={`${optPrefix}-opt-${rowLocalKey}-${idx}`}
              data-list-picker-option={String(idx)}
              role="option"
              aria-selected={selected}
              tabIndex={-1}
              className={`cursor-pointer rounded-[8px] px-3 py-2 text-sm outline-none transition-colors ${idx === highlight ? 'bg-green-light text-[rgba(0,0,0,0.87)]' : 'text-[rgba(0,0,0,0.87)]'} ${selected ? 'font-semibold' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                pickAt(idx)
              }}
              onMouseEnter={() => setHighlight(idx)}
            >
              {row.label}
            </div>
          )
        })}
      </div>,
      document.body,
    )

  return (
    <>
      <button
        {...dataTriggerProps}
        ref={triggerRef}
        type="button"
        id={`bulk-${pickerRole}-trigger-${rowLocalKey}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        className={`${triggerClassName} ${disabled ? '' : value.trim() !== '' ? '' : 'text-text-soft'}`}
        onClick={() => {
          if (disabled) return
          if (isOpen) onClose()
          else onOpenThis()
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {shownOnTrigger}
      </button>
      {panel}
    </>
  )
}
