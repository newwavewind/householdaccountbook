/** 짧은 선택 피드백 (하단 탭 등) — Android·일부 브라우저. iOS Safari는 미지원인 경우가 많음 */
export function triggerSelectionHaptic(): void {
  if (typeof navigator === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const vibrate = navigator.vibrate
  if (typeof vibrate !== 'function') return

  try {
    vibrate.call(navigator, [12])
  } catch {
    // 사용자 제스처 외 호출 등 — 무시
  }
}
