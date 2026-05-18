import { useCallback, useEffect, useRef, useState } from 'react'
import { useLedger } from './useLedger'
import { getSupabase, isCloudSyncEnabled } from '../lib/supabaseClient'
import { ledgerBackendMode } from '../lib/ledgerBackend'

export type HouseholdCloudStatus = 'off' | 'loading' | 'ready' | 'error'

function isRetriableSchemaError(message: string): boolean {
  return (
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export type HouseholdJsonTable =
  | 'household_calendar_memos'
  | 'household_ddays'
  | 'household_calendar_stickers'

type SyncOptions<T> = {
  table: HouseholdJsonTable
  channelPrefix: string
  loadLocal: () => T
  saveLocal: (value: T) => void
  parseRemotePayload: (raw: unknown) => T
  toRemotePayload: (value: T) => unknown
  merge: (remote: T, local: T) => T
  isEmpty: (value: T) => boolean
  /** localStorage 변경 감지용 (비동기 탭) */
  storageKey?: string
}

/**
 * 가구(household) 단위 JSON blob ↔ Supabase.
 * 로그인·가구·supabase 장부 모드일 때만 클라우드 동기화, 아니면 localStorage.
 */
export function useHouseholdJsonPayloadSync<T>(opts: SyncOptions<T>) {
  const { userId, householdId } = useLedger()
  const [value, setValue] = useState<T>(opts.loadLocal)
  const [cloudStatus, setCloudStatus] = useState<HouseholdCloudStatus>('off')
  const [cloudMessage, setCloudMessage] = useState<string | undefined>()

  const lastRemoteJsonRef = useRef<string | null>(null)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canSync =
    ledgerBackendMode() === 'supabase' &&
    isCloudSyncEnabled() &&
    !!userId &&
    !!householdId

  const persistLocal = useCallback(
    (next: T) => {
      if (!canSync) opts.saveLocal(next)
    },
    [canSync, opts],
  )

  useEffect(() => {
    if (!canSync) {
      setValue(opts.loadLocal())
      lastRemoteJsonRef.current = null
      setCloudStatus('off')
      setCloudMessage(undefined)
    }
  }, [canSync, opts])

  useEffect(() => {
    if (canSync || !opts.storageKey) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== opts.storageKey) return
      setValue(opts.loadLocal())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [canSync, opts])

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
          .from(opts.table)
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

      const remote =
        data?.payload != null ? opts.parseRemotePayload(data.payload) : opts.parseRemotePayload(null)
      const local = opts.loadLocal()
      const merged = opts.merge(remote, local)

      const noRow = data == null
      const remoteEmpty = opts.isEmpty(remote)
      const localNonempty = !opts.isEmpty(local)
      const shouldSeedRemote = noRow || (remoteEmpty && localNonempty)

      if (shouldSeedRemote) {
        let upErr: { message: string } | null = null
        const remotePayload = opts.toRemotePayload(merged)
        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) await sleep(500 * attempt)
          const res = await sb.from(opts.table).upsert(
            {
              id: hid,
              payload: remotePayload,
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
      setValue(merged)
      persistLocal(merged)
      setCloudStatus('ready')
      setCloudMessage(undefined)
    })()

    const channel = sb
      .channel(`${opts.channelPrefix}-${hid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: opts.table,
          filter: `id=eq.${hid}`,
        },
        (payload) => {
          const row = payload.new as { payload?: unknown } | undefined
          if (row?.payload == null) return
          const incoming = opts.parseRemotePayload(row.payload)
          setValue((prev) => {
            const merged = opts.merge(incoming, prev)
            const j = JSON.stringify(merged)
            if (j === lastRemoteJsonRef.current) return prev
            lastRemoteJsonRef.current = j
            persistLocal(merged)
            return merged
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void sb.removeChannel(channel)
    }
  }, [canSync, householdId, opts, persistLocal])

  useEffect(() => {
    if (!canSync || !householdId) return
    if (cloudStatus !== 'ready') return

    const j = JSON.stringify(value)
    if (j === lastRemoteJsonRef.current) return

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)

    pushTimerRef.current = setTimeout(async () => {
      const sb = getSupabase()
      if (!sb || !householdId) return
      const json = JSON.stringify(value)
      if (json === lastRemoteJsonRef.current) return

      const remotePayload = opts.toRemotePayload(value)
      let lastErr: { message: string } | null = null
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await sleep(500 * attempt)
        const { error } = await sb.from(opts.table).upsert(
          {
            id: householdId,
            payload: remotePayload,
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
  }, [value, canSync, householdId, cloudStatus, opts])

  const patch = useCallback(
    (fn: (prev: T) => T) => {
      setValue((prev) => {
        const next = fn(prev)
        persistLocal(next)
        return next
      })
    },
    [persistLocal],
  )

  return {
    value,
    setValue,
    patch,
    cloudStatus,
    cloudMessage,
    cloudEnabled: canSync,
  }
}
