/** 입력 표 · 확인된 내역 표 — 동일 너비·열 비율 */
export const BULK_TABLE_CLASS = 'w-full table-fixed border-collapse text-sm'

export const BULK_TABLE_MIN_WIDTH = 720

export const BULK_TABLE_SCROLL =
  'overflow-x-auto rounded-xl border border-border-subtle bg-surface-raised'

export const BULK_TABLE_INNER = 'w-full'

export const BULK_TH =
  'px-2 py-2 text-center font-sans text-xs font-medium tracking-wide text-text-muted'

export const BULK_TD = 'px-2 py-2.5 align-middle overflow-hidden text-center font-sans'

/** 본문 셀 텍스트 */
export const BULK_CELL_TEXT =
  'mx-auto block max-w-full truncate text-center text-[0.8125rem] font-normal leading-9 text-text-primary'

/** 숫자·일자 */
export const BULK_CELL_NUM =
  'mx-auto block max-w-full truncate text-center text-[0.8125rem] font-medium leading-9 tabular-nums text-text-primary'

/** 금액 — 구분에 따라 색 (목록에서 강조) */
export function bulkAmountClass(kind: 'income' | 'expense'): string {
  return `mx-auto block max-w-full truncate text-center text-sm font-bold leading-9 tabular-nums ${
    kind === 'income' ? 'text-semantic-income' : 'text-semantic-expense'
  }`
}

/** 구분 뱃지 */
export function bulkKindClass(kind: 'income' | 'expense'): string {
  return `inline-flex h-7 max-w-full items-center justify-center truncate rounded-md px-2 text-[0.75rem] font-medium leading-none ${
    kind === 'income'
      ? 'bg-semantic-income/12 text-semantic-income'
      : 'bg-semantic-expense/10 text-semantic-expense'
  }`
}

type ColGroupProps = {
  showMembers: boolean
}

/** 마지막 열(확인/관리) 너비 동일 — 두 표 세로 정렬 일치 */
export function BulkInputTableColGroup({ showMembers }: ColGroupProps) {
  if (showMembers) {
    return (
      <colgroup>
        <col style={{ width: '7%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '13%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '8%' }} />
      </colgroup>
    )
  }
  return (
    <colgroup>
      <col style={{ width: '7%' }} />
      <col style={{ width: '9%' }} />
      <col style={{ width: '14%' }} />
      <col style={{ width: '12%' }} />
      <col style={{ width: '24%' }} />
      <col style={{ width: '12%' }} />
      <col style={{ width: '13%' }} />
      <col style={{ width: '8%' }} />
    </colgroup>
  )
}

export function bulkThClass(extra?: string): string {
  return extra ? `${BULK_TH} ${extra}` : BULK_TH
}

export function bulkTdClass(extra?: string): string {
  return extra ? `${BULK_TD} ${extra}` : BULK_TD
}
