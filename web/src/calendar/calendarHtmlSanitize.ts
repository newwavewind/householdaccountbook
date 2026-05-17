import DOMPurify from 'dompurify'

/** 일정 제목·메모 HTML (Tiptap 출력) — 허용 태그만 남김 */
export function sanitizeCalendarEventHtml(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  return DOMPurify.sanitize(s, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'span',
      'mark',
    ],
    ALLOWED_ATTR: ['style', 'class', 'data-color', 'color'],
  })
}

/** 달력 칸·목록용 미리보기(짧게) */
export function htmlToPlainLine(html: string | undefined): string {
  const t = htmlToPlain(html)
  if (!t) return ''
  return t.length > 80 ? `${t.slice(0, 79)}…` : t
}

export function htmlToPlain(html: string | undefined): string {
  if (!html?.trim()) return ''
  if (typeof document !== 'undefined') {
    const d = document.createElement('div')
    d.innerHTML = html
    return d.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  }
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
