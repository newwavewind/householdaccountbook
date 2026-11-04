import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

const LAST_ERROR_KEY = 'mj-gaegyeobu-last-render-error-v1'

async function clearAppCaches(): Promise<void> {
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
    if (regs) await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    /* ignore */
  }
}

/**
 * 렌더 중 예외가 나도 빈(하얀) 화면만 남지 않게 복구 UI를 보여 줍니다.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
    try {
      localStorage.setItem(
        LAST_ERROR_KEY,
        JSON.stringify({
          message: error.message,
          stack: (error.stack || '').slice(0, 1500),
          componentStack: (info.componentStack || '').slice(0, 1500),
          at: new Date().toISOString(),
        }),
      )
    } catch {
      /* ignore */
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    void clearAppCaches().finally(() => {
      const url = new URL(window.location.href)
      url.searchParams.set('_recover', String(Date.now()))
      window.location.replace(url.toString())
    })
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = this.state.error.message || '알 수 없는 오류'

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-warm px-6 text-center">
        <p className="text-base font-semibold text-text-primary">화면을 불러오지 못했습니다</p>
        <p className="max-w-sm text-sm text-text-soft">
          일시적인 오류일 수 있어요. 다시 시도하거나, 아래 복구를 눌러 주세요.
        </p>
        <p className="max-w-sm break-words rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-left text-[11px] leading-snug text-text-soft">
          {message}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-full bg-green-accent px-5 py-2.5 text-sm font-semibold text-on-accent"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-full border border-border-strong bg-surface-raised px-5 py-2.5 text-sm font-semibold text-text-primary"
          >
            캐시 지우고 복구
          </button>
        </div>
      </div>
    )
  }
}
