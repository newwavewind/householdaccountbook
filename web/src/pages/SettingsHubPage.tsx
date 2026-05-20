import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { SettingsSectionHeader } from '../components/settings/SettingsSectionHeader'

function SettingsChoiceCard({
  to,
  title,
  description,
  icon,
}: {
  to: string
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="group block rounded-[var(--radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-accent"
    >
      <Card className="flex items-start gap-4 border border-border-muted bg-surface-raised p-5 transition-colors hover:border-green-accent/50 hover:bg-green-light/20 md:p-6">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-ceramic/80 text-green-accent group-hover:border-green-accent/40"
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-base font-semibold text-text-primary md:text-lg">{title}</span>
            <span className="text-text-soft transition-transform group-hover:translate-x-0.5" aria-hidden>
              →
            </span>
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-text-soft">{description}</span>
        </span>
      </Card>
    </Link>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function TypeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V4h16v3M9 20h6M12 4v16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SettingsHubPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <SettingsSectionHeader
        title="설정"
        description="회원 정보와 메모·일정 표시 환경을 나누어 관리합니다."
        showBack={false}
      />

      <div className="grid gap-3 sm:gap-4">
        <SettingsChoiceCard
          to="/settings/account"
          title="회원 정보"
          description="익명 닉네임 변경, 로그인·로그아웃. 실명은 공개되지 않습니다."
          icon={<UserIcon />}
        />
        <SettingsChoiceCard
          to="/settings/appearance"
          title="환경 설정"
          description="달력 메모·일정 입력 시 기본 글꼴과 글자 크기를 정합니다."
          icon={<TypeIcon />}
        />
      </div>
    </main>
  )
}
