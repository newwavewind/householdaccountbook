import { registerSW } from 'virtual:pwa-register'

/**
 * 프로덕션 SW 등록.
 * - autoUpdate: 새 SW 자동 활성화
 * - controllerchange 강제 reload 는 iOS PWA에서 하얀 화면·깜빡임을 유발할 수 있어 제거
 * - HTML 은 workbox NetworkFirst (vite.config) 로 최신 index 를 받도록 함
 */
export function registerAppServiceWorker() {
  if (!import.meta.env.PROD) return

  registerSW({
    immediate: true,
    onRegistered(registration) {
      if (!registration) return

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void registration.update()
        }
      })
    },
  })
}
