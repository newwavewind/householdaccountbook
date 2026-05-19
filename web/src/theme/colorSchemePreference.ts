export type ColorScheme = 'light' | 'dark'

export const COLOR_SCHEME_STORAGE_KEY = 'mj-gaegyeobu-color-scheme-v1'

export function readColorScheme(): ColorScheme {
  if (typeof localStorage === 'undefined') return 'light'
  try {
    const v = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)
    return v === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function writeColorScheme(scheme: ColorScheme): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme)
  } catch {
    /* quota */
  }
}

const THEME_COLOR_LIGHT: Record<string, string> = {
  theme1: '#f2f0eb',
  theme2: '#f5f5f5',
  theme3: '#eeefe9',
}

const THEME_COLOR_DARK: Record<string, string> = {
  theme1: '#141414',
  theme2: '#121212',
  theme3: '#131816',
}

export function applyColorSchemeToDocument(
  scheme: ColorScheme,
  themeKey: 'theme1' | 'theme2' | 'theme3',
): void {
  const root = document.documentElement
  const dark = scheme === 'dark'
  root.classList.toggle('dark', dark)
  root.style.colorScheme = scheme

  const metaScheme = document.querySelector('meta[name="color-scheme"]')
  if (metaScheme) metaScheme.setAttribute('content', scheme)

  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) {
    const map = dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
    themeMeta.setAttribute('content', map[themeKey] ?? map.theme1)
  }
}
