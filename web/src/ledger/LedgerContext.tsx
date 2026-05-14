import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Transaction } from '../types/transaction'
import { isValidTx, parseTransactionsPayload } from '../lib/ledgerValidation'
import { getSupabase, isCloudSyncEnabled, ledgerId } from '../lib/supabaseClient'
import { ledgerBackendMode } from '../lib/ledgerBackend'

const STORAGE_KEY = 'gaegyeobu-ledger-v1'

function txInCalendarMonth(
  tx: Transaction,
  calendarYear: number,
  monthIndex: number,
): boolean {
  const parts = tx.date.split('-').map(Number)
  return parts[0] === calendarYear && parts[1] === monthIndex + 1
}

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
  | { mode: 'local'; status: 'ready'; hint: 'login_required' }
  | {
      mode: 'cloud'
      cloudBackend: 'supabase' | 'prisma'
      status: 'loading' | 'ready' | 'error'
      errorMessage?: string
    }

type LedgerContextValue = {
  transactions: Transaction[]
  add: (tx: Omit<Transaction, 'id'> & { id?: string }) => void
  bulkAdd: (items: Omit<Transaction, 'id'>[]) => void
  replaceCalendarMonth: (
    calendarYear: number,
    monthIndex: number,
    replacements: Transaction[],
  ) => void
  update: (id: string, patch: Partial<Transaction>) => void
  remove: (id: string) => void
  replaceAll: (list: Transaction[]) => void
  clear: () => void
  syncState: LedgerSyncState
}

const LedgerContext = createContext<LedgerContextValue | null>(null)

export function LedgerProvider({ children }: { children: ReactNode }) {
  const backend = ledgerBackendMode()

  /** supabase 모드일 때 로그인한 사용자의 UID. null = 비로그인 */
  const [userId, setUserId] = useState<string | null>(null)
  /** supabase 모드에서 auth 초기 확인이 끝났는지 */
  const [authReady, setAuthReady] = useState(backend !== 'supabase')

  const [transactions, setTransactions] = useState<Transaction[]>(loadFromStorage)

  // supabase 모드: 로그인 상태에 따른 초기 syncState
  const [syncState, setSyncState] = useState<LedgerSyncState>(() => {
    if (backend === 'supabase' && isCloudSyncEnabled()) {
      return { mode: 'cloud', cloudBackend: 'supabase', status: 'loading' }
    }
    if (backend === 'prisma') {
      return { mode: 'cloud', cloudBackend: 'prisma', status: 'loading' }
    }
    return { mode: 'local', status: 'ready' }
  })

  const lastRemoteJsonRef = useRef<string | null>(null)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prismaPollSyncRef = useRef<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (syncState.mode === 'cloud' && syncState.cloudBackend === 'prisma') {
      prismaPollSyncRef.current = syncState.status
    }
  }, [syncState])

  // ── supabase 모드: auth 상태 감시 ─────────────────────────────────────────
  useEffect(() => {
    if (backend !== 'supabase') return
    const sb = getSupabase()
    if (!sb) {
      setAuthReady(true)
      return
    }

    void sb.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      setAuthReady(true)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [backend])

  // ── supabase 모드: userId 확정 후 DB 동기화 ────────────────────────────────
  useEffect(() => {
    if (backend !== 'supabase' || !authReady) return

    if (!isCloudSyncEnabled()) {
      setSyncState({ mode: 'local', status: 'ready' })
      return
    }

    if (!userId) {
      // 비로그인 → 로컬 모드, 힌트 표시
      setSyncState({ mode: 'local', status: 'ready', hint: 'login_required' } as LedgerSyncState)
      setTransactions(loadFromStorage())
      lastRemoteJsonRef.current = null
      return
    }

    const sb = getSupabase()
    if (!sb) {
      setSyncState({
        mode: 'cloud',
        cloudBackend: 'supabase',
        status: 'error',
        errorMessage: 'Supabase 클라이언트를 만들 수 없습니다.',
      })
      return
    }

    let cancelled = false
    const lid = userId

    setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'loading' })

    const applyPayload = (raw: unknown) => {
      const parsed = parseTransactionsPayload(raw)
      const j = JSON.stringify(parsed)
      lastRemoteJsonRef.current = j
      setTransactions(parsed)
      try { localStorage.setItem(STORAGE_KEY, j) } catch { /* quota */ }
    }

    void (async () => {
      const { data, error } = await sb
        .from('household_ledgers')
        .select('payload')
        .eq('id', lid)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'error', errorMessage: error.message })
        return
      }

      if (data?.payload != null) {
        const remoteParsed = parseTransactionsPayload(data.payload)
        const localParsed = loadFromStorage()
        // 원격이 비어 있고 로컬에 데이터가 있으면 → 로컬을 원격에 업로드
        if (remoteParsed.length === 0 && localParsed.length > 0) {
          const { error: upErr } = await sb.from('household_ledgers').upsert(
            { id: lid, payload: localParsed, updated_at: new Date().toISOString() },
            { onConflict: 'id' },
          )
          if (cancelled) return
          if (upErr) {
            setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'error', errorMessage: upErr.message })
            return
          }
          applyPayload(localParsed)
        } else {
          applyPayload(data.payload)
        }
        setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'ready' })
        return
      }

      // 원격에 행 없음 → 로컬 데이터로 첫 행 생성
      const initial = loadFromStorage()
      const { error: upErr } = await sb.from('household_ledgers').upsert(
        { id: lid, payload: initial, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      )
      if (cancelled) return
      if (upErr) {
        setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'error', errorMessage: upErr.message })
        return
      }
      applyPayload(initial)
      setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'ready' })
    })()

    const channel = sb
      .channel(`ledger-${lid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_ledgers', filter: `id=eq.${lid}` },
        (payload) => {
          const row = payload.new as { payload?: unknown } | undefined
          if (row?.payload == null) return
          const next = parseTransactionsPayload(row.payload)
          const j = JSON.stringify(next)
          if (j === lastRemoteJsonRef.current) return
          lastRemoteJsonRef.current = j
          setTransactions(next)
          try { localStorage.setItem(STORAGE_KEY, j) } catch { /* quota */ }
          setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'ready' })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void sb.removeChannel(channel)
    }
  }, [backend, authReady, userId])

  // ── prisma 모드: 폴링 동기화 (기존 로직 유지) ─────────────────────────────
  useEffect(() => {
    if (backend !== 'prisma') return
    let cancelled = false
    const lid = ledgerId()

    const applyPayload = (raw: unknown) => {
      const parsed = parseTransactionsPayload(raw)
      const j = JSON.stringify(parsed)
      lastRemoteJsonRef.current = j
      setTransactions(parsed)
      try { localStorage.setItem(STORAGE_KEY, j) } catch { /* quota */ }
    }

    const pushLocalToServer = async (initial: Transaction[]) => {
      const res = await fetch(`/api/ledgers/${encodeURIComponent(lid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: initial }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || res.statusText)
      }
    }

    void (async () => {
      try {
        const res = await fetch(`/api/ledgers/${encodeURIComponent(lid)}`)
        if (cancelled) return
        if (res.status === 404) {
          const initial = loadFromStorage()
          try { await pushLocalToServer(initial) } catch (e) {
            if (!cancelled) setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'error', errorMessage: e instanceof Error ? e.message : '장부를 만들지 못했습니다.' })
            return
          }
          if (cancelled) return
          applyPayload(initial)
          setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'ready' })
          return
        }
        if (!res.ok) {
          const t = await res.text().catch(() => '')
          if (!cancelled) setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'error', errorMessage: t || res.statusText })
          return
        }
        const data = (await res.json()) as { payload?: unknown }
        if (data.payload != null) {
          const remoteParsed = parseTransactionsPayload(data.payload)
          const localParsed = loadFromStorage()
          if (remoteParsed.length === 0 && localParsed.length > 0) {
            try { await pushLocalToServer(localParsed) } catch (e) {
              if (!cancelled) setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'error', errorMessage: e instanceof Error ? e.message : '동기화에 실패했습니다.' })
              return
            }
            if (cancelled) return
            applyPayload(localParsed)
          } else {
            applyPayload(data.payload)
          }
        }
        if (!cancelled) setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'ready' })
      } catch (e) {
        if (!cancelled) setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'error', errorMessage: e instanceof Error ? e.message : '서버에 연결하지 못했습니다.' })
      }
    })()

    const poll = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      if (prismaPollSyncRef.current !== 'ready') return
      try {
        const res = await fetch(`/api/ledgers/${encodeURIComponent(lid)}`)
        if (!res.ok || res.status === 404) return
        const data = (await res.json()) as { payload?: unknown }
        if (data.payload == null) return
        const next = parseTransactionsPayload(data.payload)
        const j = JSON.stringify(next)
        if (j === lastRemoteJsonRef.current) return
        lastRemoteJsonRef.current = j
        setTransactions(next)
        try { localStorage.setItem(STORAGE_KEY, j) } catch { /* quota */ }
      } catch { /* 네트워크 일시 오류 무시 */ }
    }

    const iv = setInterval(() => { void poll() }, 2800)
    const onVis = () => { void poll() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [backend])

  // ── 변경 시 원격에 push ────────────────────────────────────────────────────
  useEffect(() => {
    const j = JSON.stringify(transactions)
    try { localStorage.setItem(STORAGE_KEY, j) } catch { /* quota */ }

    const cloudEnabled = backend === 'supabase'
      ? (isCloudSyncEnabled() && userId !== null)
      : backend === 'prisma'

    if (!cloudEnabled) return
    if (syncState.mode !== 'cloud' || syncState.status === 'loading') return
    if (j === lastRemoteJsonRef.current) return

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)

    if (backend === 'supabase') {
      pushTimerRef.current = setTimeout(async () => {
        const sb = getSupabase()
        if (!sb || !userId) return
        const { error } = await sb.from('household_ledgers').upsert(
          { id: userId, payload: transactions, updated_at: new Date().toISOString() },
          { onConflict: 'id' },
        )
        if (error) {
          setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'error', errorMessage: error.message })
          return
        }
        lastRemoteJsonRef.current = j
        setSyncState({ mode: 'cloud', cloudBackend: 'supabase', status: 'ready' })
      }, 550)
    } else if (backend === 'prisma') {
      pushTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/ledgers/${encodeURIComponent(ledgerId())}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: transactions }),
          })
          if (!res.ok) {
            const t = await res.text().catch(() => '')
            setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'error', errorMessage: t || res.statusText })
            return
          }
          lastRemoteJsonRef.current = j
          setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'ready' })
        } catch (e) {
          setSyncState({ mode: 'cloud', cloudBackend: 'prisma', status: 'error', errorMessage: e instanceof Error ? e.message : '동기화에 실패했습니다.' })
        }
      }, 550)
    }

    return () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current) }
  }, [transactions, backend, userId, syncState])

  const add = useCallback((tx: Omit<Transaction, 'id'> & { id?: string }) => {
    setTransactions((prev) => [{ ...tx, id: tx.id ?? crypto.randomUUID() }, ...prev])
  }, [])

  const bulkAdd = useCallback((items: Omit<Transaction, 'id'>[]) => {
    if (items.length === 0) return
    setTransactions((prev) => [
      ...items.map((tx) => ({ ...tx, id: crypto.randomUUID() })),
      ...prev,
    ])
  }, [])

  const replaceCalendarMonth = useCallback(
    (calendarYear: number, monthIndex: number, replacements: Transaction[]) => {
      const next = replacements.filter(isValidTx)
      setTransactions((prev) => [
        ...next,
        ...prev.filter((t) => !txInCalendarMonth(t, calendarYear, monthIndex)),
      ])
    },
    [],
  )

  const update = useCallback((id: string, patch: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const remove = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const replaceAll = useCallback((list: Transaction[]) => {
    setTransactions(list.filter(isValidTx))
  }, [])

  const clear = useCallback(() => { setTransactions([]) }, [])

  const value = useMemo(
    (): LedgerContextValue => ({
      transactions, add, bulkAdd, replaceCalendarMonth, update, remove, replaceAll, clear, syncState,
    }),
    [transactions, add, bulkAdd, replaceCalendarMonth, update, remove, replaceAll, clear, syncState],
  )

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>
}

/* eslint-disable react-refresh/only-export-components -- Provider와 훅 동일 파일 */
export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext)
  if (!ctx) throw new Error('useLedger는 LedgerProvider 안에서만 사용하세요.')
  return ctx
}
