/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** 공유 가계부 행 ID — Vercel·로컬에서 동일한 값으로 설정 */
  readonly VITE_LEDGER_ID?: string
  /**
   * 가계부 동기화.
   * - local(기본): 이 기기 localStorage 만
   * - prisma: 로컬 Express + SQLite (`npm run dev:full`)
   * - supabase: Supabase Postgres (배포용)
   */
  readonly VITE_LEDGER_BACKEND?: string
  /**
   * 커뮤니티 데이터 소스.
   * - 미설정: URL·anon 키가 있으면 supabase, 없으면 로컬 목업
   * - mock: 브라우저 목업
   * - prisma: 로컬 API + SQLite
   * - supabase: 실제 Auth·Postgres
   */
  readonly VITE_COMMUNITY_BACKEND?: string
  /**
   * Supabase에 넣은 것과 동일한 Google **웹** 클라이언트 ID (공개되어도 됨).
   * GIS 팝업 로그인(`signInWithIdToken`)용. Google Cloud → 승인된 JavaScript 원본에 앱 origin 필요.
   */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /**
   * Google GIS One Tap/FedCM. 로컬에서 `invalid_client`가 날 경우 끄거나(`false`) 두세요.
   * `true`로 두면 Chrome FedCM 경로를 씁니다.
   */
  readonly VITE_GOOGLE_GSI_USE_FEDCM?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
