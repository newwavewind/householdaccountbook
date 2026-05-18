import { registerSW } from 'virtual:pwa-register'

const BANNER_ID = 'mj-pwa-update-banner'

function showUpdateBanner(applyUpdate: () => Promise<void>) {
  if (document.getElementById(BANNER_ID)) return

  const bar = document.createElement('div')
  bar.id = BANNER_ID
  bar.setAttribute('role', 'status')
  bar.style.cssText = [
    'position:fixed',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:2147483646',
    'display:flex',
    'flex-wrap:wrap',
    'align-items:center',
    'justify-content:center',
    'gap:10px',
    'padding:12px 14px',
    'background:#0f3d2e',
    'color:#f2f0eb',
    'font:14px/1.35 system-ui,sans-serif',
    'box-shadow:0 -4px 24px rgba(0,0,0,0.2)',
  ].join(';')

  const text = document.createElement('p')
  text.style.cssText = 'margin:0;text-align:center'
  text.textContent =
    '새 버전이 배포되었습니다. 모든 기기·브라우저에서 적용하려면 아래를 눌러 주세요.'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = '업데이트 적용 (새로고침)'
  btn.style.cssText = [
    'cursor:pointer',
    'border:none',
    'border-radius:999px',
    'padding:10px 18px',
    'font-weight:600',
    'background:#f2f0eb',
    'color:#0f3d2e',
  ].join(';')

  btn.addEventListener('click', () => {
    void applyUpdate()
  })

  bar.append(text, btn)
  document.body.appendChild(bar)
}

/** 프로덕션에서만: 새 SW 대기 시 배너로 갱신 유도 + 주기적 update() 로 배포 반영 지연 완화 */
export function registerAppServiceWorker() {
  if (!import.meta.env.PROD) return

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      showUpdateBanner(() => updateSW(true))
    },
    onRegistered(registration) {
      if (!registration) return

      const check = () => {
        void registration.update()
      }

      check()
      const intervalId = window.setInterval(check, 120_000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('beforeunload', () => {
        window.clearInterval(intervalId)
      })
    },
  })
}
