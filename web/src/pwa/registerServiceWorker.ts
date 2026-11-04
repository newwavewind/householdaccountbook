import { registerSW } from 'virtual:pwa-register'

const SW_RECOVERY_KEY = 'mj-gaegyeobu-sw-recovery-v1'

async function clearCachesAndUnregister(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations()
    if (regs) {
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    /* ignore */
  }
}

/**
 * 배포 직후 옛 SW 가 삭제된 chunk 를 가리키면 모듈 로드 실패 → 빈(하얀) 화면.
 * 한 번만 캐시·SW 를 비우고 새로고침한다.
 */
function recoverBrokenAssetsOnce(): void {
  try {
    if (sessionStorage.getItem(SW_RECOVERY_KEY) === '1') return
    sessionStorage.setItem(SW_RECOVERY_KEY, '1')
  } catch {
    /* private mode 등 */
  }
  void clearCachesAndUnregister().finally(() => {
    window.location.reload()
  })
}

function isAssetLoadFailure(reason: unknown): boolean {
  const msg = reason instanceof Error ? reason.message : String(reason ?? '')
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg)
  )
}

/**
 * 프로덕션 SW 등록.
 * - autoUpdate: 새 SW 자동 활성화
 * - controllerchange 강제 reload 는 iOS PWA에서 하얀 화면·깜빡임을 유발할 수 있어 제거
 * - HTML 은 workbox NetworkOnly (vite.config) 로 최신 index 를 받도록 함
 * - chunk 로드 실패 시 캐시·SW 1회 복구
 */
export function registerAppServiceWorker() {
  if (!import.meta.env.PROD) return

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    recoverBrokenAssetsOnce()
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (isAssetLoadFailure(event.reason)) {
      event.preventDefault()
      recoverBrokenAssetsOnce()
    }
  })

  registerSW({
    immediate: true,
    onRegistered(registration) {
      if (!registration) return

      void caches.delete('pages-cache')

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void registration.update()
        }
      })
    },
  })
}
