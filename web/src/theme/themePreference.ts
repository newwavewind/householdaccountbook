export type ThemePreference = 'light' | 'dark' | 'system' | 'design2'

export const THEME_STORAGE_KEY = 'mj-gaegyeobu-theme-v1'

export function readThemePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system'
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (
      raw === 'light' ||
      raw === 'dark' ||
      raw === 'system' ||
      raw === 'design2'
    ) {
      return raw
    }
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

/** 라이트/다크 해석 — 디자인2는 항상 라이트 UI (DESIGN2.MD) */
export function resolveTheme(
  pref: ThemePreference,
  systemDark: boolean,
): 'light' | 'dark' {
  if (pref === 'design2') return 'light'
  if (pref === 'light' || pref === 'dark') return pref
  return systemDark ? 'dark' : 'light'
}

export function applyThemeToDocument(
  pref: ThemePreference,
  systemDark: boolean,
): void {
  const root = document.documentElement
  const resolved = resolveTheme(pref, systemDark)
  const isDesign2 = pref === 'design2'

  root.classList.toggle('design2', isDesign2)

  if (isDesign2) {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  } else {
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved === 'dark' ? 'dark' : 'light'
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) {
    if (isDesign2) {
      themeMeta.setAttribute('content', '#f5f5f5')
    } else {
      themeMeta.setAttribute(
        'content',
        resolved === 'dark' ? '#141816' : '#f2f0eb',
      )
    }
  }
}