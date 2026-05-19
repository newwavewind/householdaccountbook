import { parsePollData, type CommunityPollData } from './communityPollTypes'
import { sanitizeCommunityPostHtml } from '../lib/communityPostHtml'

export type PostBodySegment =
  | { type: 'html'; html: string }
  | { type: 'poll'; data: CommunityPollData }
  | { type: 'youtube'; videoId: string }

export function parseCommunityPostBodySegments(body: string): PostBodySegment[] {
  const raw = (body ?? '').trim()
  if (!raw) return []

  if (typeof document === 'undefined') {
    return [{ type: 'html', html: sanitizeCommunityPostHtml(raw) }]
  }

  const wrapper = document.createElement('div')
  wrapper.innerHTML = sanitizeCommunityPostHtml(raw)
  const segments: PostBodySegment[] = []

  const flushHtml = (nodes: Node[]) => {
    if (!nodes.length) return
    const box = document.createElement('div')
    for (const n of nodes) box.appendChild(n.cloneNode(true))
    const html = box.innerHTML.trim()
    if (html) segments.push({ type: 'html', html })
  }

  let buffer: Node[] = []
  for (const child of Array.from(wrapper.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      if (el.hasAttribute('data-community-poll')) {
        flushHtml(buffer)
        buffer = []
        const poll = parsePollData(el.getAttribute('data-poll'))
        if (poll) segments.push({ type: 'poll', data: poll })
        continue
      }
      if (el.hasAttribute('data-community-youtube')) {
        flushHtml(buffer)
        buffer = []
        const videoId = el.getAttribute('data-video-id')
        if (videoId) segments.push({ type: 'youtube', videoId })
        continue
      }
    }
    buffer.push(child)
  }
  flushHtml(buffer)

  if (!segments.length) {
    return [{ type: 'html', html: sanitizeCommunityPostHtml(raw) }]
  }
  return segments
}

