export type PostContentFlags = {
  hasImage: boolean
  hasVideo: boolean
  hasYoutube: boolean
  hasPoll: boolean
}

/** 목록 제목 옆 아이콘용 — 본문 HTML/임베드 여부 */
export function detectPostContentFlags(body: string): PostContentFlags {
  const raw = (body ?? '').trim()
  if (!raw) {
    return { hasImage: false, hasVideo: false, hasYoutube: false, hasPoll: false }
  }

  if (typeof document !== 'undefined' && raw.startsWith('<')) {
    const el = document.createElement('div')
    el.innerHTML = raw
    return {
      hasImage: el.querySelector('img') !== null,
      hasVideo: el.querySelector('video') !== null,
      hasYoutube: el.querySelector('[data-community-youtube]') !== null,
      hasPoll: el.querySelector('[data-community-poll]') !== null,
    }
  }

  return {
    hasImage: /<img[\s>]/i.test(raw),
    hasVideo: /<video[\s>]/i.test(raw),
    hasYoutube:
      /data-community-youtube/i.test(raw) ||
      /youtube-nocookie\.com\/embed/i.test(raw) ||
      /youtube\.com\/embed/i.test(raw),
    hasPoll: /data-community-poll/i.test(raw),
  }
}
