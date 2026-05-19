export type LiquidGlassMode = 'off' | 'clear'

export const LIQUID_GLASS_STORAGE_KEY = 'mj-gaegyeobu-liquid-glass-v1'

const ORDER: LiquidGlassMode[] = ['off', 'clear']

export function normalizeLiquidGlassMode(raw: string | null): LiquidGlassMode {
  if (raw === 'clear' || raw === 'transparent') return 'clear'
  return 'off'
}

export function readLiquidGlassMode(): LiquidGlassMode {
  if (typeof localStorage === 'undefined') return 'off'
  try {
    return normalizeLiquidGlassMode(localStorage.getItem(LIQUID_GLASS_STORAGE_KEY))
  } catch {
    return 'off'
  }
}

export function writeLiquidGlassMode(mode: LiquidGlassMode): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LIQUID_GLASS_STORAGE_KEY, mode)
  } catch {
    /* quota */
  }
}

export function nextLiquidGlassMode(current: LiquidGlassMode): LiquidGlassMode {
  const i = ORDER.indexOf(current)
  return ORDER[(i + 1) % ORDER.length]!
}

export function applyLiquidGlassToDocument(mode: LiquidGlassMode): void {
  const root = document.documentElement
  const on = mode === 'clear'
  root.classList.toggle('liquid-glass', on)
  root.classList.toggle('liquid-glass-clear', on)
  root.classList.remove('liquid-glass-tint')
}
