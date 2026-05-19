export type MemoDefaults = {
  fontFamily: string
  fontSize: string
}

const KEY = 'gaegyeobu-memo-defaults-v1'

export const DEFAULT_MEMO_DEFAULTS: MemoDefaults = {
  fontFamily: '',
  fontSize: '',
}

export function readMemoDefaults(): MemoDefaults {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_MEMO_DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<MemoDefaults>
    return {
      fontFamily:
        typeof parsed.fontFamily === 'string' ? parsed.fontFamily : '',
      fontSize: typeof parsed.fontSize === 'string' ? parsed.fontSize : '',
    }
  } catch {
    return { ...DEFAULT_MEMO_DEFAULTS }
  }
}

export function writeMemoDefaults(next: MemoDefaults): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
