import type { StickyTint } from './calendarStickyNotesStorage'

/** MS 스티커 메모 느낌: 헤더/푸터(진하게) · 본문(연하게) */
export type StickyTheme = {
  headerClass: string
  bodyClass: string
  footerClass: string
  headerBtnClass: string
  toolbarBtnClass: string
  toolbarBtnActiveClass: string
  placeholderClass: string
}

export const STICKY_THEMES: Record<StickyTint, StickyTheme> = {
  yellow: {
    headerClass: 'bg-[#e8d78a] border-b border-[#c9b86a]/90',
    bodyClass: 'bg-[#fffef5]',
    footerClass: 'bg-[#e8d78a] border-t border-[#c9b86a]/90',
    headerBtnClass:
      'rounded p-1 text-[rgba(0,0,0,0.72)] hover:bg-black/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-black/20',
    toolbarBtnClass:
      'rounded px-2 py-1 text-[0.75rem] font-semibold text-[rgba(0,0,0,0.65)] hover:bg-black/10',
    toolbarBtnActiveClass: 'bg-black/15 text-black',
    placeholderClass: 'text-black/40',
  },
  green: {
    headerClass: 'bg-[#8fbf96] border-b border-[#6fa378]/95',
    bodyClass: 'bg-[#eef8ef]',
    footerClass: 'bg-[#8fbf96] border-t border-[#6fa378]/95',
    headerBtnClass:
      'rounded p-1 text-[rgba(0,0,0,0.72)] hover:bg-black/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-black/20',
    toolbarBtnClass:
      'rounded px-2 py-1 text-[0.75rem] font-semibold text-[rgba(0,0,0,0.65)] hover:bg-black/10',
    toolbarBtnActiveClass: 'bg-black/15 text-black',
    placeholderClass: 'text-black/40',
  },
  pink: {
    headerClass: 'bg-[#e8a0b8] border-b border-[#d0809a]/90',
    bodyClass: 'bg-[#fff5f8]',
    footerClass: 'bg-[#e8a0b8] border-t border-[#d0809a]/90',
    headerBtnClass:
      'rounded p-1 text-[rgba(0,0,0,0.72)] hover:bg-black/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-black/20',
    toolbarBtnClass:
      'rounded px-2 py-1 text-[0.75rem] font-semibold text-[rgba(0,0,0,0.65)] hover:bg-black/10',
    toolbarBtnActiveClass: 'bg-black/15 text-black',
    placeholderClass: 'text-black/40',
  },
  purple: {
    headerClass: 'bg-[#b9a3d4] border-b border-[#9a82b8]/90',
    bodyClass: 'bg-[#f7f2ff]',
    footerClass: 'bg-[#b9a3d4] border-t border-[#9a82b8]/90',
    headerBtnClass:
      'rounded p-1 text-[rgba(0,0,0,0.72)] hover:bg-black/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-black/20',
    toolbarBtnClass:
      'rounded px-2 py-1 text-[0.75rem] font-semibold text-[rgba(0,0,0,0.65)] hover:bg-black/10',
    toolbarBtnActiveClass: 'bg-black/15 text-black',
    placeholderClass: 'text-black/40',
  },
  blue: {
    headerClass: 'bg-[#92b8e0] border-b border-[#7098c8]/90',
    bodyClass: 'bg-[#f3f8ff]',
    footerClass: 'bg-[#92b8e0] border-t border-[#7098c8]/90',
    headerBtnClass:
      'rounded p-1 text-[rgba(0,0,0,0.72)] hover:bg-black/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-black/20',
    toolbarBtnClass:
      'rounded px-2 py-1 text-[0.75rem] font-semibold text-[rgba(0,0,0,0.65)] hover:bg-black/10',
    toolbarBtnActiveClass: 'bg-black/15 text-black',
    placeholderClass: 'text-black/40',
  },
  gray: {
    headerClass: 'bg-[#bdbdbd] border-b border-[#9e9e9e]/95',
    bodyClass: 'bg-[#f5f5f5]',
    footerClass: 'bg-[#bdbdbd] border-t border-[#9e9e9e]/95',
    headerBtnClass:
      'rounded p-1 text-[rgba(0,0,0,0.72)] hover:bg-black/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-black/20',
    toolbarBtnClass:
      'rounded px-2 py-1 text-[0.75rem] font-semibold text-[rgba(0,0,0,0.65)] hover:bg-black/10',
    toolbarBtnActiveClass: 'bg-black/15 text-black',
    placeholderClass: 'text-black/40',
  },
  charcoal: {
    headerClass: 'bg-[#2d2d2d] border-b border-black/40',
    bodyClass: 'bg-[#3d3d3d]',
    footerClass: 'bg-[#2d2d2d] border-t border-black/40',
    headerBtnClass:
      'rounded p-1 text-white/85 hover:bg-white/15 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/30',
    toolbarBtnClass:
      'rounded px-2 py-1 text-[0.75rem] font-semibold text-white/75 hover:bg-white/10',
    toolbarBtnActiveClass: 'bg-white/20 text-white',
    placeholderClass: 'text-white/45',
  },
}
