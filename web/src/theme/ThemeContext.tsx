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
  applyLiquidGlassToDocument,
  nextLiquidGlassMode,
  readLiquidGlassMode,
  writeLiquidGlassMode,
  type LiquidGlassMode,
} from './liquidGlassPreference'
import {
  applyThemeToDocument,
  readThemePreference,
  writeThemePreference,
  type ThemePreference,
} from './themePreference'

type ThemeContextValue = {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  liquidGlass: LiquidGlassMode
  setLiquidGlass: (mode: LiquidGlassMode) => void
  cycleLiquidGlass: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof document !== 'undefined' ? readThemePreference() : 'theme1',
  )
  const [liquidGlass, setLiquidGlassState] = useState<LiquidGlassMode>(() =>
    typeof document !== 'undefined' ? readLiquidGlassMode() : 'off',
  )

  useEffect(() => {
    applyThemeToDocument(preference)
  }, [preference])

  useEffect(() => {
    applyLiquidGlassToDocument(liquidGlass)
  }, [liquidGlass])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    writeThemePreference(p)
  }, [])

  const setLiquidGlass = useCallback((mode: LiquidGlassMode) => {
    setLiquidGlassState(mode)
    writeLiquidGlassMode(mode)
  }, [])

  const cycleLiquidGlass = useCallback(() => {
    setLiquidGlassState((prev) => {
      const next = nextLiquidGlassMode(prev)
      writeLiquidGlassMode(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      liquidGlass,
      setLiquidGlass,
      cycleLiquidGlass,
    }),
    [preference, setPreference, liquidGlass, setLiquidGlass, cycleLiquidGlass],
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

export function useLiquidGlass(): Pick<
  ThemeContextValue,
  'liquidGlass' | 'setLiquidGlass' | 'cycleLiquidGlass'
> {
  const { liquidGlass, setLiquidGlass, cycleLiquidGlass } = useThemePreference()
  return { liquidGlass, setLiquidGlass, cycleLiquidGlass }
}
