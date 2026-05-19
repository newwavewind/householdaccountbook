const KEY = 'gaegyeobu-calendar-lunar-view-v1'

export function loadCalendarLunarView(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveCalendarLunarView(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
