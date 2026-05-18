import { useMemo } from 'react'
import {
  CALENDAR_STICKY_NOTES_KEY,
  loadStickyNotes,
  parseStickyNotesPayload,
  saveStickyNotes,
  type CalendarStickyNote,
} from './calendarStickyNotesStorage'
import { useHouseholdJsonPayloadSync } from '../hooks/useHouseholdJsonPayloadSync'

export type StickerCloudStatus = 'off' | 'loading' | 'ready' | 'error'

function mergeStickyLists(a: CalendarStickyNote[], b: CalendarStickyNote[]): CalendarStickyNote[] {
  const map = new Map<string, CalendarStickyNote>()
  for (const n of a) map.set(n.id, n)
  for (const n of b) {
    const p = map.get(n.id)
    if (!p || n.updatedAt >= p.updatedAt) map.set(n.id, n)
  }
  return [...map.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
}

const stickerSyncOpts = {
  table: 'household_calendar_stickers' as const,
  channelPrefix: 'calendar-stickers',
  storageKey: CALENDAR_STICKY_NOTES_KEY,
  loadLocal: loadStickyNotes,
  saveLocal: saveStickyNotes,
  parseRemotePayload: (raw: unknown) => {
    if (raw == null) return []
    if (Array.isArray(raw)) return parseStickyNotesPayload(raw)
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>
      if (Array.isArray(o.notes)) return parseStickyNotesPayload(o.notes)
    }
    return parseStickyNotesPayload(raw)
  },
  toRemotePayload: (notes: CalendarStickyNote[]) => notes,
  merge: mergeStickyLists,
  isEmpty: (notes: CalendarStickyNote[]) => notes.length === 0,
}

export function useHouseholdCalendarStickers() {
  const sync = useHouseholdJsonPayloadSync(stickerSyncOpts)

  return useMemo(
    () => ({
      notes: sync.value,
      patchNotes: sync.patch,
      setNotes: sync.setValue,
      cloudStatus: sync.cloudStatus as StickerCloudStatus,
      cloudMessage: sync.cloudMessage,
      cloudEnabled: sync.cloudEnabled,
    }),
    [sync],
  )
}
