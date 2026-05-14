import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useCommunityAuth } from '../community/CommunityAuthContext'
import { communityBackendMode } from '../lib/communityBackend'
import { getCommunitySupabase, isCommunitySupabaseConfigured } from '../lib/communitySupabaseClient'
import {
  probeGoogleOAuth,
  supabaseAuthV1CallbackUrl,
  supabaseProjectRefFromUrl,
} from '../lib/supabaseOAuthProbe'

function GoogleMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function SupabaseLoginScreen() {
  const auth = useCommunityAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [oauthProbe, setOauthProbe] = useState<
    'pending' | 'ready' | 'google_off' | 'redirect' | 'other'
  >('pending')

  const projectRef = supabaseProjectRefFromUrl(import.meta.env.VITE_SUPABASE_URL)
  const dashboardProvidersUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/auth/providers`
    : 'https://supabase.com/dashboard'

  useEffect(() => {
    let cancelled = false
    void probeGoogleOAuth().then((p) => {
      if (cancelled) return
      if (p.ok) setOauthProbe('ready')
      else if (p.code === 'google_disabled') setOauthProbe('google_off')
      else if (p.code === 'bad_redirect') setOauthProbe('redirect')
      else setOauthProbe('other')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const callbackHint =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:5173/auth/callback'
  const googleOAuthRedirectUri = supabaseAuthV1CallbackUrl(
    import.meta.env.VITE_SUPABASE_URL,
  )

  const onGoogle = async () => {
    setBusy(true)
    try {
      await auth.signInWithGoogle()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-gradient-to-b from-[#f7f5f0] via-neutral-warm to-white">
      <div className="mx-auto max-w-lg px-4 py-10 md:px-6 md:py-14">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-green-accent">
          Community
        </p>
        <h1 className="mt-3 text-center font-serif-display text-3xl font-semibold text-starbucks-green md:text-[2rem]">
          로그인 · 가입
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-text-soft">
          Google 계정으로 <strong className="font-medium text-[rgba(0,0,0,0.55)]">로그인</strong>과{' '}
          <strong className="font-medium text-[rgba(0,0,0,0.55)]">첫 방문 시 자동 가입</strong>이 한 번에
          처리됩니다. 별도 회원가입 양식은 없습니다.
        </p>


        {oauthProbe === 'google_off' || oauthProbe === 'redirect' || oauthProbe === 'other' ? (
          <Card className="mt-8 border border-warning/45 bg-warning/10 p-5 text-left text-sm text-text-primary shadow-none">
            <p className="font-semibold text-warning">
              {oauthProbe === 'google_off'
                ? 'Google 로그인이 Supabase에서 꺼져 있어요'
                : oauthProbe === 'redirect'
                  ? '콜백 URL을 Supabase에 등록해야 해요'
                  : '로그인 설정을 확인해 주세요'}
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-text-primary">
              <li>
                대시보드에서{' '}
                <a
                  href={dashboardProvidersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-green-accent underline underline-offset-2"
                >
                  Authentication → Providers → Google
                </a>
                을 켜고, Google Cloud의 <strong>Client ID·Secret</strong>을 저장합니다.
              </li>
              <li>
                Google Cloud → OAuth 클라이언트 → <strong>승인된 리디렉션 URI</strong>에는 Supabase 전용 주소
                <strong className="font-medium">만</strong> 넣습니다.{' '}
                <strong className="text-warning">localhost 주소는 여기에 넣지 마세요</strong>(있으면 삭제).
                {googleOAuthRedirectUri ? (
                  <>
                    <span className="mt-1 block text-xs text-text-soft">
                      아래 한 줄만 복사합니다. «당신의», 〈 〉, (프로젝트) 같은 설명 글자는
                      URI에 넣지 마세요.
                    </span>
                    <code className="mt-1 block rounded bg-white/80 px-2 py-1 text-xs break-all">
                      {googleOAuthRedirectUri}
                    </code>
                  </>
                ) : (
                  <span className="mt-1 block text-xs leading-relaxed text-text-soft">
                    Supabase 대시보드 → Project Settings → API의{' '}
                    <strong className="font-medium">Project URL</strong> 값을{' '}
                    <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[rgba(0,0,0,0.75)]">
                      VITE_SUPABASE_URL
                    </code>
                    로 <code className="font-mono text-[rgba(0,0,0,0.75)]">web/.env.local</code>에
                    넣고 개발 서버를 다시 띄우면, 여기에 복사용 주소가 나타납니다. Google에는
                    그때 표시되는 주소만 등록하세요.
                  </span>
                )}
              </li>
              <li>
                Supabase → Authentication → <strong>URL Configuration</strong> → Redirect URLs 에
                아래 주소가 있어야 합니다(개발 서버는 포트 <strong>5173</strong> 고정).
                <code className="mt-1 block rounded bg-white/80 px-2 py-1 text-xs">{callbackHint}</code>
              </li>
            </ol>
            {oauthProbe === 'other' ? (
              <p className="mt-3 text-xs text-text-soft">
                버튼을 누르면 자세한 오류가 표시될 수 있어요.
              </p>
            ) : null}
          </Card>
        ) : null}

        {auth.loading ? (
          <Card className="mt-10 border border-black/[0.06] bg-white p-10 text-center shadow-[var(--shadow-card)]">
            <div
              className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-green-accent border-t-transparent"
              aria-hidden
            />
            <p className="mt-4 text-sm text-text-soft">세션 확인 중…</p>
          </Card>
        ) : auth.user ? (
          <Card className="mt-10 border border-black/[0.06] bg-white p-8 shadow-[var(--shadow-card)]">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-text-soft">
              로그인됨
            </p>
            <div className="mt-4 flex flex-col items-center gap-1 text-center">
              <p className="text-lg font-semibold text-[rgba(0,0,0,0.87)]">
                {auth.user.displayName}
              </p>
              {auth.user.email ? (
                <p className="text-sm text-text-soft">{auth.user.email}</p>
              ) : null}
            </div>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                variant="primary"
                className="w-full sm:w-auto sm:min-w-[9rem]"
                onClick={() => nav('/community')}
              >
                커뮤니티로
              </Button>
              <Button
                type="button"
                variant="outlined"
                className="w-full sm:w-auto sm:min-w-[9rem]"
                onClick={() => void auth.signOut()}
              >
                로그아웃
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="mt-10 space-y-6 border border-black/[0.08] bg-white p-8 shadow-[var(--shadow-card)] md:p-9">
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onGoogle()}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white py-3.5 pl-4 pr-5 text-sm font-semibold text-[#3c4043] shadow-sm transition hover:bg-[#f8f9fa] disabled:opacity-60"
              >
                <GoogleMark />
                {busy ? 'Google로 이동 중…' : 'Google로 계속하기'}
              </button>
              <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-text-soft">
                계속하면 Google의 안전한 로그인 창으로 이동합니다. 동의 화면에서 권한을 확인한 뒤
                돌아옵니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-black/[0.06] pt-6 text-sm">
              <Link
                to="/community"
                className="font-medium text-green-accent underline underline-offset-2 hover:text-starbucks-green"
              >
                둘러보기(비로그인)
              </Link>
              <span className="text-text-soft/50" aria-hidden>
                ·
              </span>
              <Link
                to="/"
                className="font-medium text-text-soft underline-offset-2 hover:text-starbucks-green"
              >
                가계부 홈
              </Link>
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}

export default function AuthSetupPage() {
  const auth = useCommunityAuth()
  const mode = communityBackendMode()
  const sbConfigured = isCommunitySupabaseConfigured()
  const client = getCommunitySupabase()

  if (mode === 'supabase' && client) {
    return <SupabaseLoginScreen />
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      <h1 className="font-serif-display text-starbucks-green">
        {mode === 'prisma' ? '로컬 로그인' : 'Google 로그인 · 가입'}
      </h1>
      <p className="mt-2 text-sm text-text-soft">
        {mode === 'prisma' ? (
          <>
            커뮤니티는 SQLite + Prisma API(
            <code className="rounded bg-ceramic px-1 text-xs">server/</code>)에 저장됩니다. 웹은
            Vite가 <code className="rounded bg-ceramic px-1 text-xs">/api</code> 를 4000 포트로
            넘깁니다. 터미널에서 <code className="rounded bg-ceramic px-1 text-xs">npm run dev:full</code>{' '}
            을 쓰면 프론트와 API가 함께 뜹니다.
          </>
        ) : (
          <>
            Supabase Auth로 Google 계정을 연결합니다. 별도 &apos;회원가입&apos; 화면은 없으며,
            처음 로그인 시 자동으로 계정이 만들어집니다.
          </>
        )}
      </p>

      {mode === 'prisma' ? (
        <Card className="mt-8 space-y-4">
          <p className="text-sm text-text-primary">
            아래 버튼은 개발용 계정을 SQLite에 만들고 JWT로 로그인합니다. 배포 시에는
            Supabase 모드로 바꾸면 됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              className="!text-xs"
              onClick={() => auth.demoSignIn(false)}
            >
              로컬 · 일반 사용자
            </Button>
            <Button
              type="button"
              variant="outlined"
              className="!text-xs"
              onClick={() => auth.demoSignIn(true)}
            >
              로컬 · 관리자
            </Button>
          </div>
          <p>
            <Link to="/community" className="text-sm font-medium text-green-accent underline">
              커뮤니티로 돌아가기
            </Link>
          </p>
        </Card>
      ) : null}

      {mode === 'supabase' && !client ? (
        <Card className="mt-8 border border-warning/40 bg-white p-6">
          <p className="text-sm text-text-primary">
            환경 변수 이름은 맞지만 값이 비어 있거나 잘못되었을 수 있습니다.{' '}
            <code className="rounded bg-ceramic px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code>,{' '}
            <code className="rounded bg-ceramic px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>
            를 확인한 뒤 개발 서버를 다시 시작하세요.
          </p>
        </Card>
      ) : null}

      {mode === 'mock' ? (
        <>
          <Card className="mt-8 space-y-5 text-sm text-text-primary">
            <p className="font-semibold text-starbucks-green">
              지금은 Supabase가 연결되지 않아 Google 로그인을 쓸 수 없습니다.
            </p>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                프로젝트 <code className="rounded bg-ceramic px-1">web</code> 폴더에{' '}
                <code className="rounded bg-ceramic px-1">.env.local</code> 파일을 만듭니다.
              </li>
              <li>
                Supabase 대시보드 → Project Settings → API 에서 URL과{' '}
                <span className="whitespace-nowrap">anon public</span> 키를 복사합니다.
              </li>
              <li>
                아래 형식으로 붙여 넣습니다.
                <pre className="mt-2 overflow-x-auto rounded-lg bg-house-green/10 p-3 text-xs text-text-primary">
                  {`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...`}
                </pre>
              </li>
              <li>
                Supabase → Authentication → Providers → <strong>Google</strong> 을 켜고, Google
                Cloud에서 받은 Client ID / Secret을 넣습니다.
              </li>
              <li>
                Authentication → URL Configuration 에서 Site URL과 Redirect URL에 콜백을
                등록합니다.
                <pre className="mt-2 overflow-x-auto rounded-lg bg-house-green/10 p-3 text-xs">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
                </pre>
              </li>
              <li>
                로컬 DB만 쓰려면{' '}
                <code className="rounded bg-ceramic px-1">VITE_COMMUNITY_BACKEND=prisma</code> 와{' '}
                <code className="rounded bg-ceramic px-1">npm run dev:full</code> 을 참고하세요.
              </li>
              <li>
                <code className="rounded bg-ceramic px-1">npm run dev</code> 를 중지했다가 다시
                실행합니다. (환경 변수는 재시작 후에 적용됩니다.)
              </li>
            </ol>
          </Card>

          {import.meta.env.DEV ? (
            <Card className="mt-10 border border-dashed border-black/[0.12] bg-neutral-cool/50 p-5">
              <p className="text-xs font-semibold text-text-soft">개발 전용 · 목업</p>
              <p className="mt-2 text-xs text-text-soft">
                서버 없이 UI만 돌려볼 때만 사용하세요. 실제글/계정과 무관합니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outlined"
                  className="!text-xs"
                  onClick={() => auth.demoSignIn(false)}
                >
                  목업 일반 사용자
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  className="!text-xs"
                  onClick={() => auth.demoSignIn(true)}
                >
                  목업 관리자
                </Button>
              </div>
            </Card>
          ) : null}

          {!import.meta.env.DEV && !sbConfigured ? (
            <p className="mt-6 text-center text-xs text-text-soft">
              배포 환경에서는 호스팅(Vercel 등)에 위 환경 변수를 등록해야 Google 로그인이
              동작합니다.
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
