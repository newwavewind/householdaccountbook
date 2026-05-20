import type { BulkDraftRow } from './draftRow'
import { emptyDraftRow } from './draftRow'

/** 입력·반영 대상이 없는 빈 줄 */
export function isBlankDraftRow(r: BulkDraftRow): boolean {
  return (
    !String(r.day).trim() &&
    !String(r.amount).replace(/\D/g, '').trim()
  )
}

/** 맨 위에 빈 작업 줄이 있도록 보장 */
export function ensureWorkingRowOnTop(rows: BulkDraftRow[]): BulkDraftRow[] {
  if (rows.length === 0) return [emptyDraftRow()]
  if (isBlankDraftRow(rows[0]!)) return rows
  return [emptyDraftRow(), ...rows]
}

/** 확인 후: 작업 줄은 맨 아래(확인 목록)로, 맨 위에 새 빈 줄 */
export function moveRowBelowTopAfterConfirm(
  rows: BulkDraftRow[],
  rowLocalKey: string,
): BulkDraftRow[] {
  const idx = rows.findIndex((r) => r.localKey === rowLocalKey)
  if (idx < 0) return ensureWorkingRowOnTop(rows)
  const row = rows[idx]!
  const rest = rows.filter((_, j) => j !== idx)
  if (isBlankDraftRow(row)) return ensureWorkingRowOnTop(rest)
  return [emptyDraftRow(), row, ...rest]
}

/**
 * 예전 저장 형식(맨 아래 빈 줄) → 맨 위 작업 줄 + 아래로 쌓인 확인 줄.
 */
export function migrateLegacyMonthRowOrder(rows: BulkDraftRow[]): BulkDraftRow[] {
  if (rows.length <= 1) return ensureWorkingRowOnTop(rows)

  const firstBlank = isBlankDraftRow(rows[0]!)
  const lastBlank = isBlankDraftRow(rows[rows.length - 1]!)

  if (firstBlank && !lastBlank) return rows

  if (!firstBlank && lastBlank) {
    const body = rows.slice(0, -1)
    return [emptyDraftRow(), ...body.reverse()]
  }

  if (!firstBlank && !lastBlank) {
    return [emptyDraftRow(), ...rows.reverse()]
  }

  return [emptyDraftRow(), ...rows.slice(1)]
}
