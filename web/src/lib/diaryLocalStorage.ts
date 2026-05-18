import { CALENDAR_MEMO_STORAGE_KEY } from '../calendar/calendarMemoStorage'
import {
  CALENDAR_STICKY_NOTES_KEY,
  CALENDAR_STICKY_VIEW_KEY,
} from '../calendar/calendarStickyNotesStorage'
import { DDAYS_STORAGE_KEY } from '../dday/ddayStorage'

const MIGRATION_FLAG_PREFIX = 'gaegyeobu-diary-cloud-migrated-'

export function diaryMigrationFlagKey(householdId: string): string {
  return `${MIGRATION_FLAG_PREFIX}${householdId}`
}

export function isDiaryMigratedForHousehold(householdId: string): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(diaryMigrationFlagKey(householdId)) === '1'
}

export function markDiaryMigratedForHousehold(householdId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(diaryMigrationFlagKey(householdId), '1')
  } catch {
    /* ignore */
  }
}

/** 일정·디데이·스티커 본문이 localStorage 에 남아 있는지 */
export function hasDiaryLocalPayload(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    const memo = localStorage.getItem(CALENDAR_MEMO_STORAGE_KEY)
    if (memo && memo !== '{}' && memo.trim().length > 2) return true
    const dday = localStorage.getItem(DDAYS_STORAGE_KEY)
    if (dday && !dday.includes('"events":[]') && dday.trim().length > 20) return true
    const sticky = localStorage.getItem(CALENDAR_STICKY_NOTES_KEY)
    if (sticky && sticky !== '[]' && sticky.trim().length > 2) return true
  } catch {
    return false
  }
  return false
}

/** 클라우드 마이그레이션 후 본문 키만 제거 (보기 모드 설정은 유지) */
export function clearDiaryLocalPayload(): void {
  if (typeof localStorage === 'undefined') return
  const keys = [CALENDAR_MEMO_STORAGE_KEY, DDAYS_STORAGE_KEY, CALENDAR_STICKY_NOTES_KEY]
  for (const k of keys) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  }
}

export { CALENDAR_STICKY_VIEW_KEY }
