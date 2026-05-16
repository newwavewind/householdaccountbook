import type { CalendarDayMemo } from './calendarMemoStorage'

/** 날짜별로 더 최근 updatedAt 을 가진 쪽을 남깁니다. */
export function mergeMemoMaps(
  a: Record<string, CalendarDayMemo>,
  b: Record<string, CalendarDayMemo>,
): Record<string, CalendarDayMemo> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: Record<string, CalendarDayMemo> = {}
  for (const k of keys) {
    const x = a[k]
    const y = b[k]
    if (!x) {
      if (y) out[k] = y
      continue
    }
    if (!y) {
      out[k] = x
      continue
    }
    out[k] = x.updatedAt >= y.updatedAt ? x : y
  }
  return out
}
