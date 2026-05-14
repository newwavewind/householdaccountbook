/** 브라우저에서 Google OAuth 시작 전, 제공자 활성 여부를 가볍게 확인합니다. */
export type GoogleOAuthProbe =
  | { ok: true }
  | { ok: false; code: 'google_disabled' | 'bad_redirect' | 'unknown'; detail: string }

export async function probeGoogleOAuth(): Promise<GoogleOAuthProbe> {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!base?.startsWith('http') || !anon) {
    return { ok: false, code: 'unknown', detail: 'Supabase URL·anon 키가 없습니다.' }
  }

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:5173/auth/callback'

  const url = `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`

  try {
    const r = await fetch(url, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      redirect: 'manual',
    })

    if (
      r.type === 'opaqueredirect' ||
      (r.status >= 300 && r.status < 400)
    ) {
      return { ok: true }
    }

    if (r.status === 400) {
      const raw = await r.text()
      let msg = raw
      try {
        const j = JSON.parse(raw) as { msg?: string; error?: string }
        msg = j.msg ?? j.error ?? raw
      } catch {
        /* keep raw */
      }

      if (/provider is not enabled|Unsupported provider/i.test(msg)) {
        return { ok: false, code: 'google_disabled', detail: msg }
      }
      if (/redirect|redirect_to|not allowed/i.test(msg)) {
        return { ok: false, code: 'bad_redirect', detail: msg }
      }
      return { ok: false, code: 'unknown', detail: msg }
    }

    return { ok: true }
  } catch {
    return { ok: true }
  }
}

export function supabaseProjectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname
    const sub = host.split('.')[0]
    return sub && host.includes('supabase.co') ? sub : null
  } catch {
    return null
  }
}

/** Google Cloud «승인된 리디렉션 URI»용. `https://…supabase.co/auth/v1/callback` (플레이스홀더 아님) */
export function supabaseAuthV1CallbackUrl(
  viteSupabaseUrl: string | undefined,
): string | null {
  const base = viteSupabaseUrl?.trim().replace(/\/$/, '')
  if (!base?.startsWith('http')) return null
  try {
    const u = new URL(base)
    if (!u.hostname.includes('supabase.co')) return null
  } catch {
    return null
  }
  return `${base}/auth/v1/callback`
}
