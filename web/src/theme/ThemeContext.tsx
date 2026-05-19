import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { applyAppearance } from './applyAppearance'
import {
  readColorScheme,
  writeColorScheme,
  type ColorScheme,
} from './colorSchemePreference'
import {
  readLiquidGlassMode,
  writeLiquidGlassMode,
  type LiquidGlassMode,
} from './liquidGlassPreference'
import {
  readThemePreference,
  writeThemePreference,
  type ThemePreference,
} from './themePreference'

type ThemeContextValue = {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  liquidGlass: LiquidGlassMode
  setLiquidGlass: (mode: LiquidGlassMode) => void
  colorScheme: ColorScheme
  setColorScheme: (scheme: ColorScheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof document !== 'undefined' ? readThemePreference() : 'theme1',
  )
  const [liquidGlass, setLiquidGlassState] = useState<LiquidGlassMode>(() =>
    typeof document !== 'undefined' ? readLiquidGlassMode() : 'off',
  )
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() =>
    typeof document !== 'undefined' ? readColorScheme() : 'light',
  )

  useEffect(() => {
    applyAppearance(preference, liquidGlass, colorScheme)
  }, [preference, liquidGlass, colorScheme])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    writeThemePreference(p)
  }, [])

  const setLiquidGlass = useCallback((mode: LiquidGlassMode) => {
    setLiquidGlassState(mode)
    writeLiquidGlassMode(mode)
  }, [])

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme)
    writeColorScheme(scheme)
  }, [])

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      liquidGlass,
      setLiquidGlass,
      colorScheme,
      setColorScheme,
    }),
    [preference, liquidGlass, colorScheme],
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
