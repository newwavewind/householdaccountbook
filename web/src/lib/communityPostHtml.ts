import DOMPurify from 'dompurify'

const SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 's', 'strike', 'code', 'pre',
    'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a',
    'img', 'video', 'source',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'style', 'controls', 'type'],
}

let linkHooksInstalled = false

function ensureSafeLinkHook() {
  if (linkHooksInstalled) return
  linkHooksInstalled = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A') return
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  })
}

/** 본문 저장·표시용 HTML 정화 (XSS 완화) */
export function sanitizeCommunityPostHtml(html: string): string {
  ensureSafeLinkHook()
  return String(DOMPurify.sanitize(html ?? '', SANITIZE_OPTS))
}

export function isProbablyRichHtml(body: string): boolean {
  const t = body.trim()
  return t.startsWith('<') && /<\/[a-z][\s>]|<br\s*\/?>/i.test(t)
}

/** 목록 미리보기 등용 평문 (스크립트는 sanitize 후 추출) */
export function postBodyToPlainText(body: string): string {
  const raw = (body ?? '').trim()
  if (!raw) return ''
  if (!isProbablyRichHtml(raw)) return raw.replace(/\s+/g, ' ').trim()
  if (typeof document === 'undefined') {
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const el = document.createElement('div')
  el.innerHTML = sanitizeCommunityPostHtml(raw)
  return (el.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}
