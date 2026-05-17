import type { DdayEvent } from './ddayTypes'

export function mergeDdayLists(a: DdayEvent[], b: DdayEvent[]): DdayEvent[] {
  const map = new Map<string, DdayEvent>()
  for (const e of a) map.set(e.id, e)
  for (const e of b) {
    const prev = map.get(e.id)
    if (!prev || e.updatedAt >= prev.updatedAt) map.set(e.id, e)
  }
  return [...map.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
}
