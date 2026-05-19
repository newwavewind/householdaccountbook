import type { StickyTint } from './calendarStickyNotesStorage'

/** MS 스티커 메모 느낌: 헤더/푸터(진하게) · 본문(연하게) — dark: 저채도 톤 */
export type StickyTheme = {
  headerClass: string
  bodyClass: string
  footerClass: string
  headerBtnClass: string
  toolbarBtnClass: string
  toolbarBtnActiveClass: string
  placeholderClass: string
}

const stickyToolbarActive =
  'bg-black/8 text-text-primary dark:bg-white/12 dark:text-text-primary'
const stickyToolbarActiveTint =
  'bg-black/15 text-text-primary dark:bg-white/15 dark:text-text-primary'
const stickyHeaderBtn =
  'rounded p-1 text-text-secondary hover:bg-black/6 focus-visible:outline focus-visible:ring-2 focus-visible:ring-black/15 dark:hover:bg-white/10 dark:focus-visible:ring-white/25'
const stickyHeaderBtnTint =
  'rounded p-1 text-text-secondary hover:bg-black/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-black/20 dark:hover:bg-white/10 dark:focus-visible:ring-white/25'
const stickyToolbarBtn =
  'rounded px-2 py-1 text-[0.75rem] font-semibold text-text-muted hover:bg-black/6 dark:hover:bg-white/10'
const stickyToolbarBtnTint =
  'rounded px-2 py-1 text-[0.75rem] font-semibold text-text-muted hover:bg-black/10 dark:hover:bg-white/10'
const stickyPlaceholder =
  '[&_.ProseMirror]:text-text-primary [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-text-soft'

export const STICKY_THEMES: Record<StickyTint, StickyTheme> = {
  white: {
    headerClass:
      'bg-[#f5f5f3] border-b border-black/[0.07] dark:bg-[#3a3a3c] dark:border-white/10',
    bodyClass: 'bg-white dark:bg-[#2c2c2e]',
    footerClass:
      'bg-[#f3f3f1] border-t border-black/[0.07] dark:bg-[#3a3a3c] dark:border-white/10',
    headerBtnClass: stickyHeaderBtn,
    toolbarBtnClass: stickyToolbarBtn,
    toolbarBtnActiveClass: stickyToolbarActive,
    placeholderClass: stickyPlaceholder,
  },
  yellow: {
    headerClass:
      'bg-[#e8d78a] border-b border-[#c9b86a]/90 dark:bg-[#4a4028] dark:border-[#6b6040]/80',
    bodyClass: 'bg-[#fffef5] dark:bg-[#3d3520]',
    footerClass:
      'bg-[#e8d78a] border-t border-[#c9b86a]/90 dark:bg-[#4a4028] dark:border-[#6b6040]/80',
    headerBtnClass: stickyHeaderBtnTint,
    toolbarBtnClass: stickyToolbarBtnTint,
    toolbarBtnActiveClass: stickyToolbarActiveTint,
    placeholderClass: stickyPlaceholder,
  },
  green: {
    headerClass:
      'bg-[#8fbf96] border-b border-[#6fa378]/95 dark:bg-[#35443c] dark:border-[#4a6354]/80',
    bodyClass: 'bg-[#eef8ef] dark:bg-[#2a3530]',
    footerClass:
      'bg-[#8fbf96] border-t border-[#6fa378]/95 dark:bg-[#35443c] dark:border-[#4a6354]/80',
    headerBtnClass: stickyHeaderBtnTint,
    toolbarBtnClass: stickyToolbarBtnTint,
    toolbarBtnActiveClass: stickyToolbarActiveTint,
    placeholderClass: stickyPlaceholder,
  },
  pink: {
    headerClass:
      'bg-[#e8a0b8] border-b border-[#d0809a]/90 dark:bg-[#4a3640] dark:border-[#6a5058]/80',
    bodyClass: 'bg-[#fff5f8] dark:bg-[#3d2c34]',
    footerClass:
      'bg-[#e8a0b8] border-t border-[#d0809a]/90 dark:bg-[#4a3640] dark:border-[#6a5058]/80',
    headerBtnClass: stickyHeaderBtnTint,
    toolbarBtnClass: stickyToolbarBtnTint,
    toolbarBtnActiveClass: stickyToolbarActiveTint,
    placeholderClass: stickyPlaceholder,
  },
  purple: {
    headerClass:
      'bg-[#b9a3d4] border-b border-[#9a82b8]/90 dark:bg-[#423848] dark:border-[#5c5068]/80',
    bodyClass: 'bg-[#f7f2ff] dark:bg-[#352f3d]',
    footerClass:
      'bg-[#b9a3d4] border-t border-[#9a82b8]/90 dark:bg-[#423848] dark:border-[#5c5068]/80',
    headerBtnClass: stickyHeaderBtnTint,
    toolbarBtnClass: stickyToolbarBtnTint,
    toolbarBtnActiveClass: stickyToolbarActiveTint,
    placeholderClass: stickyPlaceholder,
  },
  blue: {
    headerClass:
      'bg-[#92b8e0] border-b border-[#7098c8]/90 dark:bg-[#364050] dark:border-[#4a5a6a]/80',
    bodyClass: 'bg-[#f3f8ff] dark:bg-[#2c3440]',
    footerClass:
      'bg-[#92b8e0] border-t border-[#7098c8]/90 dark:bg-[#364050] dark:border-[#4a5a6a]/80',
    headerBtnClass: stickyHeaderBtnTint,
    toolbarBtnClass: stickyToolbarBtnTint,
    toolbarBtnActiveClass: stickyToolbarActiveTint,
    placeholderClass: stickyPlaceholder,
  },
  gray: {
    headerClass:
      'bg-[#bdbdbd] border-b border-[#9e9e9e]/95 dark:bg-[#3e3e3e] dark:border-[#555]/80',
    bodyClass: 'bg-[#f5f5f5] dark:bg-[#323232]',
    footerClass:
      'bg-[#bdbdbd] border-t border-[#9e9e9e]/95 dark:bg-[#3e3e3e] dark:border-[#555]/80',
    headerBtnClass: stickyHeaderBtnTint,
    toolbarBtnClass: stickyToolbarBtnTint,
    toolbarBtnActiveClass: stickyToolbarActiveTint,
    placeholderClass: stickyPlaceholder,
  },
  charcoal: {
    headerClass: 'bg-[#2d2d2d] border-b border-black/40 dark:bg-[#252525] dark:border-white/12',
    bodyClass: 'bg-[#3d3d3d] dark:bg-[#323232]',
    footerClass: 'bg-[#2d2d2d] border-t border-black/40 dark:bg-[#252525] dark:border-white/12',
    headerBtnClass:
      'rounded p-1 text-white/85 hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/30',
    toolbarBtnClass:
      'rounded px-2 py-1 text-[0.75rem] font-semibold text-white/75 hover:bg-white/10',
    toolbarBtnActiveClass: 'bg-white/20 text-white',
    placeholderClass:
      '[&_.ProseMirror]:text-white/90 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-white/45',
  },
}

/**
 * 달력 날짜 칸 배경 — 저장된 일정의 memoTint와 맞춤(본문 톤 기준).
 * 목탄은 칸 안 가독성을 위해 옅게만 칠함.
 */
/** 일정 카드·스티커 외곽 테두리 */
export function stickyTintCardChrome(tint: StickyTint): string {
  if (tint === 'white') {
    return 'border-black/[0.09] shadow-[3px_5px_16px_rgba(0,0,0,0.06)] dark:border-white/12 dark:shadow-[3px_5px_16px_rgba(0,0,0,0.35)]'
  }
  if (tint === 'charcoal') {
    return 'border-black/40 shadow-[3px_5px_18px_rgba(0,0,0,0.2)] dark:border-white/15 dark:shadow-[3px_5px_18px_rgba(0,0,0,0.45)]'
  }
  return 'border-black/15 shadow-[3px_5px_18px_rgba(0,0,0,0.14)] dark:border-white/12 dark:shadow-[3px_5px_18px_rgba(0,0,0,0.35)]'
}

export function stickyTintCalendarCellBg(
  tint: StickyTint,
  inMonth: boolean,
): string {
  if (tint === 'charcoal') {
    return inMonth ? 'bg-[#3d3d3d]/25 dark:bg-[#323232]/35' : 'bg-[#3d3d3d]/18 dark:bg-[#323232]/25'
  }
  if (tint === 'white') {
    return inMonth ? 'bg-white dark:bg-[#2c2c2e]' : 'bg-white/70 dark:bg-[#2c2c2e]/70'
  }
  const { bodyClass } = STICKY_THEMES[tint]
  if (inMonth) return bodyClass
  return `${bodyClass} opacity-60`
}
