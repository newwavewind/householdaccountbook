import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { NicknameEditor } from '../components/settings/NicknameEditor'
import { SettingsSectionHeader } from '../components/settings/SettingsSectionHeader'
import { useCommunityAuth } from '../community/CommunityAuthContext'
import { communityBackendMode } from '../lib/communityBackend'
import { gradeLabel } from '../community/communityGrades'

export default function AccountSettingsPage() {
  const auth = useCommunityAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const mode = communityBackendMode()
  const returnTo =
    typeof loc.state === 'object' &&
    loc.state !== null &&
    'from' in loc.state &&
    typeof (loc.state as { from?: string }).from === 'string'
      ? (loc.state as { from: string }).from
      : null

  const handleSaved = () => {
    if (auth.needsNicknameSetup) {
      nav(returnTo || '/community', { replace: true })
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <SettingsSectionHeader
        title="회원 정보"
        description="커뮤니티·헤더에 보이는 익명 닉네임과 로그인 상태를 관리합니다."
      />

      {auth.loading ? (
        <p className="text-sm text-text-soft">불러오는 중…</p>
      ) : !auth.user ? (
        <Card className="space-y-4 border border-border-muted bg-surface-raised p-6 md:p-8">
          <p className="text-sm leading-relaxed text-text-soft">
            Google로 <strong className="text-text-primary">익명 로그인</strong>한 뒤 닉네임을 정하면
            커뮤니티에 글과 댓글을 남길 수 있습니다. 실명은 공개되지 않습니다.
          </p>
          <Button type="button" variant="primary" onClick={() => nav('/auth/setup')}>
            로그인 · 가입
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {auth.needsNicknameSetup ? (
            <Card className="border border-warning/40 bg-warning/10 p-4 text-sm text-text-primary">
              <p className="font-semibold text-warning">닉네임을 정해 주세요</p>
              <p className="mt-1 text-text-soft">
                커뮤니티 글·댓글을 쓰려면 아래에서 익명 닉네임을 저장해야 합니다.
              </p>
            </Card>
          ) : null}

          <Card className="space-y-5 border border-border-muted bg-surface-raised p-4 md:p-6">
            <section>
              <h2 className="text-base font-semibold text-text-primary">프로필</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[6rem_1fr]">
                <dt className="text-text-soft">닉네임</dt>
                <dd className="font-medium text-text-primary">
                  {auth.needsNicknameSetup ? '미설정' : auth.user.displayName}
                </dd>
                {auth.communityGrade > 0 ? (
                  <>
                    <dt className="text-text-soft">등급</dt>
                    <dd className="text-text-primary">{gradeLabel(auth.communityGrade)}</dd>
                  </>
                ) : null}
                {auth.role === 'admin' ? (
                  <>
                    <dt className="text-text-soft">권한</dt>
                    <dd className="text-text-primary">관리자</dd>
                  </>
                ) : null}
              </dl>
            </section>

            <section className="border-t border-border-muted pt-5">
              <h2 className="text-base font-semibold text-text-primary">닉네임 변경</h2>
              <p className="mt-1 text-sm text-text-soft">
                Google 계정 실명 대신 아래 닉네임만 표시됩니다.
              </p>
              <div className="mt-4">
                <NicknameEditor
                  initialNickname={auth.user.displayName}
                  submitLabel={auth.needsNicknameSetup ? '이 닉네임으로 시작하기' : '닉네임 저장'}
                  onSaved={handleSaved}
                />
              </div>
            </section>
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-3 border border-border-muted bg-surface-raised p-4 md:p-5">
            <div>
              <p className="text-sm font-semibold text-text-primary">로그인 세션</p>
              <p className="mt-0.5 text-xs text-text-soft">
                {mode === 'mock'
                  ? '데모 모드'
                  : mode === 'prisma'
                    ? '로컬 개발 로그인'
                    : 'Google 익명 로그인'}
              </p>
            </div>
            <Button type="button" variant="outlined" onClick={() => void auth.signOut()}>
              로그아웃
            </Button>
          </Card>

          {auth.role === 'admin' ? (
            <p className="text-center text-xs text-text-soft">
              <Link to="/admin" className="font-medium text-green-accent hover:underline">
                관리자 화면으로
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </main>
  )
}
