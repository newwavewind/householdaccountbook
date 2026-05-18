import { useEffect, useRef } from 'react'
import { useLedger } from './useLedger'
import { ledgerBackendMode } from '../lib/ledgerBackend'
import { isCloudSyncEnabled } from '../lib/supabaseClient'
import {
  clearDiaryLocalPayload,
  hasDiaryLocalPayload,
  isDiaryMigratedForHousehold,
  markDiaryMigratedForHousehold,
} from '../lib/diaryLocalStorage'
import type { HouseholdCloudStatus } from './useHouseholdJsonPayloadSync'

/**
 * 로그인·가구 연결 후 세 항목이 모두 cloud ready 이면,
 * localStorage 에 남은 다이어리 본문을 한 번 비웁니다 (이미 Supabase 로 시드됨).
 */
export function useDiaryCloudMigration(
  householdId: string | null,
  statuses: {
    memos: HouseholdCloudStatus
    ddays: HouseholdCloudStatus
    stickers: HouseholdCloudStatus
  },
) {
  const { userId } = useLedger()
  const hadLocalOnMount = useRef(hasDiaryLocalPayload())

  const canSync =
    ledgerBackendMode() === 'supabase' &&
    isCloudSyncEnabled() &&
    !!userId &&
    !!householdId

  useEffect(() => {
    if (!canSync || !householdId) return
    if (isDiaryMigratedForHousehold(householdId)) return

    const allReady =
      statuses.memos === 'ready' &&
      statuses.ddays === 'ready' &&
      statuses.stickers === 'ready'

    if (!allReady) return

    if (hadLocalOnMount.current || hasDiaryLocalPayload()) {
      clearDiaryLocalPayload()
    }
    markDiaryMigratedForHousehold(householdId)
  }, [canSync, householdId, statuses.memos, statuses.ddays, statuses.stickers])
}
