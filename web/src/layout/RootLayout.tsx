import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import {
  useCommunityAuth,
  useCommunityBackendReadyMessage,
} from '../community/CommunityAuthContext'
import { communityBackendMode } from '../lib/communityBackend'

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${isActive ? 'bg-green-accent text-white' : 'text-starbucks-green hover:bg-green-light/50'}`

export default function RootLayout() {
  const nav = useNavigate()
  const mode = communityBackendMode()
  const backendMsg = useCommunityBackendReadyMessage()
  const auth = useCommunityAuth()

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-neutral-warm/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <NavLink to="/" className="font-serif-display text-lg font-semibold text-starbucks-green">
              가계부
            </NavLink>
            <nav className="flex flex-wrap gap-1" aria-label="주 메뉴">
              <NavLink className={navCls} to="/input">
                입력
              </NavLink>
              <NavLink className={navCls} to="/">
                장부
              </NavLink>
              <NavLink className={navCls} to="/community">
                커뮤니티
              </NavLink>
              {auth.role === 'admin' ? (
                <NavLink className={navCls} to="/admin">
                  관리
                </NavLink>
              ) : null}
            </nav>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === 'mock' || mode === 'prisma' ? (
              <>
                {auth.user ? (
                  <>
                    <span className="max-w-[12rem] truncate text-xs text-text-soft">
                      {auth.user.displayName}
                    </span>
                    <Button
                      type="button"
                      variant="outlined"
                      className="!px-3 !py-1 !text-xs"
                      onClick={() => void auth.signOut()}
                    >
                      로그아웃
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    className="!px-3 !py-1 !text-xs"
                    onClick={() => nav('/auth/setup')}
                  >
                    {mode === 'prisma' ? '로컬 로그인' : 'Google 로그인 안내'}
                  </Button>
                )}
              </>
            ) : auth.user ? (
              <>
                <span className="max-w-[12rem] truncate text-xs text-text-soft">
                  {auth.user.displayName}
                </span>
                <Button
                  type="button"
                  variant="outlined"
                  className="!px-3 !py-1 !text-xs"
                  onClick={() => void auth.signOut()}
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="primary"
                className="!px-3 !py-1 !text-xs"
                disabled={!!backendMsg}
                aria-label="로그인 또는 가입 화면으로 이동"
                onClick={() => nav('/auth/setup')}
              >
                로그인 · 가입
              </Button>
            )}
          </div>
        </div>
        {backendMsg ? (
          <p className="border-t border-dashed border-black/[0.08] px-4 py-2 text-center text-xs text-warning">
            {backendMsg}
          </p>
        ) : null}
      </header>
      <Outlet />
    </>
  )
}
