import { Fragment } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import {
  useCommunityAuth,
  useCommunityBackendReadyMessage,
} from '../community/CommunityAuthContext'
import { communityBackendMode } from '../lib/communityBackend'
import { ThemeToggle } from '../theme/ThemeToggle'

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

function mainNavLinkClass({ isActive }: { isActive: boolean }) {
  const base =
    'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none transition-colors md:px-2.5 md:py-1 md:text-xs'
  return isActive
    ? `${base} bg-green-light text-green-accent theme2:bg-green-light theme2:text-midnight-ink theme3:bg-green-light theme3:text-starbucks-green`
    : `${base} text-text-soft hover:bg-well hover:text-text-primary`
}

const MAIN_NAV_ITEMS = [
  { to: '/calendar', label: '다이어리' },
  { to: '/', label: '가계부', end: true as const },
  { to: '/community', label: '커뮤니티' },
] as const

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
      <header className="sticky top-0 z-40 border-b border-border-muted bg-neutral-warm/90 backdrop-blur-md">
        <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 md:flex-wrap md:px-6 md:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-[5.25rem] md:min-w-0 md:flex-initial md:flex-wrap md:gap-4 md:overflow-visible md:pr-0">
            <nav
              className="flex min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto rounded-md border border-charcoal-border bg-surface-raised p-0.5 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] md:overflow-visible theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong [&::-webkit-scrollbar]:hidden"
              aria-label="주 메뉴"
            >
              {[
                ...MAIN_NAV_ITEMS,
                ...(auth.role === 'admin'
                  ? [{ to: '/admin' as const, label: '관리' }]
                  : []),
              ].map((item, index) => (
                <Fragment key={item.to}>
                  {index > 0 ? (
                    <span
                      className="mx-0.5 h-3 w-px shrink-0 bg-charcoal-border/25 theme3:bg-border-strong/40"
                      aria-hidden
                    />
                  ) : null}
                  <NavLink
                    to={item.to}
                    end={'end' in item ? item.end : undefined}
                    className={mainNavLinkClass}
                  >
                    {item.label}
                  </NavLink>
                </Fragment>
              ))}
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
