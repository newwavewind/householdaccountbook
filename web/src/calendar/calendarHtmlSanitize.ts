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
      'ul',
      'ol',
      'li',
      'img',
    ],
    ALLOWED_ATTR: ['style', 'class', 'data-color', 'color', 'src', 'alt'],
  })
}

/** 스티커 메모 (리스트·이미지 data URL 허용) */
export function sanitizeStickyNoteHtml(raw: string): string {
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
      'ul',
      'ol',
      'li',
      'img',
    ],
    ALLOWED_ATTR: ['class', 'style', 'data-color', 'color', 'src', 'alt'],
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

/** 달력 칸 배경용 — 첫 번째 img src (http(s) 또는 data:image만) */
export function extractFirstImageSrc(html: string | undefined): string | null {
  if (!html?.trim()) return null
  const m = /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(html)
  const src = m?.[1]?.trim()
  if (!src) return null
  if (!/^https?:\/\//i.test(src) && !/^data:image\//i.test(src)) return null
  return src
}

/** 미리보기·오버레이 텍스트용 — img 태그 제거 */
export function htmlWithoutImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, '').trim()
}

export type HtmlPreviewTypography = {
  fontFamily?: string
  fontSize?: string
}

function parseInlineTypography(style: string): HtmlPreviewTypography {
  const fontFamily = /font-family:\s*([^;]+)/i
    .exec(style)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '')
  const fontSize = /font-size:\s*([^;]+)/i.exec(style)?.[1]?.trim()
  const out: HtmlPreviewTypography = {}
  if (fontFamily) out.fontFamily = fontFamily
  if (fontSize) out.fontSize = fontSize
  return out
}

/** 일정 HTML에서 첫 글꼴·글자 크기 (달력 칸 미리보기용) */
export function extractHtmlPreviewTypography(
  html: string | undefined,
): HtmlPreviewTypography {
  const raw = html?.trim()
  if (!raw) return {}

  const safe = sanitizeCalendarEventHtml(raw)

  if (typeof document !== 'undefined') {
    const root = document.createElement('div')
    root.innerHTML = safe
    const styled = root.querySelectorAll('[style]')
    for (const el of styled) {
      const attr = el.getAttribute('style')
      if (!attr) continue
      const parsed = parseInlineTypography(attr)
      if (parsed.fontFamily || parsed.fontSize) return parsed
    }
  }

  const fromAttr = parseInlineTypography(safe)
  if (fromAttr.fontFamily || fromAttr.fontSize) return fromAttr

  return {}
}
