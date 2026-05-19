import { applyLiquidGlassToDocument, type LiquidGlassMode } from './liquidGlassPreference'
import { applyColorSchemeToDocument, type ColorScheme } from './colorSchemePreference'
import { applyThemeToDocument, type ThemePreference } from './themePreference'

export function applyAppearance(
  preference: ThemePreference,
  liquidGlass: LiquidGlassMode,
  colorScheme: ColorScheme,
): void {
  applyThemeToDocument(preference)
  applyLiquidGlassToDocument(liquidGlass)
  applyColorSchemeToDocument(colorScheme, preference)
}
