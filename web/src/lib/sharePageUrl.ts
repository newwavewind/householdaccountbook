/** Web Share API → 클립보드(폴백) 순으로 페이지 URL 공유 */
export async function sharePageUrl(url: string, title: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) {
    window.alert('공유할 링크가 없습니다.')
    return
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, url: trimmed })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }

  try {
    await copyTextToClipboard(trimmed)
    window.alert('링크를 복사했어요!')
  } catch {
    window.prompt('아래 링크를 복사하세요.', trimmed)
  }
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('copy failed')
}
