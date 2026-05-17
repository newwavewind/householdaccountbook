import { CALENDAR_MEMO_STORAGE_KEY } from '../calendar/calendarMemoStorage'
import { DDAYS_STORAGE_KEY } from '../dday/ddayStorage'

/** LedgerContext와 동일 키 */
const LEDGER_STORAGE_KEY = 'gaegyeobu-ledger-v1'
const HOUSEHOLD_MEMBERS_V1 = 'household-members-v1'
const HOUSEHOLD_MEMBERS_LEGACY = 'household-members'
const BULK_INPUT_DRAFT_KEY = 'bulk-input-draft-v2'

/** 로그아웃 후 이 브라우저에만 남은 가계부·일정 데이터 제거 */
export function clearLocalAppDataOnLogout(): void {
  if (typeof localStorage === 'undefined') return
  const keys = [
    LEDGER_STORAGE_KEY,
    CALENDAR_MEMO_STORAGE_KEY,
    DDAYS_STORAGE_KEY,
    HOUSEHOLD_MEMBERS_V1,
    HOUSEHOLD_MEMBERS_LEGACY,
    BULK_INPUT_DRAFT_KEY,
  ]
  for (const k of keys) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* quota / private mode */
    }
  }
}
