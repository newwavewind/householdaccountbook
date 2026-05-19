/** 커뮤니티·달력 에디터: 8px ~ 96px */
export const COMMUNITY_FONT_SIZE_PX_MIN = 8
export const COMMUNITY_FONT_SIZE_PX_MAX = 96

export const COMMUNITY_FONT_SIZE_OPTIONS: { label: string; value: string }[] = [
  { label: '기본', value: '' },
  ...Array.from(
    { length: COMMUNITY_FONT_SIZE_PX_MAX - COMMUNITY_FONT_SIZE_PX_MIN + 1 },
    (_, i) => {
      const px = i + COMMUNITY_FONT_SIZE_PX_MIN
      return { label: `${px}`, value: `${px}px` }
    },
  ),
]

export function resolveCommunityFontSizeValue(active: string): string {
  if (!active) return ''
  const exact = COMMUNITY_FONT_SIZE_OPTIONS.find((s) => s.value === active)
  return exact?.value ?? active
}
