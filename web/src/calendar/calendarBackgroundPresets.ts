import { CALENDAR_DECO_PATTERN_PRESETS } from './calendarDecorationStorage'

/** 선택 원색 + 농도(0~1) → 실제 배경 RGB (흰색과 혼합) */
export function calendarDecorationMixedBgRgb(
  rgb: string,
  density: number,
): string {
  const parts = rgb.split(',').map((s) => Number(s.trim()))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return rgb
  const t = Math.max(0, Math.min(1, density))
  const mix = (c: number) => Math.round(c * t + 255 * (1 - t))
  return `${mix(parts[0]!)}, ${mix(parts[1]!)}, ${mix(parts[2]!)}`
}

export type CalendarBackgroundMode = 'solid' | 'gradient'

export type CalendarBackgroundPreset = {
  id: string
  label: string
  mode: CalendarBackgroundMode
  /** 날짜 칸·반투명 면용 기준 RGB */
  rgb: string
  /** 그라데이션 끝 RGB (없으면 rgb와 동일) */
  rgbEnd?: string
  group: 'tone' | 'rainbow'
}

/** 빨주노초파남보 */
export const CALENDAR_DECO_RAINBOW_RGB = [
  { id: 'rain-red', label: '빨', rgb: '210, 70, 70' },
  { id: 'rain-orange', label: '주', rgb: '230, 140, 60' },
  { id: 'rain-yellow', label: '노', rgb: '240, 210, 70' },
  { id: 'rain-green', label: '초', rgb: '70, 160, 90' },
  { id: 'rain-blue', label: '파', rgb: '70, 130, 210' },
  { id: 'rain-navy', label: '남', rgb: '50, 70, 140' },
  { id: 'rain-purple', label: '보', rgb: '130, 90, 180' },
] as const

function toneSolidPresets(): CalendarBackgroundPreset[] {
  return CALENDAR_DECO_PATTERN_PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    mode: 'solid' as const,
    rgb: p.rgb,
    group: 'tone' as const,
  }))
}

function toneGradientPresets(): CalendarBackgroundPreset[] {
  return CALENDAR_DECO_PATTERN_PRESETS.map((p) => ({
    id: `${p.id}-grad`,
    label: p.label,
    mode: 'gradient' as const,
    rgb: p.rgb,
    rgbEnd: p.rgb,
    group: 'tone' as const,
  }))
}

function rainbowSolidPresets(): CalendarBackgroundPreset[] {
  return CALENDAR_DECO_RAINBOW_RGB.map((p) => ({
    id: p.id,
    label: p.label,
    mode: 'solid' as const,
    rgb: p.rgb,
    group: 'rainbow' as const,
  }))
}

function rainbowGradientPresets(): CalendarBackgroundPreset[] {
  return CALENDAR_DECO_RAINBOW_RGB.map((p) => ({
    id: `${p.id}-grad`,
    label: p.label,
    mode: 'gradient' as const,
    rgb: p.rgb,
    rgbEnd: p.rgb,
    group: 'rainbow' as const,
  }))
}

export const CALENDAR_BACKGROUND_PRESETS: CalendarBackgroundPreset[] = [
  ...toneSolidPresets(),
  ...toneGradientPresets(),
  ...rainbowSolidPresets(),
  ...rainbowGradientPresets(),
]

const PRESET_BY_ID = new Map(
  CALENDAR_BACKGROUND_PRESETS.map((p) => [p.id, p]),
)

export function getCalendarBackgroundPreset(
  id: string | undefined,
): CalendarBackgroundPreset {
  if (id && PRESET_BY_ID.has(id)) {
    return PRESET_BY_ID.get(id)!
  }
  return PRESET_BY_ID.get('sand')!
}

export function calendarBackgroundPresetFromRgb(
  rgb: string,
  mode: CalendarBackgroundMode,
): CalendarBackgroundPreset {
  const solid = CALENDAR_BACKGROUND_PRESETS.find(
    (p) => p.mode === 'solid' && p.rgb === rgb,
  )
  if (solid) return solid
  const tone = CALENDAR_DECO_PATTERN_PRESETS.find((p) => p.rgb === rgb)
  if (tone) {
    return getCalendarBackgroundPreset(
      mode === 'gradient' ? `${tone.id}-grad` : tone.id,
    )
  }
  return getCalendarBackgroundPreset(mode === 'gradient' ? 'sand-grad' : 'sand')
}

/** 농도 반영 그라데이션 CSS (페이지·미리보기) */
export function calendarBackgroundGradientCss(
  preset: CalendarBackgroundPreset,
  density: number,
): string {
  const start = calendarDecorationMixedBgRgb(preset.rgb, Math.min(1, density * 0.45))
  const end = calendarDecorationMixedBgRgb(
    preset.rgbEnd ?? preset.rgb,
    density,
  )
  return `linear-gradient(155deg, rgb(${start}) 0%, rgb(${end}) 52%, rgb(${end}) 100%)`
}

export function calendarBackgroundSwatchStyle(
  preset: CalendarBackgroundPreset,
  density: number,
): string {
  if (preset.mode === 'gradient') {
    return calendarBackgroundGradientCss(preset, density)
  }
  return `rgb(${calendarDecorationMixedBgRgb(preset.rgb, density)})`
}

/** 팔레트 버튼용 — 농도 슬라이더와 무관하게 항상 원색·그라데이션 표시 */
export function calendarBackgroundPickerSwatchStyle(
  preset: CalendarBackgroundPreset,
): string {
  return calendarBackgroundSwatchStyle(preset, 1)
}
