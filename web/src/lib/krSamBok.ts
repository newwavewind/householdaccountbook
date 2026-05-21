import type { CalendarLabelEntry } from './calendarLabelTypes'
import { getSolarTermMapForYear } from './krSolarTerms'

/** 일주 천간 계산 기준일 (1900-01-31) */
const STEM_BASE_UTC = Date.UTC(1900, 0, 31)

const samBokCache = new Map<number, Map<string, CalendarLabelEntry[]>>()

function addDaysSeoul(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const anchor = Date.UTC(y, m - 1, d, 3, 0, 0)
  const shifted = new Date(anchor + delta * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted)
}

/** 庚日(경일) — 천간 인덱스 6 */
function isGengDay(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const noon = Date.UTC(y, m - 1, d, 3, 0, 0)
  const days = Math.floor((noon - STEM_BASE_UTC) / 86_400_000)
  return ((days % 10) + 10) % 10 === 6
}

function findSolarTermIso(year: number, termName: string): string | undefined {
  for (const [iso, entries] of getSolarTermMapForYear(year)) {
    if (entries[0]?.name === termName) return iso
  }
  return undefined
}

function collectGengDays(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  let cur = fromIso
  while (cur <= toIso) {
    if (isGengDay(cur)) out.push(cur)
    cur = addDaysSeoul(cur, 1)
  }
  return out
}

function pushSamBok(
  map: Map<string, CalendarLabelEntry[]>,
  iso: string | undefined,
  name: string,
) {
  if (!iso) return
  map.set(iso, [{ name, kind: 'observance' }])
}

/**
 * 삼복 — 하지 이후 3·4번째 경일(초·중복), 입추 이후 첫 경일(말복)
 * @see 민족의학신문 등 전통 세시 기준
 */
export function getSamBokMapForYear(
  year: number,
): Map<string, CalendarLabelEntry[]> {
  let m = samBokCache.get(year)
  if (m) return m

  m = new Map()
  const haji = findSolarTermIso(year, '하지')
  const ipchu = findSolarTermIso(year, '입추')
  if (haji && ipchu) {
    const geng = collectGengDays(haji, addDaysSeoul(ipchu, 45))
    const gengOnOrAfterIpchu = geng.filter((iso) => iso >= ipchu)
    pushSamBok(m, geng[2], '초복')
    pushSamBok(m, geng[3], '중복')
    pushSamBok(m, gengOnOrAfterIpchu[0], '말복')
  }

  samBokCache.set(year, m)
  return m
}
