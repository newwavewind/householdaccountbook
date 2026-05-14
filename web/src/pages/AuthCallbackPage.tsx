import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityBackendMode } from '../lib/communityBackend'
import { getCommunitySupabase } from '../lib/communitySupabaseClient'
import { supabaseAuthV1CallbackUrl } from '../lib/supabaseOAuthProbe'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

function googleRedirectUriHelpMessage(): string {
  const uri = supabaseAuthV1CallbackUrl(import.meta.env.VITE_SUPABASE_URL)
  if (uri) {
    return (
      '브라우저에 남은 code가 4/0 처럼 보이면, Google 인가 코드가 localhost 앱으로 직접 온 것입니다. Supabase로 로그인할 때는 반드시 Google → Supabase → 앱 순서입니다.\n\n' +
      'Google Cloud Console → 사용자 인증 정보 → (Supabase에 넣은 것과 같은) OAuth 클라이언트 → 승인된 리디렉션 URI에서\n' +
      '· http://localhost… 또는 127.0.0.1 은 전부 삭제하세요. (이 주소는 Supabase 대시보드 쪽 Redirect URLs에만 둡니다.)\n' +
      '· 아래 한 줄만 남기거나 추가하세요. 예시·한글·〈〉 같은 설명 글자는 URI에 넣지 마세요.\n\n' +
      `${uri}\n\n` +
      'Supabase → Authentication → Providers → Google 의 Client ID·Secret이 위 클라이언트와 정확히 같은지 저장한 뒤, 브라우저에서 localhost 쿠키·저장소를 지우거나 시크릿 창으로 다시 로그인해 보세요.'
    )
  }
  return (
    'Google OAuth 리디렉션 URI가 잘못되었을 수 있습니다.\n\n' +
    'web/.env.local 에 VITE_SUPABASE_URL=https://xxxx.supabase.co 형태로 실제 프로젝트 URL만 넣고(괄호·한글 설명 없이), 개발 서버를 다시 띄운 뒤\n' +
    '「로그인 · 가입」화면 노란 안내에 나오는 주소를 Google 승인된 리디렉션 URI에 복사하세요.'
  )
}

function isLikelyGoogleAuthorizationCode(code: string | null): boolean {
  if (!code) return false
  const t = code.trim()
  if (t.startsWith('4/')) return true
  // 일부 환경에서 잘린 값·인코딩 이슈 대비
  return /^4\/0[A-Za-z0-9_-]/i.test(t)
}

function isExternalCodeExchangeError(message: string): boolean {
  return (
    /unable to exchange external code|external code/i.test(message) ||
    /\b4\/0[a-z0-9]/i.test(message)
  )
}

function formatAuthExchangeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as { message?: string; msg?: string; error_description?: string }
    const parts = [o.message, o.msg, o.error_description].filter(
      (x): x is string => typeof x === 'string' && x.length > 0,
    )
    if (parts.length) return parts.join(' ')
  }
  return err instanceof Error ? err.message : String(err)
}

/** GoTrue와 동일: hash 먼저, query가 있으면 query가 우선 */
function getOAuthParamsFromHref(href: string): {
  code: string | null
  error: string | null
  errorDescription: string | null
} {
  const url = new URL(href)
  const fromHash: Record<string, string> = {}
  if (url.hash?.startsWith('#')) {
    try {
      new URLSearchParams(url.hash.slice(1)).forEach((v, k) => {
        fromHash[k] = v
      })
    } catch {
      /* ignore */
    }
  }
  const pick = (key: string) => {
    const q = url.searchParams.get(key)
    if (q !== null && q !== '') return q
    const h = fromHash[key]
    return h && h !== '' ? h : null
  }
  return {
    code: pick('code'),
    error: pick('error'),
    errorDescription: pick('error_description'),
  }
}

export default function AuthCallbackPage() {
  const nav = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error' | 'ok'>('loading')
  const [msg, setMsg] = useState('로그인 처리 중입니다…')
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const mode = communityBackendMode()

    const scheduleRedirect = (ms: number, to: string) => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = setTimeout(() => {
        redirectTimerRef.current = null
        if (!cancelled) nav(to, { replace: true })
      }, ms)
    }

    if (mode === 'prisma') {
      nav('/community', { replace: true })
      return
    }

    if (mode !== 'supabase') {
      queueMicrotask(() => {
        if (cancelled) return
        setStatus('error')
        setMsg(
          'Supabase가 설정되지 않았습니다. Google 로그인을 쓰려면 환경 변수를 채워 주세요.',
        )
      })
      scheduleRedirect(900, '/auth/setup')
      return () => {
        cancelled = true
        if (redirectTimerRef.current) {
          clearTimeout(redirectTimerRef.current)
          redirectTimerRef.current = null
        }
      }
    }

    const client = getCommunitySupabase()
    if (!client) {
      queueMicrotask(() => {
        if (cancelled) return
        setStatus('error')
        setMsg('Supabase가 설정되지 않았습니다.')
      })
      scheduleRedirect(1200, '/auth/setup')
      return () => {
        cancelled = true
        if (redirectTimerRef.current) {
          clearTimeout(redirectTimerRef.current)
          redirectTimerRef.current = null
        }
      }
    }

    void (async () => {
      try {
        const href =
          typeof window !== 'undefined' ? window.location.href : ''
        const { code: authCode, error: oauthErrCode, errorDescription } =
          getOAuthParamsFromHref(href)
        const oauthErr = errorDescription || oauthErrCode
        if (oauthErr) {
          if (cancelled) return
          setStatus('error')
          setMsg(oauthErr)
          return
        }

        // OAuth 리다이렉트 직후 code는 여기서만 읽습니다(초기화 로직이 URL에서 지울 수 있음).

        let {
          data: { session },
          error,
        } = await client.auth.getSession()
        if (cancelled) return
        if (error) {
          setStatus('error')
          setMsg(error.message)
          return
        }

        // 앱을 다른 페이지에서 먼저 연 뒤 로그인하면, 클라이언트 초기화가 이미 끝나
        // 콜백 URL의 code를 처리하지 않습니다. 이 경우 저장된 PKCE verifier로
        // code 문자열만 넘겨 교환해야 합니다(전체 URL을 넘기면 안 됨).
        if (!session?.user && authCode) {
          if (isLikelyGoogleAuthorizationCode(authCode)) {
            if (cancelled) return
            setStatus('error')
            setMsg(googleRedirectUriHelpMessage())
            return
          }
          const { error: exErr } =
            await client.auth.exchangeCodeForSession(authCode)
          if (cancelled) return
          if (exErr) {
            setStatus('error')
            const exText = formatAuthExchangeError(exErr)
            setMsg(
              isExternalCodeExchangeError(exText) || isLikelyGoogleAuthorizationCode(authCode)
                ? googleRedirectUriHelpMessage()
                : exText,
            )
            return
          }
          ;({
            data: { session },
            error,
          } = await client.auth.getSession())
          if (cancelled) return
          if (error) {
            setStatus('error')
            setMsg(error.message)
            return
          }
        }

        if (!session?.user) {
          setStatus('error')
          setMsg('세션을 확인하지 못했습니다. 다시 로그인해 주세요.')
          scheduleRedirect(1200, '/auth/setup')
          return
        }
        try {
          window.history.replaceState(
            {},
            document.title,
            `${window.location.origin}/auth/callback`,
          )
        } catch {
          /* ignore */
        }
        setStatus('ok')
        setMsg('로그인에 성공했습니다. 잠시 후 이동합니다.')
        scheduleRedirect(600, '/community')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        const t = formatAuthExchangeError(e)
        setMsg(
          isExternalCodeExchangeError(t) ? googleRedirectUriHelpMessage() : t,
        )
      }
    })()

    return () => {
      cancelled = true
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current)
        redirectTimerRef.current = null
      }
    }
  }, [nav])

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col justify-center bg-gradient-to-b from-[#f7f5f0] to-neutral-warm px-4 py-16">
      <Card className="border border-black/[0.08] bg-white p-8 text-center shadow-[var(--shadow-card)] md:p-10">
        {status === 'loading' ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-green-accent border-t-transparent"
              aria-hidden
            />
            <p className="text-sm text-text-soft">{msg}</p>
          </div>
        ) : status === 'ok' ? (
          <>
            <p className="text-lg font-semibold text-starbucks-green">환영합니다</p>
            <p className="mt-2 text-sm text-text-soft">{msg}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-warning">로그인 확인 필요</p>
            <p className="mx-auto mt-2 max-w-prose whitespace-pre-wrap text-left text-sm text-text-soft">
              {msg}
            </p>
            <Button
              type="button"
              variant="primary"
              className="mt-8 w-full sm:w-auto"
              onClick={() => nav('/auth/setup', { replace: true })}
            >
              로그인 화면으로
            </Button>
          </>
        )}
        {status === 'loading' || status === 'ok' ? (
          <Button
            type="button"
            variant="outlined"
            className="mt-6 !text-xs"
            onClick={() => nav('/community', { replace: true })}
          >
            커뮤니티로 바로 가기
          </Button>
        ) : null}
      </Card>
    </main>
  )
}
