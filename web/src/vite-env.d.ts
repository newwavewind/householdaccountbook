/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** 공유 가계부 행 ID — Vercel·로컬에서 동일한 값으로 설정 */
  readonly VITE_LEDGER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
