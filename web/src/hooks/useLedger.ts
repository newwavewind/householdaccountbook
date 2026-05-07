import { useCallback, useEffect, useRef, useState } from 'react'
import type { Transaction } from '../types/transaction'
import { isValidTx, parseTransactionsPayload } from '../lib/ledgerValidation'
import { getSupabase, isCloudSyncEnabled, ledgerId } from '../lib/supabaseClient'

const STORAGE_KEY = 'gaegyeobu-ledger-v1'

function loadFromStorage(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidTx)
  } catch {
    return []
  }
}

export type LedgerSyncState =
  | { mode: 'local'; status: 'ready' }
  | {
      mode: 'cloud'
      status: 'loading' | 'ready' | 'error'
      errorMessage?: string
    }

export function useLedger() {
  const cloud = isCloudSyncEnabled()
  const [transactions, setTransactions] = useState<Transaction[]>(loadFromStorage)
  const [syncState, setSyncState] = useState<LedgerSyncState>(() =>
    cloud ? { mode: 'cloud', status: 'loading' } : { mode: 'local', status: 'ready' },
  )

  const lastRemoteJsonRef = useRef<string | null>(null)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!cloud) return
    const sb = getSupabase()
    if (!sb) {
      setSyncState({
        mode: 'cloud',
        status: 'error',
        errorMessage: 'Supabase 클라이언트를 만들 수 없습니다.',
      })
      return
    }

    let cancelled = false
    const lid = ledgerId()

    const applyPayload = (raw: unknown) => {
      const parsed = parseTransactionsPayload(raw)
      const j = JSON.stringify(parsed)
      lastRemoteJsonRef.current = j
      setTransactions(parsed)
      try {
        localStorage.setItem(STORAGE_KEY, j)
      } catch {
        /* quota */
      }
    }

    ;(async () => {
      const { data, error } = await sb
        .from('household_ledgers')
        .select('payload')
        .eq('id', lid)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setSyncState({
          mode: 'cloud',
          status: 'error',
          errorMessage: error.message,
        })
        return
      }

      if (data != null && data.payload != null) {
        const remoteParsed = parseTransactionsPayload(data.payload)
        const localParsed = loadFromStorage()
        if (remoteParsed.length === 0 && localParsed.length > 0) {
          const { error: upErr } = await sb.from('household_ledgers').upsert(
            {
              id: lid,
              payload: localParsed,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
          )
          if (cancelled) return
          if (upErr) {
            setSyncState({
              mode: 'cloud',
              status: 'error',
              errorMessage: upErr.message,
            })
            return
          }
          applyPayload(localParsed)
        } else {
          applyPayload(data.payload)
        }
        setSyncState({ mode: 'cloud', status: 'ready' })
        return
      }

      const initial = loadFromStorage()
      const { error: upErr } = await sb.from('household_ledgers').upsert(
        {
          id: lid,
          payload: initial,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

      if (cancelled) return

      if (upErr) {
        setSyncState({
          mode: 'cloud',
          status: 'error',
          errorMessage: upErr.message,
        })
        return
      }

      applyPayload(initial)
      setSyncState({ mode: 'cloud', status: 'ready' })
    })()

    const channel = sb
      .channel(`ledger-${lid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'household_ledgers',
          filter: `id=eq.${lid}`,
        },
        (payload) => {
          const row = payload.new as { payload?: unknown } | undefined
          if (row?.payload === undefined || row.payload === null) return
          const next = parseTransactionsPayload(row.payload)
          const j = JSON.stringify(next)
          if (j === lastRemoteJsonRef.current) return
          lastRemoteJsonRef.current = j
          setTransactions(next)
          try {
            localStorage.setItem(STORAGE_KEY, j)
          } catch {
            /* quota */
          }
          setSyncState({ mode: 'cloud', status: 'ready' })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void sb.removeChannel(channel)
    }
  }, [cloud])

  useEffect(() => {
    const j = JSON.stringify(transactions)
    try {
      localStorage.setItem(STORAGE_KEY, j)
    } catch {
      /* quota */
    }

    if (!cloud) return
    if (syncState.status === 'loading') return
    if (j === lastRemoteJsonRef.current) return

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(async () => {
      const sb = getSupabase()
      if (!sb) return
      const { error } = await sb.from('household_ledgers').upsert(
        {
          id: ledgerId(),
          payload: transactions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      if (error) {
        setSyncState({
          mode: 'cloud',
          status: 'error',
          errorMessage: error.message,
        })
        return
      }
      lastRemoteJsonRef.current = j
      setSyncState({ mode: 'cloud', status: 'ready' })
    }, 550)

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    }
  }, [transactions, cloud, syncState.status])

  const add = useCallback(
    (tx: Omit<Transaction, 'id'> & { id?: string }) => {
      const full: Transaction = {
        ...tx,
        id: tx.id ?? crypto.randomUUID(),
      }
      setTransactions((prev) => [full, ...prev])
    },
    [],
  )

  const bulkAdd = useCallback((items: Omit<Transaction, 'id'>[]) => {
    if (items.length === 0) return
    setTransactions((prev) => [
      ...items.map((tx) => ({ ...tx, id: crypto.randomUUID() })),
      ...prev,
    ])
  }, [])

  const update = useCallback((id: string, patch: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const replaceAll = useCallback((list: Transaction[]) => {
    setTransactions(list.filter(isValidTx))
  }, [])

  const clear = useCallback(() => {
    setTransactions([])
  }, [])

  return {
    transactions,
    add,
    bulkAdd,
    update,
    remove,
    replaceAll,
    clear,
    syncState,
  }
}
