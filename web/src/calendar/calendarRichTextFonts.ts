/** 달력 일정·스티커 메모 공통 글꼴 목록 */
export const CALENDAR_RICH_FONTS = [
  { label: '기본', value: '' },
  { label: '본고딕', value: 'system-ui, sans-serif' },
  { label: '명조', value: 'Georgia, "Apple SD Gothic Neo", serif' },
  {
    label: '복숭아',
    value: '"복숭아", "HGPeach", "Gamja Flower", "Apple SD Gothic Neo", cursive',
  },
  { label: '궁서', value: '"Gungsuh", "궁서", Batang, "Apple SD Gothic Neo", serif' },
] as const

export const CALENDAR_FONT_SIZES = [
  { label: '작게', value: '0.75rem' },
  { label: '보통', value: '' },
  { label: '크게', value: '1rem' },
  { label: '더 크게', value: '1.125rem' },
  { label: '아주 크게', value: '1.25rem' },
] as const

export function resolveCalendarFontSelectValue(active: string): string {
  if (!active) return ''
  const exact = CALENDAR_RICH_FONTS.find((f) => f.value === active)
  if (exact) return exact.value
  const partial = CALENDAR_RICH_FONTS.find(
    (f) => f.value && active.includes(f.value.split(',')[0]!.replace(/"/g, '')),
  )
  return partial?.value ?? ''
}

export function resolveCalendarFontSizeSelectValue(active: string): string {
  if (!active) return ''
  const exact = CALENDAR_FONT_SIZES.find((s) => s.value === active)
  return exact?.value ?? ''
}
