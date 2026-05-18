import { useMemo } from 'react'
import {
  DDAYS_STORAGE_KEY,
  loadDdays,
  parseDdaysPayload,
  saveDdays,
} from './ddayStorage'
import type { DdayEvent } from './ddayTypes'
import { mergeDdayLists } from './ddayMerge'
import { useHouseholdJsonPayloadSync } from '../hooks/useHouseholdJsonPayloadSync'

export type DdayCloudStatus = 'off' | 'loading' | 'ready' | 'error'

const ddaySyncOpts = {
  table: 'household_ddays' as const,
  channelPrefix: 'household-ddays',
  storageKey: DDAYS_STORAGE_KEY,
  loadLocal: loadDdays,
  saveLocal: saveDdays,
  parseRemotePayload: (raw: unknown) => parseDdaysPayload(raw),
  toRemotePayload: (events: DdayEvent[]) => ({ events }),
  merge: mergeDdayLists,
  isEmpty: (events: DdayEvent[]) => events.length === 0,
}

export function useHouseholdDDays() {
  const sync = useHouseholdJsonPayloadSync(ddaySyncOpts)

  return useMemo(
    () => ({
      events: sync.value,
      patchEvents: sync.patch,
      cloudStatus: sync.cloudStatus as DdayCloudStatus,
      cloudMessage: sync.cloudMessage,
      cloudEnabled: sync.cloudEnabled,
    }),
    [sync],
  )
}
