export type ThemePreference = 'theme1' | 'theme2' | 'theme3'

export const THEME_STORAGE_KEY = 'mj-gaegyeobu-theme-v1'

function normalizeStoredTheme(raw: string | null): ThemePreference {
  if (raw === 'theme2' || raw === 'design2') return 'theme2'
  if (raw === 'theme3') return 'theme3'
  if (raw === 'theme1') return 'theme1'
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
  root.classList.toggle('theme2', pref === 'theme2')
  root.classList.toggle('theme3', pref === 'theme3')
  root.style.colorScheme = 'light'

  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) {
    if (pref === 'theme2') {
      themeMeta.setAttribute('content', '#f5f5f5')
    } else if (pref === 'theme3') {
      themeMeta.setAttribute('content', '#eeefe9')
    } else {
      themeMeta.setAttribute('content', '#f2f0eb')
    }
  }
}
