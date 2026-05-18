export type ThemePreference = 'theme1' | 'theme2'

export const THEME_STORAGE_KEY = 'mj-gaegyeobu-theme-v1'

function normalizeStoredTheme(raw: string | null): ThemePreference {
  if (raw === 'theme2' || raw === 'design2') return 'theme2'
  if (raw === 'theme1') return 'theme1'
  /* 이전: light / dark / system 등 → 테마1 */
  return 'theme1'
}

export function readThemePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'theme1'
  try {
    return normalizeStoredTheme(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'theme1'
  }
}

export function writeThemePreference(pref: ThemePreference): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    /* quota */
  }
}

export function applyThemeToDocument(pref: ThemePreference): void {
  const root = document.documentElement
  const isT2 = pref === 'theme2'

  root.classList.toggle('theme2', isT2)
  root.style.colorScheme = 'light'

  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) {
    themeMeta.setAttribute('content', isT2 ? '#f5f5f5' : '#f2f0eb')
  }
}
