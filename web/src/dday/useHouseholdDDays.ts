import { useCallback, useEffect, useRef, useState } from 'react'
import { useLedger } from '../hooks/useLedger'
import { getSupabase, isCloudSyncEnabled } from '../lib/supabaseClient'
import { ledgerBackendMode } from '../lib/ledgerBackend'
import {
  DDAYS_STORAGE_KEY,
  loadDdays,
  parseDdaysPayload,
  saveDdays,
  type DdaysPayload,
} from './ddayStorage'
import type { DdayEvent } from './ddayTypes'
import { mergeDdayLists } from './ddayMerge'

export type DdayCloudStatus = 'off' | 'loading' | 'ready' | 'error'

function isRetriableSchemaError(message: string): boolean {
  return (
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function payloadJson(events: DdayEvent[]): string {
  return JSON.stringify({ events } satisfies DdaysPayload)
}

export function useHouseholdDDays() {
  const { userId, householdId } = useLedger()
  const [events, setEvents] = useState<DdayEvent[]>(loadDdays)
  const [cloudStatus, setCloudStatus] = useState<DdayCloudStatus>('off')
  const [cloudMessage, setCloudMessage] = useState<string | undefined>()

  const lastRemoteJsonRef = useRef<string | null>(null)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canSync =
    ledgerBackendMode() === 'supabase' &&
    isCloudSyncEnabled() &&
    !!userId &&
    !!householdId

  useEffect(() => {
    if (!canSync) {
      setEvents(loadDdays())
      lastRemoteJsonRef.current = null
      setCloudStatus('off')
      setCloudMessage(undefined)
    }
  }, [canSync])

  useEffect(() => {
    if (!canSync) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DDAYS_STORAGE_KEY) return
      setEvents(loadDdays())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [canSync])

  useEffect(() => {
    if (!canSync || !householdId) return
    const sb = getSupabase()
    if (!sb) {
      setCloudStatus('error')
      setCloudMessage('Supabase 클라이언트를 만들 수 없습니다.')
      return
    }

    let cancelled = false
    const hid = householdId

    void (async () => {
      setCloudStatus('loading')
      let data: { payload: unknown } | null = null
      let error: { message: string } | null = null

      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await sleep(500 * attempt)
        const res = await sb
          .from('household_ddays')
          .select('payload')
          .eq('id', hid)
          .maybeSingle()
        if (!res.error) {
          data = res.data
          error = null
          break
        }
        error = res.error
        if (!isRetriableSchemaError(res.error.message)) break
      }

      if (cancelled) return

      if (error) {
        setCloudStatus('error')
        setCloudMessage(error.message)
        return
      }

      const remoteList =
        data?.payload != null
          ? parseDdaysPayload(data.payload as unknown)
          : []
      const localList = loadDdays()
      const merged = mergeDdayLists(remoteList, localList)

      const noRow = data == null
      const remoteEmpty = remoteList.length === 0
      const localNonempty = localList.length > 0
      const shouldSeedRemote = noRow || (remoteEmpty && localNonempty)

      if (shouldSeedRemote) {
        let upErr: { message: string } | null = null
        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) await sleep(500 * attempt)
          const res = await sb.from('household_ddays').upsert(
            {
              id: hid,
              payload: { events: merged },
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
          )
          if (!res.error) {
            upErr = null
            break
          }
          upErr = res.error
          if (!isRetriableSchemaError(res.error.message)) break
        }
        if (cancelled) return
        if (upErr) {
          setCloudStatus('error')
          setCloudMessage(upErr.message)
          return
        }
      }

      const j = payloadJson(merged)
      lastRemoteJsonRef.current = j
      setEvents(merged)
      saveDdays(merged)
      setCloudStatus('ready')
      setCloudMessage(undefined)
    })()

    const channel = sb
      .channel(`household-ddays-${hid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'household_ddays',
          filter: `id=eq.${hid}`,
        },
        (payload) => {
          const row = payload.new as { payload?: unknown } | undefined
          if (row?.payload == null) return
          const incoming = parseDdaysPayload(row.payload)
          setEvents((prev) => {
            const merged = mergeDdayLists(incoming, prev)
            const j = payloadJson(merged)
            if (j === lastRemoteJsonRef.current) return prev
            lastRemoteJsonRef.current = j
            saveDdays(merged)
            return merged
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void sb.removeChannel(channel)
    }
  }, [canSync, householdId])

  useEffect(() => {
    if (!canSync || !householdId) return

    const j = payloadJson(events)
    if (j === lastRemoteJsonRef.current) return

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)

    pushTimerRef.current = setTimeout(async () => {
      const sb = getSupabase()
      if (!sb || !householdId) return
      const json = payloadJson(events)
      if (json === lastRemoteJsonRef.current) return

      let lastErr: { message: string } | null = null
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await sleep(500 * attempt)
        const { error } = await sb.from('household_ddays').upsert(
          {
            id: householdId,
            payload: { events },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        if (!error) {
          lastRemoteJsonRef.current = json
          setCloudStatus('ready')
          setCloudMessage(undefined)
          return
        }
        lastErr = error
        if (!isRetriableSchemaError(error.message)) break
      }
      if (lastErr) {
        setCloudStatus('error')
        setCloudMessage(lastErr.message)
      }
    }, 550)

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    }
  }, [events, canSync, householdId])

  const patchEvents = useCallback((fn: (prev: DdayEvent[]) => DdayEvent[]) => {
    setEvents((prev) => {
      const next = fn(prev)
      saveDdays(next)
      return next
    })
  }, [])

  return {
    events,
    patchEvents,
    cloudStatus,
    cloudMessage,
    cloudEnabled: canSync,
  }
}
