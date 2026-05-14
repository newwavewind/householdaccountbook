import { useEffect, useRef } from 'react'
import { getCommunitySupabase } from '../lib/communitySupabaseClient'

type GsiCredentialResponse = { credential?: string }

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (res: GsiCredentialResponse) => void | Promise<void>
            use_fedcm_for_prompt?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string
              size?: string
              text?: string
              width?: number
              locale?: string
            },
          ) => void
        }
      }
    }
  }
}

let gsiLoadPromise: Promise<void> | null = null

function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  if (gsiLoadPromise) return gsiLoadPromise
  gsiLoadPromise = new Promise((resolve, reject) => {
    const hit = document.querySelector('script[data-app-google-gsi]')
    if (hit) {
      hit.addEventListener('load', () => resolve(), { once: true })
      hit.addEventListener('error', () => reject(new Error('GSI 로드 실패')), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.dataset.appGoogleGsi = '1'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google 로그인 스크립트를 불러오지 못했습니다.'))
    document.head.appendChild(s)
  })
  return gsiLoadPromise
}

/** Google Identity Services 팝업 버튼 → Supabase `signInWithIdToken` (OAuth 리디렉션·PKCE 없음) */
export function GoogleIdTokenSignIn({
  clientId,
  onSignedIn,
  onError,
}: {
  clientId: string
  onSignedIn: () => void
  onError: (message: string) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const renderedRef = useRef(false)

  useEffect(() => {
    if (!clientId.trim() || !wrapRef.current) return
    const el = wrapRef.current
    let cancelled = false

    void (async () => {
      try {
        await loadGsiScript()
        if (cancelled || !el.isConnected) return
        const g = window.google
        if (!g?.accounts?.id) {
          onError('Google GSI를 사용할 수 없습니다.')
          return
        }
        if (renderedRef.current) return
        renderedRef.current = true

        const useFedcm = import.meta.env.VITE_GOOGLE_GSI_USE_FEDCM === 'true'

        g.accounts.id.initialize({
          client_id: clientId.trim(),
          callback: async (res) => {
            const token = res?.credential
            if (!token) {
              onError('Google에서 토큰을 받지 못했습니다.')
              return
            }
            const sb = getCommunitySupabase()
            if (!sb) {
              onError('Supabase가 설정되지 않았습니다.')
              return
            }
            const { error } = await sb.auth.signInWithIdToken({
              provider: 'google',
              token,
            })
            if (error) {
              onError(
                error.message.includes('nonce') || /nonce/i.test(error.message)
                  ? `${error.message}\n\nSupabase 대시보드 → Authentication → Providers → Google 에서 nonce 검증을 켜둔 경우, GIS 버튼에 nonce를 맞춰 넣어야 합니다. 로컬 테스트는 일시적으로「Skip nonce check」를 허용할 수 있습니다(공식 문서 참고).`
                  : error.message,
              )
              return
            }
            onSignedIn()
          },
          use_fedcm_for_prompt: useFedcm,
        })
        g.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 320,
          locale: 'ko',
        })
      } catch (e) {
        renderedRef.current = false
        if (!cancelled) onError(e instanceof Error ? e.message : '로그인 초기화 오류')
      }
    })()

    return () => {
      cancelled = true
      renderedRef.current = false
      el.replaceChildren()
    }
  }, [clientId, onError, onSignedIn])

  if (!clientId.trim()) return null

  return <div ref={wrapRef} className="flex min-h-[44px] justify-center" />
}
