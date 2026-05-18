import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import {
  useCommunityAuth,
  useCommunityBackendReadyMessage,
} from '../community/CommunityAuthContext'
import { communityBackendMode } from '../lib/communityBackend'

const navCls = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${isActive ? 'bg-green-accent text-white' : 'text-starbucks-green hover:bg-green-light/50'}`

export default function RootLayout() {
  const nav = useNavigate()
  const mode = communityBackendMode()
  const backendMsg = useCommunityBackendReadyMessage()
  const auth = useCommunityAuth()

  const authControls = (
    <>
      {mode === 'mock' || mode === 'prisma' ? (
        <>
          {auth.user ? (
            <>
              <span className="max-w-[5.5rem] truncate text-[10px] leading-tight text-text-soft md:max-w-[12rem] md:text-xs">
                {auth.user.displayName}
              </span>
              <Button
                type="button"
                variant="outlined"
                className="!min-h-0 !px-2 !py-0.5 !text-[10px] md:!px-3 md:!py-1 md:!text-xs"
                onClick={() => void auth.signOut()}
              >
                로그아웃
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="primary"
              className="!min-h-0 !px-2 !py-0.5 !text-[10px] md:!px-3 md:!py-1 md:!text-xs"
              onClick={() => nav('/auth/setup')}
            >
              {mode === 'prisma' ? '로컬 로그인' : 'Google 로그인 안내'}
            </Button>
          )}
        </>
      ) : auth.user ? (
        <>
          <span className="max-w-[5.5rem] truncate text-[10px] leading-tight text-text-soft md:max-w-[12rem] md:text-xs">
            {auth.user.displayName}
          </span>
          <Button
            type="button"
            variant="outlined"
            className="!min-h-0 !px-2 !py-0.5 !text-[10px] md:!px-3 md:!py-1 md:!text-xs"
            onClick={() => void auth.signOut()}
          >
            로그아웃
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="primary"
          className="!min-h-0 !px-2 !py-0.5 !text-[10px] md:!px-3 md:!py-1 md:!text-xs"
          disabled={!!backendMsg}
          aria-label="로그인 또는 가입 화면으로 이동"
          onClick={() => nav('/auth/setup')}
        >
          로그인 · 가입
        </Button>
      )}
    </>
  )

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-neutral-warm/95 backdrop-blur-sm">
        <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2 md:flex-wrap md:px-6 md:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-[5.25rem] md:min-w-0 md:flex-initial md:flex-wrap md:gap-4 md:overflow-visible md:pr-0">
            <nav
              className="flex min-w-0 flex-nowrap gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
              aria-label="주 메뉴"
            >
              <NavLink className={navCls} to="/calendar">
                다이어리
              </NavLink>
              <NavLink className={navCls} to="/">
                가계부
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
          <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-nowrap items-center justify-end gap-1 md:static md:z-0 md:translate-y-0 md:gap-2">
            {authControls}
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
