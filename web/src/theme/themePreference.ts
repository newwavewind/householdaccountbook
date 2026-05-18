export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'mj-gaegyeobu-theme-v1'

export function readThemePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system'
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* private mode */
  }
  return 'system'
}

export function writeThemePreference(pref: ThemePreference): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    /* quota */
  }
}

export function resolveTheme(
  pref: ThemePreference,
  systemDark: boolean,
): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref
  return systemDark ? 'dark' : 'light'
}

export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved === 'dark' ? 'dark' : 'light'
  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) {
    themeMeta.setAttribute(
      'content',
      resolved === 'dark' ? '#141816' : '#f2f0eb',
    )
  }
}
