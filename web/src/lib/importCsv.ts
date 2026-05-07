import { CARD_BRANDS } from '../constants/cardBrands'
import type { PaymentMethod, Transaction, TransactionType } from '../types/transaction'

function resolveCardBrand(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (CARD_BRANDS.some((c) => c.id === t)) return t
  const lower = t.toLowerCase().replace(/\s+/g, '')
  for (const c of CARD_BRANDS) {
    const lab = c.label.toLowerCase().replace(/\s+/g, '')
    if (lab === lower) return c.id
    const short = c.label.replace(/카드$/, '').trim().toLowerCase().replace(/\s+/g, '')
    if (short === lower) return c.id
  }
  return t
}

/** 엑셀 행 이름 등 → 앱에서 쓰는 `category` 문자열 */
const CATEGORY_ALIAS: Record<string, string> = {
  수입: '기타',
  식비: '식비',
  '교통/차량': '교통',
  교통: '교통',
  '주거/통신': '공과금',
  '생활/용품': '쇼핑',
  '의복/미용': '쇼핑',
  '건강/문화': '문화',
  '교육/육아': '교육',
  '경조사/회비': '기타',
  '세금/이자': '기타',
  기타: '기타',
  급여: '급여',
  부수입: '부수입',
  '이자·배당': '이자·배당',
  환급: '환급',
  용돈: '용돈',
}

type ParsedRow = {
  date?: string
  type?: string
  amount?: string
  category?: string
  memo?: string
  paymentMethod?: string
  cardBrand?: string
}

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  date: 'date',
  날짜: 'date',
  해당일: 'date',
  일자: 'date',
  type: 'type',
  구분: 'type',
  유형: 'type',
  amount: 'amount',
  금액: 'amount',
  category: 'category',
  카테고리: 'category',
  분류: 'category',
  memo: 'memo',
  메모: 'memo',
  내용: 'memo',
  paymentmethod: 'paymentMethod',
  결제: 'paymentMethod',
  cardbrand: 'cardBrand',
  카드사: 'cardBrand',
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQ = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQ = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function normalizeHeader(h: string): keyof ParsedRow | null {
  const t = h.trim()
  const mapped = HEADER_ALIASES[t]
  if (mapped) return mapped
  const key = t.toLowerCase().replace(/\s+/g, '')
  return HEADER_ALIASES[key] ?? null
}

export function normalizeCategoryLabel(raw: string): string {
  const t = raw.trim()
  if (!t) return '기타'
  return CATEGORY_ALIAS[t] ?? t
}

function parseAmount(raw: string): number | null {
  const s = raw.replace(/[₩원\s]/g, '').replace(/,/g, '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function parseType(raw: string): TransactionType | null {
  const t = raw.trim().toLowerCase()
  if (t === 'income' || t === '수입' || t === 'i') return 'income'
  if (t === 'expense' || t === '지출' || t === 'e') return 'expense'
  return null
}

function parseDateIso(raw: string): string | null {
  const t = raw.trim()
  const m = t.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (m) {
    const y = m[1]!
    const mo = String(Number(m[2])).padStart(2, '0')
    const d = String(Number(m[3])).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return null
}

function parsePaymentMethod(raw: string): PaymentMethod | undefined {
  const t = raw.trim().toLowerCase()
  if (!t) return undefined
  if (t === 'cash' || t === '현금') return 'cash'
  if (t === 'card' || t === '카드') return 'card'
  return undefined
}

export type CsvImportResult =
  | { ok: true; rows: Omit<Transaction, 'id'>[] }
  | { ok: false; message: string }

/**
 * UTF-8 CSV. 첫 줄은 헤더.
 * - 필수: 날짜, 금액 → 그날 **지출** 한 건 (카드사 있으면 카드, 없으면 현금)
 * - `구분` 열이 있으면: 비우면 지출, `수입`/`지출`로 구체 지정
 * - 선택: 카테고리, 메모, 결제, 카드사
 */
export function parseLedgerCsv(text: string): CsvImportResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length < 2) {
    return { ok: false, message: '데이터가 없습니다. 헤더 다음 줄부터 입력해 주세요.' }
  }

  const headerCells = parseCsvLine(lines[0]!)
  const colMap: Partial<Record<keyof ParsedRow, number>> = {}
  headerCells.forEach((cell, i) => {
    const key = normalizeHeader(cell)
    if (key) colMap[key] = i
  })

  if (colMap.date === undefined || colMap.amount === undefined) {
    return {
      ok: false,
      message: '필수 열: 날짜, 금액입니다. (지출만 넣을 때는 구분 열 생략 가능, 카드사는 선택)',
    }
  }

  const hasTypeCol = colMap.type !== undefined
  const rows: Omit<Transaction, 'id'>[] = []
  const errors: string[] = []

  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]!)
    const get = (k: keyof ParsedRow) => {
      const idx = colMap[k]
      return idx !== undefined ? (cells[idx] ?? '').trim() : ''
    }

    const dateRaw = get('date')
    const typeRaw = get('type')
    const amountRaw = get('amount')
    const catRaw = get('category')
    const memo = get('memo') || undefined
    const payRaw = get('paymentMethod')
    const cardRaw = get('cardBrand')

    if (!dateRaw && !typeRaw && !amountRaw) continue

    const date = parseDateIso(dateRaw)
    const amount = parseAmount(amountRaw)

    let type: TransactionType
    if (!hasTypeCol || typeRaw === '') {
      type = 'expense'
    } else {
      const parsed = parseType(typeRaw)
      if (!parsed) {
        errors.push(`${li + 1}행: 구분은 수입 또는 지출`)
        continue
      }
      type = parsed
    }

    if (!date) errors.push(`${li + 1}행: 날짜 형식(YYYY-MM-DD)`)
    if (amount === null) errors.push(`${li + 1}행: 금액`)
    if (!date || amount === null) continue

    const category = catRaw ? normalizeCategoryLabel(catRaw) : '기타'

    const paymentMethod = parsePaymentMethod(payRaw)
    const cardBrandRaw = cardRaw.trim()
    const cardBrandResolved = cardBrandRaw ? resolveCardBrand(cardBrandRaw) : undefined

    const row: Omit<Transaction, 'id'> = {
      type,
      date,
      amount,
      memo,
      category,
    }

    if (type === 'expense') {
      let pm = paymentMethod
      if (cardBrandResolved && !pm) pm = 'card'
      if (!pm) pm = 'cash'
      row.paymentMethod = pm
      if (pm === 'card' && cardBrandResolved) row.cardBrand = cardBrandResolved
    }

    rows.push(row)
  }

  if (errors.length) {
    return {
      ok: false,
      message: errors.slice(0, 8).join('\n') + (errors.length > 8 ? '\n…' : ''),
    }
  }

  if (rows.length === 0) {
    return { ok: false, message: '유효한 행이 없습니다.' }
  }

  return { ok: true, rows }
}
