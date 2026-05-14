import { isCloudSyncEnabled } from './supabaseClient'
// activeCloudLedgerBackend는 LedgerContext 외부에서도 참조할 수 있도록 유지

export type LedgerBackendMode = 'local' | 'prisma' | 'supabase'

export function ledgerBackendMode(): LedgerBackendMode {
  const raw = import.meta.env.VITE_LEDGER_BACKEND?.trim().toLowerCase()
  if (raw === 'supabase') return 'supabase'
  if (raw === 'prisma') return 'prisma'
  if (raw === 'local' || raw === 'off') return 'local'
  return 'local'
}

/** Prisma API 또는 Supabase 로 원격 동기화할지 여부 */
export function isLedgerRemoteSyncEnabled(): boolean {
  const b = ledgerBackendMode()
  if (b === 'prisma') return true
  if (b === 'supabase') return isCloudSyncEnabled()
  return false
}

export type CloudLedgerBackend = 'supabase' | 'prisma'

export function activeCloudLedgerBackend(): CloudLedgerBackend {
  return ledgerBackendMode() === 'prisma' ? 'prisma' : 'supabase'
}
