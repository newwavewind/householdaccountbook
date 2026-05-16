import { useCallback, useEffect, useRef, useState } from 'react'
import { useLedger } from '../hooks/useLedger'
import { getSupabase, isCloudSyncEnabled } from '../lib/supabaseClient'
import { ledgerBackendMode } from '../lib/ledgerBackend'
import {
  CALENDAR_MEMO_STORAGE_KEY,
  loadCalendarMemos,
  parseMemoMapPayload,
  saveCalendarMemos,
} from './calendarMemoStorage'
import { mergeMemoMaps } from './calendarMemoMerge'
import type { CalendarDayMemo } from './calendarMemoStorage'

export type CalendarCloudStatus =
  | 'off'
  | 'loading'
  | 'ready'
  | 'error'

type MemoMap = Record<string, CalendarDayMemo>

function isRetriableSchemaError(message: string): boolean {
  return (
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function useHouseholdCalendarMemos() {
  const { userId, householdId } = useLedger()
  const [memos, setMemos] = useState(loadCalendarMemos)
  const [cloudStatus, setCloudStatus] = useState<CalendarCloudStatus>('off')
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
      setMemos(loadCalendarMemos())
      lastRemoteJsonRef.current = null
      setCloudStatus('off')
      setCloudMessage(undefined)
    }
  }, [canSync])

  useEffect(() => {
    if (canSync) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CALENDAR_MEMO_STORAGE_KEY) return
      setMemos(loadCalendarMemos())
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
          .from('household_calendar_memos')
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

      const remoteMap =
        data?.payload != null ? parseMemoMapPayload(data.payload) : {}
      const localMap = loadCalendarMemos()
      const merged = mergeMemoMaps(remoteMap, localMap)

      const noRow = data == null
      const remoteEmpty = Object.keys(remoteMap).length === 0
      const localNonempty = Object.keys(localMap).length > 0
      const shouldSeedRemote = noRow || (remoteEmpty && localNonempty)

      if (shouldSeedRemote) {
        let upErr: { message: string } | null = null
        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) await sleep(500 * attempt)
          const res = await sb
            .from('household_calendar_memos')
            .upsert(
              {
                id: hid,
                payload: merged,
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

      const j = JSON.stringify(merged)
      lastRemoteJsonRef.current = j
      setMemos(merged)
      saveCalendarMemos(merged)
      setCloudStatus('ready')
      setCloudMessage(undefined)
    })()

    const channel = sb
      .channel(`calendar-memos-${hid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'household_calendar_memos',
          filter: `id=eq.${hid}`,
        },
        (payload) => {
          const row = payload.new as { payload?: unknown } | undefined
          if (row?.payload == null) return
          const incoming = parseMemoMapPayload(row.payload)
          setMemos((prev) => {
            const merged = mergeMemoMaps(incoming, prev)
            const j = JSON.stringify(merged)
            if (j === lastRemoteJsonRef.current) return prev
            lastRemoteJsonRef.current = j
            saveCalendarMemos(merged)
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

    const j = JSON.stringify(memos)
    if (j === lastRemoteJsonRef.current) return

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)

    pushTimerRef.current = setTimeout(async () => {
      const sb = getSupabase()
      if (!sb || !householdId) return
      const payloadJson = JSON.stringify(memos)
      if (payloadJson === lastRemoteJsonRef.current) return

      let lastErr: { message: string } | null = null
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await sleep(500 * attempt)
        const { error } = await sb
          .from('household_calendar_memos')
          .upsert(
            {
              id: householdId,
              payload: memos,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
          )
        if (!error) {
          lastRemoteJsonRef.current = payloadJson
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
  }, [memos, canSync, householdId])

  const patchMemos = useCallback((fn: (prev: MemoMap) => MemoMap) => {
    setMemos((prev) => {
      const next = fn(prev)
      saveCalendarMemos(next)
      return next
    })
  }, [])

  return {
    memos,
    patchMemos,
    cloudStatus,
    cloudMessage,
    cloudEnabled: canSync,
  }
}
