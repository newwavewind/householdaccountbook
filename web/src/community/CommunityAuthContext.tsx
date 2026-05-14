import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { communityBackendMode } from '../lib/communityBackend'
import { getCommunitySupabase } from '../lib/communitySupabaseClient'
import { probeGoogleOAuth, supabaseAuthV1CallbackUrl } from '../lib/supabaseOAuthProbe'
import { setPrismaApiToken, getPrismaApiToken } from '../lib/prismaApi'
import type { CommunityUser, ProfileRole } from './types'
import {
  readMockSession,
  writeMockSession,
  type MockSession,
} from './mockSessionStorage'

type CommunityAuthState = {
  loading: boolean
  user: CommunityUser | null
  role: ProfileRole
  demoSignIn: (asAdmin: boolean) => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const CommunityAuthContext = createContext<CommunityAuthState | null>(null)

const DEMO_USER: MockSession = {
  userId: 'demo-user',
  email: 'demo.user@example.com',
  displayName: '데모 사용자',
  role: 'user',
}

const DEMO_ADMIN: MockSession = {
  userId: 'demo-admin',
  email: 'demo.admin@example.com',
  displayName: '데모 관리자',
  role: 'admin',
}

function mockSessionToUser(s: MockSession): CommunityUser {
  return {
    id: s.userId,
    email: s.email,
    displayName: s.displayName,
    avatarUrl: s.avatarUrl,
  }
}

function initialMockUser(): CommunityUser | null {
  const s = readMockSession()
  return s ? mockSessionToUser(s) : null
}

function initialMockRole(): ProfileRole {
  return readMockSession()?.role === 'admin' ? 'admin' : 'user'
}

export function CommunityAuthProvider({ children }: { children: ReactNode }) {
  const mode = communityBackendMode()
  const [loading, setLoading] = useState(
    () => mode === 'supabase' || mode === 'prisma',
  )
  const [user, setUser] = useState<CommunityUser | null>(() =>
    mode === 'mock' ? initialMockUser() : null,
  )
  const [role, setRole] = useState<ProfileRole>(() =>
    mode === 'mock' ? initialMockRole() : 'user',
  )

  const syncMockFromStorage = useCallback(() => {
    const s = readMockSession()
    setUser(s ? mockSessionToUser(s) : null)
    setRole(s?.role === 'admin' ? 'admin' : 'user')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (mode !== 'prisma') return
    const token = getPrismaApiToken()
    if (!token) {
      queueMicrotask(() => {
        setUser(null)
        setRole('user')
        setLoading(false)
      })
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return
        if (!r.ok) {
          setPrismaApiToken(null)
          setUser(null)
          setRole('user')
          return
        }
        const u = (await r.json()) as {
          id: string
          email: string
          displayName: string
          avatarUrl?: string
          role: string
        }
        setUser({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
        })
        setRole(u.role === 'admin' ? 'admin' : 'user')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'supabase') return
    const client = getCommunitySupabase()
    if (!client) {
      queueMicrotask(() => {
        setLoading(false)
        setUser(null)
        setRole('user')
      })
      return
    }

    const loadProfile = async (uid: string) => {
      const { data, error } = await client
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle()
      if (error) {
        setRole('user')
        return
      }
      setRole(data?.role === 'admin' ? 'admin' : 'user')
    }

    const applySession = async () => {
      const { data: { session } } = await client.auth.getSession()
      if (!session?.user) {
        setUser(null)
        setRole('user')
        setLoading(false)
        return
      }
      const u = session.user
      setUser({
        id: u.id,
        email: u.email ?? '',
        displayName:
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          (u.email?.split('@')[0] ?? '사용자'),
        avatarUrl: u.user_metadata?.avatar_url as string | undefined,
      })
      await loadProfile(u.id)
      setLoading(false)
    }

    void applySession()

    const { data: sub } = client.auth.onAuthStateChange((_evt, session) => {
      void (async () => {
        if (!session?.user) {
          setUser(null)
          setRole('user')
          setLoading(false)
          return
        }
        const u = session.user
        setUser({
          id: u.id,
          email: u.email ?? '',
          displayName:
            (u.user_metadata?.full_name as string | undefined) ??
            (u.user_metadata?.name as string | undefined) ??
            (u.email?.split('@')[0] ?? '사용자'),
          avatarUrl: u.user_metadata?.avatar_url as string | undefined,
        })
        await loadProfile(u.id)
        setLoading(false)
      })()
    })
    return () => sub.subscription.unsubscribe()
  }, [mode])

  const demoSignIn = useCallback(
    (asAdmin: boolean) => {
      if (mode === 'mock') {
        writeMockSession(asAdmin ? DEMO_ADMIN : DEMO_USER)
        syncMockFromStorage()
        return
      }
      if (mode === 'prisma') {
        const src = asAdmin ? DEMO_ADMIN : DEMO_USER
        void (async () => {
          const r = await fetch('/api/auth/dev', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: src.email,
              displayName: src.displayName,
              role: src.role,
            }),
          })
          if (!r.ok) {
            window.alert('로컬 로그인에 실패했습니다. API 서버를 띄웠는지 확인하세요.')
            return
          }
          const data = (await r.json()) as {
            token: string
            user: {
              id: string
              email: string
              displayName: string
              avatarUrl?: string
              role: string
            }
          }
          setPrismaApiToken(data.token)
          setUser({
            id: data.user.id,
            email: data.user.email,
            displayName: data.user.displayName,
            avatarUrl: data.user.avatarUrl,
          })
          setRole(data.user.role === 'admin' ? 'admin' : 'user')
          setLoading(false)
        })()
      }
    },
    [mode, syncMockFromStorage],
  )

  const signInWithGoogle = useCallback(async () => {
    if (mode === 'mock' || mode === 'prisma') {
      window.location.assign(`${window.location.origin}/auth/setup`)
      return
    }
    const client = getCommunitySupabase()
    if (!client) {
      window.alert('Supabase 환경 변수(VITE_SUPABASE_URL, ANON KEY)가 없습니다.')
      return
    }
    const probe = await probeGoogleOAuth()
    if (!probe.ok) {
      if (probe.code === 'google_disabled') {
        const gUri = supabaseAuthV1CallbackUrl(import.meta.env.VITE_SUPABASE_URL)
        const googleUriLine = gUri
          ? `3) Google Cloud → OAuth 클라이언트 → 승인된 리디렉션 URI에 아래 한 줄만 넣으세요(한글·〈〉·괄호 설명 글자는 넣지 마세요).\n   ${gUri}\n\n`
          : '3) 승인된 리디렉션 URI에는 https://(실제프로젝트ref).supabase.co/auth/v1/callback 처럼, Supabase 대시보드 Project URL의 호스트만 사용하세요. 「로그인 · 가입」화면에 표시되는 주소를 복사하는 것이 가장 안전합니다.\n\n'
        window.alert(
          'Supabase에서 Google 로그인이 아직 꺼져 있어요.\n\n' +
            '1) Supabase 대시보드 → Authentication → Providers → Google 을 켜세요.\n' +
            '2) Google Cloud의 Client ID·Secret을 넣고 저장하세요.\n' +
            googleUriLine +
            '자세한 안내는「로그인 · 가입」화면 상단 노란 카드를 보세요.',
        )
        return
      }
      if (probe.code === 'bad_redirect') {
        window.alert(
          `콜백 주소가 허용 목록에 없을 수 있어요.\n\nSupabase → Authentication → URL Configuration → Redirect URLs 에 아래를 추가하세요:\n${window.location.origin}/auth/callback\n\n(${probe.detail})`,
        )
        return
      }
      window.alert(`Google 로그인을 시작할 수 없습니다.\n\n${probe.detail}`)
      return
    }
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) window.alert(error.message)
  }, [mode])

  const signOut = useCallback(async () => {
    if (mode === 'mock') {
      writeMockSession(null)
      syncMockFromStorage()
      return
    }
    if (mode === 'prisma') {
      setPrismaApiToken(null)
      setUser(null)
      setRole('user')
      return
    }
    const client = getCommunitySupabase()
    if (client) await client.auth.signOut()
    setUser(null)
    setRole('user')
  }, [mode, syncMockFromStorage])

  const value = useMemo(
    (): CommunityAuthState => ({
      loading,
      user,
      role,
      demoSignIn,
      signInWithGoogle,
      signOut,
    }),
    [demoSignIn, loading, role, signInWithGoogle, signOut, user],
  )

  return (
    <CommunityAuthContext.Provider value={value}>
      {children}
    </CommunityAuthContext.Provider>
  )
}

/* Fast refresh: 훅을 Provider와 같은 모듈에 둔다. */
/* eslint-disable react-refresh/only-export-components */
export function useCommunityAuth(): CommunityAuthState {
  const ctx = useContext(CommunityAuthContext)
  if (!ctx) {
    throw new Error('useCommunityAuth는 CommunityAuthProvider 안에서만 사용하세요.')
  }
  return ctx
}

export function useCommunityBackendReadyMessage(): string | null {
  const mode = communityBackendMode()
  const [prismaMsg, setPrismaMsg] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'prisma') {
      queueMicrotask(() => setPrismaMsg(null))
      return
    }
    let cancelled = false
    const ping = () => {
      void fetch('/api/health')
        .then((r) => {
          if (cancelled) return
          setPrismaMsg(
            r.ok
              ? null
              : '로컬 API(Prisma)에 연결되지 않았습니다. `server` 폴더에서 npm run dev 를 실행하세요.',
          )
        })
        .catch(() => {
          if (cancelled) return
          setPrismaMsg(
            '로컬 API(Prisma)에 연결되지 않았습니다. `server` 폴더에서 npm run dev 를 실행하세요.',
          )
        })
    }
    ping()
    const t = setInterval(ping, 20000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [mode])

  if (mode === 'supabase' && !getCommunitySupabase()) {
    return 'Supabase URL/anon 키가 없어 커뮤니티 백엔드를 쓸 수 없습니다.'
  }
  return prismaMsg
}

export const useSupabaseReadyMessage = useCommunityBackendReadyMessage
