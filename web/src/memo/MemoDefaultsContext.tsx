import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  readMemoDefaults,
  writeMemoDefaults,
  type MemoDefaults,
} from './memoDefaultsStorage'

type MemoDefaultsContextValue = {
  defaults: MemoDefaults
  setDefaults: (next: MemoDefaults) => void
  patchDefaults: (patch: Partial<MemoDefaults>) => void
}

const MemoDefaultsContext = createContext<MemoDefaultsContextValue | null>(null)

export function MemoDefaultsProvider({ children }: { children: ReactNode }) {
  const [defaults, setDefaultsState] = useState<MemoDefaults>(() =>
    typeof window !== 'undefined' ? readMemoDefaults() : { fontFamily: '', fontSize: '' },
  )

  const setDefaults = useCallback((next: MemoDefaults) => {
    setDefaultsState(next)
    writeMemoDefaults(next)
  }, [])

  const patchDefaults = useCallback((patch: Partial<MemoDefaults>) => {
    setDefaultsState((prev) => {
      const next = { ...prev, ...patch }
      writeMemoDefaults(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ defaults, setDefaults, patchDefaults }),
    [defaults, setDefaults, patchDefaults],
  )

  return (
    <MemoDefaultsContext.Provider value={value}>
      {children}
    </MemoDefaultsContext.Provider>
  )
}

export function useMemoDefaults(): MemoDefaultsContextValue {
  const ctx = useContext(MemoDefaultsContext)
  if (!ctx) {
    throw new Error('useMemoDefaults must be used within MemoDefaultsProvider')
  }
  return ctx
}
