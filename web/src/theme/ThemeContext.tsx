import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyThemeToDocument,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from './themePreference'

type ThemeContextValue = {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  resolved: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof document !== 'undefined' ? readThemePreference() : 'system',
  )
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  )

  const resolved = useMemo(
    () => resolveTheme(preference, systemDark),
    [preference, systemDark],
  )

  useEffect(() => {
    applyThemeToDocument(preference, systemDark)
  }, [preference, systemDark])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    writeThemePreference(p)
  }, [])

  const value = useMemo(
    () => ({ preference, setPreference, resolved }),
    [preference, setPreference, resolved],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useThemePreference(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemePreference must be used within ThemeProvider')
  }
  return ctx
}
