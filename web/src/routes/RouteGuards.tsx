import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useCommunityAuth } from '../community/CommunityAuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useCommunityAuth()
  const loc = useLocation()
  if (loading) return <p className="px-4 py-8 text-center text-sm text-text-soft">불러오는 중…</p>
  if (!user) {
    return <Navigate to="/auth/setup" replace state={{ from: loc.pathname }} />
  }
  return <>{children}</>
}

export function RequireNickname({ children }: { children: ReactNode }) {
  const { user, loading, needsNicknameSetup } = useCommunityAuth()
  const loc = useLocation()
  if (loading) return <p className="px-4 py-8 text-center text-sm text-text-soft">불러오는 중…</p>
  if (!user) {
    return <Navigate to="/auth/setup" replace state={{ from: loc.pathname }} />
  }
  if (needsNicknameSetup) {
    return <Navigate to="/settings/account" replace state={{ from: loc.pathname }} />
  }
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, role } = useCommunityAuth()
  const loc = useLocation()
  if (loading) return <p className="px-4 py-8 text-center text-sm text-text-soft">불러오는 중…</p>
  if (!user) {
    return <Navigate to="/auth/setup" replace state={{ from: loc.pathname }} />
  }
  if (role !== 'admin') {
    return <Navigate to="/community" replace state={{ from: loc.pathname }} />
  }
  return <>{children}</>
}
