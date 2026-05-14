import type { BulkDraftRow } from './draftRow'
import type { PaymentMethod } from '../types/transaction'
import { emptyDraftRow } from './draftRow'

/** JSON 직렬화 시 연도는 문자열 키가 됩니다. */
export type BulkInputBundle = {
  lastOpenYear: number
  /** 연도별 12달 × 행 목록 */
  years: Partial<Record<number, BulkDraftRow[][]>>
}

const STORAGE_KEY = 'bulk-input-draft-v2'

export function normalizeDraftRow(raw: unknown): BulkDraftRow {
  const base = emptyDraftRow()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  const localKey =
    typeof o.localKey === 'string' && o.localKey.trim().length >= 8
      ? o.localKey.trim()
      : crypto.randomUUID()

  const kind = o.kind === 'income' ? 'income' : 'expense'
  const pm = o.paymentMethod === 'cash' ? 'cash' : 'card'

  let amount = ''
  if (typeof o.amount === 'string') amount = o.amount
  else if (typeof o.amount === 'number' && Number.isFinite(o.amount))
    amount = String(Math.trunc(o.amount))

  return {
    localKey,
    day: typeof o.day === 'string' ? o.day.replace(/\D/g, '').slice(0, 2) : '',
    kind,
    amount,
    memo: typeof o.memo === 'string' ? o.memo : '',
    category: typeof o.category === 'string' ? o.category : '',
    paymentMethod: pm as PaymentMethod,
    cardBrand: typeof o.cardBrand === 'string' ? o.cardBrand : '',
    memberName: typeof o.memberName === 'string' ? o.memberName : '',
  }
}

/** 한 달의 행 배열 안전 처리 */
export function normalizeMonthRows(raw: unknown): BulkDraftRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [emptyDraftRow()]
  return raw.map(normalizeDraftRow)
}

/** 12개월 고정 행렬 */
export function normalizeYearDrafts(raw: unknown): BulkDraftRow[][] {
  if (!Array.isArray(raw))
    return Array.from({ length: 12 }, () => [emptyDraftRow()])
  return Array.from({ length: 12 }, (_, mi) =>
    normalizeMonthRows(raw[mi]),
  )
}

function parseYears(raw: unknown): Partial<Record<number, BulkDraftRow[][]>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Partial<Record<number, BulkDraftRow[][]>> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const y = Number(k)
    if (!Number.isFinite(y)) continue
    out[y] = normalizeYearDrafts(v)
  }
  return out
}

export function loadBulkInputBundle(): BulkInputBundle | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      v?: number
      lastOpenYear?: unknown
      years?: unknown
    }
    if (parsed.v !== 2) return null
    const lastOpenYear =
      typeof parsed.lastOpenYear === 'number' &&
      Number.isFinite(parsed.lastOpenYear)
        ? parsed.lastOpenYear
        : new Date().getFullYear()
    return {
      lastOpenYear,
      years: parseYears(parsed.years),
    }
  } catch {
    return null
  }
}

export function saveBulkInputBundle(bundle: BulkInputBundle): void {
  try {
    if (typeof window === 'undefined') return
    const yearsObj: Record<string, BulkDraftRow[][]> = {}
    for (const [k, v] of Object.entries(bundle.years)) {
      const y = Number(k)
      if (!Number.isFinite(y) || !v) continue
      yearsObj[String(y)] = v
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 2,
        lastOpenYear: bundle.lastOpenYear,
        years: yearsObj,
      }),
    )
  } catch {
    /* quota */
  }
}
