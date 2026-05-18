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
  writeThemePreference,
  type ThemePreference,
} from './themePreference'

type ThemeContextValue = {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof document !== 'undefined' ? readThemePreference() : 'theme1',
  )

  useEffect(() => {
    applyThemeToDocument(preference)
  }, [preference])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    writeThemePreference(p)
  }, [])

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
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
