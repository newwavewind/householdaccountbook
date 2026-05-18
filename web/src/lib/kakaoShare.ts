/** https://developers.kakao.com/docs/latest/ko/javascript/getting-started */
declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void
      isInitialized: () => boolean
      Share: { sendDefault: (options: Record<string, unknown>) => void }
    }
  }
}

const SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

let sdkPromise: Promise<void> | null = null

function loadKakaoSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'))
  }
  if (window.Kakao) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했습니다.'))
    document.head.appendChild(s)
  })
  return sdkPromise
}

function appSiteUrl(): string {
  if (typeof window === 'undefined') return 'https://localhost'
  return window.location.origin || 'https://localhost'
}

const TEXT_MAX = 2000

/**
 * 카카오톡 공유(텍스트 템플릿). `VITE_KAKAO_JAVASCRIPT_KEY` 없으면 Web Share → 클립보드 순.
 * 카카오 콘솔(앱키 → JavaScript 키)에 현재 사이트 도메인을 등록해야 합니다.
 */
export async function shareTextToKakaoOrFallback(raw: string): Promise<void> {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) {
    window.alert('공유할 내용이 없습니다.')
    return
  }

  const clipped = text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text
  const jsKey = (import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY as string | undefined)?.trim()

  if (jsKey) {
    await loadKakaoSdk()
    const K = window.Kakao
    if (!K) throw new Error('Kakao SDK 없음')
    if (!K.isInitialized()) K.init(jsKey)
    const linkUrl = appSiteUrl()
    K.Share.sendDefault({
      objectType: 'text',
      text: clipped,
      link: {
        mobileWebUrl: linkUrl,
        webUrl: linkUrl,
      },
    })
    return
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: '가계부 메모',
        text: clipped,
      })
      return
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(clipped)
      window.alert(
        '카카오 JavaScript 키가 없어 클립보드에 복사했습니다.\n' +
          '배포 시 .env에 VITE_KAKAO_JAVASCRIPT_KEY를 넣으면 카카오톡으로 바로 공유됩니다.',
      )
      return
    }
  } catch {
    /* fall through */
  }

  window.alert(
    '카카오톡 공유를 쓰려면 Kakao Developers에서 앱을 만든 뒤, ' +
      'JavaScript 키를 VITE_KAKAO_JAVASCRIPT_KEY로 설정하고 사이트 도메인을 등록해 주세요.',
  )
}
