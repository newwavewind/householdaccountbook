import type { DdayEvent, DdayKind } from './ddayTypes'

export const DDAYS_STORAGE_KEY = 'gaegyeobu-ddays-v1'

export type DdaysPayload = { events: DdayEvent[] }

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function parseEvent(raw: unknown): DdayEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : null
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  const updatedAt =
    typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString()
  const kind = o.kind as DdayKind

  if (!id || !title) return null

  if (kind === 'birthday' || kind === 'couple') {
    if (o.dateBasis === 'lunar') {
      const lunarMonth = Number(o.lunarMonth)
      const lunarDay = Number(o.lunarDay)
      const lunarLeap = o.lunarLeap === true
      if (
        !Number.isFinite(lunarMonth) ||
        lunarMonth < 1 ||
        lunarMonth > 12 ||
        !Number.isFinite(lunarDay) ||
        lunarDay < 1 ||
        lunarDay > 30
      )
        return null
      return {
        id,
        title,
        updatedAt,
        kind,
        dateBasis: 'lunar',
        lunarMonth,
        lunarDay,
        lunarLeap,
      }
    }
    const month = Number(o.month)
    const day = Number(o.day)
    if (
      !Number.isFinite(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isFinite(day) ||
      day < 1 ||
      day > 31
    )
      return null
    return { id, title, updatedAt, kind, dateBasis: 'solar', month, day }
  }
  if (kind === 'baby') {
    if (!isIsoDate(o.birthDate)) return null
    if (o.birthBasis === 'lunar') {
      const birthLunarYear = Number(o.birthLunarYear)
      const lunarMonth = Number(o.lunarMonth)
      const lunarDay = Number(o.lunarDay)
      const lunarLeap = o.lunarLeap === true
      if (
        !Number.isFinite(birthLunarYear) ||
        birthLunarYear < 1000 ||
        birthLunarYear > 2100 ||
        !Number.isFinite(lunarMonth) ||
        lunarMonth < 1 ||
        lunarMonth > 12 ||
        !Number.isFinite(lunarDay) ||
        lunarDay < 1 ||
        lunarDay > 30
      )
        return null
      return {
        id,
        title,
        updatedAt,
        kind: 'baby',
        birthBasis: 'lunar',
        birthDate: o.birthDate,
        birthLunarYear,
        lunarMonth,
        lunarDay,
        lunarLeap,
      }
    }
    return {
      id,
      title,
      updatedAt,
      kind: 'baby',
      birthBasis: 'solar',
      birthDate: o.birthDate,
    }
  }
  if (kind === 'exam' || kind === 'custom') {
    if (!isIsoDate(o.targetDate)) return null
    return { id, title, updatedAt, kind, targetDate: o.targetDate }
  }
  return null
}

export function parseDdaysPayload(raw: unknown): DdayEvent[] {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return []
  const events = (raw as { events?: unknown }).events
  if (!Array.isArray(events)) return []
  const out: DdayEvent[] = []
  for (const e of events) {
    const p = parseEvent(e)
    if (p) out.push(p)
  }
  return out
}

function safeParseLocal(raw: string | null): DdayEvent[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw) as unknown
    if (Array.isArray(j)) return parseDdaysPayload({ events: j })
    return parseDdaysPayload(j)
  } catch {
    return []
  }
}

export function loadDdays(): DdayEvent[] {
  if (typeof localStorage === 'undefined') return []
  return safeParseLocal(localStorage.getItem(DDAYS_STORAGE_KEY))
}

export function saveDdays(events: DdayEvent[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DDAYS_STORAGE_KEY, JSON.stringify({ events }))
}

export function newDdayId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `dday-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
