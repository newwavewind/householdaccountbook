import { registerSW } from 'virtual:pwa-register'

/**
 * 프로덕션 SW 등록.
 * - autoUpdate: 새 SW를 자동 활성화 (iOS PWA에서 prompt 배너가 반복되는 문제 방지)
 * - controllerchange: 실제로 제어권이 넘어간 뒤에만 1회 새로고침 (첫 설치 시 불필요 리로드 방지)
 * - visibilitychange: 앱 복귀 시에만 update() — 120초 주기 폴링은 iOS에서 waiting SW 루프를 유발할 수 있어 제거
 */
export function registerAppServiceWorker() {
  if (!import.meta.env.PROD) return

  let hadController = Boolean(navigator.serviceWorker?.controller)

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    window.location.reload()
  })

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
