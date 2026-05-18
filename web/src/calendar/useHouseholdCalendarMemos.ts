import { useMemo } from 'react'
import {
  CALENDAR_MEMO_STORAGE_KEY,
  loadCalendarMemos,
  parseMemoMapPayload,
  saveCalendarMemos,
  type CalendarDayMemo,
} from './calendarMemoStorage'
import { mergeMemoMaps } from './calendarMemoMerge'
import { useHouseholdJsonPayloadSync } from '../hooks/useHouseholdJsonPayloadSync'

export type CalendarCloudStatus = 'off' | 'loading' | 'ready' | 'error'

type MemoMap = Record<string, CalendarDayMemo>

const memoSyncOpts = {
  table: 'household_calendar_memos' as const,
  channelPrefix: 'calendar-memos',
  storageKey: CALENDAR_MEMO_STORAGE_KEY,
  loadLocal: loadCalendarMemos,
  saveLocal: saveCalendarMemos,
  parseRemotePayload: (raw: unknown) => parseMemoMapPayload(raw),
  toRemotePayload: (v: MemoMap) => v,
  merge: mergeMemoMaps,
  isEmpty: (v: MemoMap) => Object.keys(v).length === 0,
}

export function useHouseholdCalendarMemos() {
  const sync = useHouseholdJsonPayloadSync(memoSyncOpts)

  return useMemo(
    () => ({
      memos: sync.value,
      patchMemos: sync.patch,
      cloudStatus: sync.cloudStatus as CalendarCloudStatus,
      cloudMessage: sync.cloudMessage,
      cloudEnabled: sync.cloudEnabled,
    }),
    [sync],
  )
}
