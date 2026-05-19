import { Fragment, useMemo, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import {
  useCommunityAuth,
  useCommunityBackendReadyMessage,
} from '../community/CommunityAuthContext'
import { communityBackendMode } from '../lib/communityBackend'
import { AppearanceMenu } from '../theme/AppearanceMenu'
import {
  AdminNavIcon,
  CommunityNavIcon,
  DiaryNavIcon,
  LedgerNavIcon,
} from './navIcons'
import { triggerSelectionHaptic } from '../lib/haptics'
import { useScrollHeaderVisibility } from './useScrollHeaderVisibility'

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

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

function desktopNavLinkClass({ isActive }: { isActive: boolean }) {
  const base =
    'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none transition-colors md:px-2.5 md:py-1 md:text-xs'
  return isActive
    ? `${base} bg-green-light text-green-accent theme2:bg-green-light theme2:text-midnight-ink theme3:bg-green-light theme3:text-starbucks-green`
    : `${base} text-text-soft hover:bg-well hover:text-text-primary`
}

function mobileNavLinkClass({ isActive }: { isActive: boolean }) {
  const base =
    'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-1 text-[11px] font-medium leading-tight transition-colors'
  return isActive
    ? `${base} text-green-accent theme2:text-green-accent theme3:text-green-accent`
    : `${base} text-text-soft active:bg-well/80`
}

const MAIN_NAV_ITEMS: NavItem[] = [
  { to: '/calendar', label: '다이어리', icon: <DiaryNavIcon /> },
  { to: '/', label: '가계부', icon: <LedgerNavIcon />, end: true },
  { to: '/community', label: '커뮤니티', icon: <CommunityNavIcon /> },
]

function DesktopMainNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="hidden min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto rounded-md border border-charcoal-border bg-surface-raised p-0.5 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] md:flex md:overflow-visible theme2:shadow-[var(--shadow-frap-base)] theme3:border-border-strong [&::-webkit-scrollbar]:hidden"
      aria-label="주 메뉴"
    >
      {items.map((item, index) => (
        <Fragment key={item.to}>
          {index > 0 ? (
            <span
              className="mx-0.5 h-3 w-px shrink-0 bg-charcoal-border/25 theme3:bg-border-strong/40"
              aria-hidden
            />
          ) : null}
          <NavLink to={item.to} end={item.end} className={desktopNavLinkClass}>
            {item.label}
          </NavLink>
        </Fragment>
      ))}
    </nav>
  )
}

function MobileBottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-muted bg-neutral-warm/95 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-2px_12px_rgb(0_0_0/0.06)] backdrop-blur-md md:hidden dark:shadow-[0_-2px_12px_rgb(0_0_0/0.35)]"
      aria-label="주 메뉴"
    >
      <div className="mx-auto flex min-h-14 max-w-5xl items-stretch">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={mobileNavLinkClass}
            onPointerDown={() => triggerSelectionHaptic()}
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-green-accent theme2:bg-green-accent theme3:bg-green-accent"
                    aria-hidden
                  />
                ) : null}
                <span className="flex shrink-0 items-center justify-center" aria-hidden>
                  {item.icon}
                </span>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function RootLayout() {
  const nav = useNavigate()
  const mode = communityBackendMode()
  const backendMsg = useCommunityBackendReadyMessage()
  const auth = useCommunityAuth()
  const headerVisible = useScrollHeaderVisibility()

  const navItems = useMemo<NavItem[]>(
    () => [
      ...MAIN_NAV_ITEMS,
      ...(auth.role === 'admin'
        ? [{ to: '/admin', label: '관리', icon: <AdminNavIcon /> }]
        : []),
    ],
    [auth.role],
  )

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
      <header
        className={[
          'sticky top-0 z-40 border-b border-border-muted bg-neutral-warm/90 backdrop-blur-md',
          'transition-transform duration-300 ease-out will-change-transform',
          headerVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none',
        ].join(' ')}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 py-2.5 md:justify-between md:px-6 md:py-3">
          <DesktopMainNav items={navItems} />
          <div className="flex flex-nowrap items-center justify-end gap-1 md:gap-2">
            <AppearanceMenu />
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

      <div className="pb-[calc(3.5rem+0.375rem+max(0.75rem,env(safe-area-inset-bottom,0px)))] md:pb-0">
        <Outlet />
      </div>

      <MobileBottomNav items={navItems} />
    </>
  )
}
