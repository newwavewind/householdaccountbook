import { Navigate, useLocation } from 'react-router-dom'

/** @deprecated `/settings/account` 로 통합 — 기존 링크·가드 호환용 */
export default function NicknameSetupPage() {
  const loc = useLocation()
  return <Navigate to="/settings/account" replace state={loc.state} />
}
