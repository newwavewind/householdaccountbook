import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import {
  useCommunityAuth,
  useCommunityBackendReadyMessage,
} from '../community/CommunityAuthContext'
import { communityBackendMode } from '../lib/communityBackend'
import { useThemePreference } from '../theme/ThemeContext'
import { ThemeToggle } from '../theme/ThemeToggle'
import type { ThemePreference } from '../theme/themePreference'

function SettingsGearButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outlined"
      className="!min-h-0 !px-2 !py-0.5 !text-[10px] md:!px-2.5 md:!py-1"
      aria-label="환경 설정"
      title="환경 설정"
      onClick={onClick}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5 md:size-4"
        aria-hidden
      >
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    </Button>
  )
}

function navLinkClassName(
  theme: ThemePreference,
  { isActive }: { isActive: boolean },
) {
  const base =
    'shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 theme2:rounded-lg'
  if (theme === 'theme3') {
    return `${base} ${
      isActive
        ? 'bg-green-light text-midnight-ink shadow-[var(--shadow-frap-base)]'
        : 'text-faded-grey hover:bg-green-light/50 hover:text-midnight-ink'
    }`
  }
  return `${base} ${
    isActive
      ? 'bg-starbucks-green text-white shadow-[var(--shadow-frap-base)] ring-1 ring-starbucks-green/20 theme2:border theme2:border-charcoal-border theme2:bg-green-accent theme2:text-on-accent'
      : 'text-starbucks-green hover:bg-house-green/10 hover:shadow-sm theme2:hover:bg-green-light/50'
  }`
}

export default function RootLayout() {
  const { preference } = useThemePreference()
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
      <header className="sticky top-0 z-40 border-b border-border-muted bg-neutral-warm/90 backdrop-blur-md">
        <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 md:flex-wrap md:px-6 md:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-[5.25rem] md:min-w-0 md:flex-initial md:flex-wrap md:gap-4 md:overflow-visible md:pr-0">
            <nav
              className="flex min-w-0 flex-nowrap gap-1 overflow-x-auto rounded-2xl border border-border-subtle/60 bg-surface-raised/80 p-1 shadow-[var(--shadow-frap-base)] [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
              aria-label="주 메뉴"
            >
              <NavLink className={(p) => navLinkClassName(preference, p)} to="/calendar">
                다이어리
              </NavLink>
              <NavLink className={(p) => navLinkClassName(preference, p)} to="/">
                가계부
              </NavLink>
              <NavLink className={(p) => navLinkClassName(preference, p)} to="/community">
                커뮤니티
              </NavLink>
              {auth.role === 'admin' ? (
                <NavLink className={(p) => navLinkClassName(preference, p)} to="/admin">
                  관리
                </NavLink>
              ) : null}
            </nav>
          </div>
          <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-nowrap items-center justify-end gap-1 md:static md:z-0 md:translate-y-0 md:gap-2">
            <ThemeToggle />
            <SettingsGearButton onClick={() => nav('/settings')} />
            {authControls}
          </div>
        </div>
        {backendMsg ? (
          <p className="border-t border-dashed border-border-subtle px-4 py-2 text-center text-xs text-warning">
            {backendMsg}
          </p>
        ) : null}
      </header>
      <Outlet />
    </>
  )
}
