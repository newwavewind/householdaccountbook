import type { CSSProperties } from 'react'
import {
  calendarBackgroundGradientCss,
  calendarDecorationMixedBgRgb,
  getCalendarBackgroundPreset,
} from './calendarBackgroundPresets'
import type { CalendarDecoration } from './calendarDecorationStorage'

export function hasCalendarPattern(deco: CalendarDecoration): boolean {
  return deco.kind !== 'none' && (deco.kind !== 'photo' || !!deco.imageUrl)
}

export function hasCalendarBackground(deco: CalendarDecoration): boolean {
  return deco.useBackground !== false
}

/** 패턴 또는 배경 꾸미기가 켜진 상태 */
export function isCalendarDecorated(deco: CalendarDecoration): boolean {
  return hasCalendarPattern(deco) || hasCalendarBackground(deco)
}

export { calendarDecorationMixedBgRgb } from './calendarBackgroundPresets'

/** 꾸미기 호스트 — 반투명 면·페이지 배경 */
export function calendarDecorationHostStyle(
  deco: CalendarDecoration,
): CSSProperties | undefined {
  if (!hasCalendarBackground(deco)) return undefined
  const preset = getCalendarBackgroundPreset(deco.backgroundPresetId)
  const mixedRgb = calendarDecorationMixedBgRgb(
    preset.rgb,
    deco.backgroundDensity,
  )
  const gradient =
    deco.backgroundMode === 'gradient'
      ? calendarBackgroundGradientCss(preset, deco.backgroundDensity)
      : 'none'
  return {
    ['--calendar-deco-bg-rgb' as string]: mixedRgb,
    ['--calendar-deco-bg-gradient' as string]: gradient,
    ['--calendar-deco-bg-fill' as string]: String(deco.backgroundFill),
    ['--calendar-deco-page-alpha' as string]: String(deco.backgroundPageAlpha),
  }
}

/** 카드·패널·격자별 패턴 농도 (0~1) — 다이어리 패널은 card와 동일 */
export const CALENDAR_DECO_STRENGTH = {
  card: 1,
  /** D-day·스티커·일정 패널 (달력 카드와 동일 농도) */
  panel: 1,
  /** 요일(일~토) — 정보 영역, 가장 연하게 (칸 배경은 더 투명) */
  weekdays: 0.14,
  /** 날짜 격자 — 은은하게 */
  cells: 0.38,
} as const

export type CalendarDecoStrength = keyof typeof CALENDAR_DECO_STRENGTH

export function calendarDecorationLayerStyle(
  deco: CalendarDecoration,
  strength = 1,
): CSSProperties | undefined {
  if (deco.kind === 'none') return undefined

  const op = deco.opacity * strength
  const rgb = deco.patternRgb

  if (deco.kind === 'photo' && deco.imageUrl) {
    return {
      backgroundImage: `url(${deco.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: Math.min(0.55, op + 0.08),
    }
  }

  if (deco.kind === 'dots') {
    return {
      backgroundImage: `radial-gradient(circle, rgba(${rgb},${op}) 1.25px, transparent 1.25px)`,
      backgroundSize: '13px 13px',
    }
  }

  if (deco.kind === 'stripes') {
    return {
      backgroundImage: `repeating-linear-gradient(
        -45deg,
        rgba(${rgb},${op}) 0,
        rgba(${rgb},${op}) 1.5px,
        transparent 1.5px,
        transparent 11px
      )`,
    }
  }

  if (deco.kind === 'grid') {
    return {
      backgroundImage: `
        linear-gradient(rgba(${rgb},${op}) 1px, transparent 1px),
        linear-gradient(90deg, rgba(${rgb},${op}) 1px, transparent 1px)
      `,
      backgroundSize: '18px 18px',
    }
  }

  if (deco.kind === 'waves') {
    return {
      backgroundImage: `
        repeating-radial-gradient(
          circle at 50% 100%,
          transparent 0,
          transparent 5px,
          rgba(${rgb},${op}) 5px,
          rgba(${rgb},${op}) 6px,
          transparent 6px,
          transparent 12px
        )
      `,
      backgroundSize: '20px 10px',
    }
  }

  if (deco.kind === 'bubbles') {
    return {
      backgroundImage: `
        radial-gradient(circle, rgba(${rgb},${op}) 2px, transparent 2px),
        radial-gradient(circle, rgba(${rgb},${op * 0.65}) 1.5px, transparent 1.5px)
      `,
      backgroundSize: '22px 22px, 22px 22px',
      backgroundPosition: '0 0, 11px 11px',
    }
  }

  if (deco.kind === 'honeycomb') {
    return {
      backgroundImage: `
        radial-gradient(circle at 25% 18%, rgba(${rgb},${op}) 2px, transparent 2.5px),
        radial-gradient(circle at 75% 18%, rgba(${rgb},${op}) 2px, transparent 2.5px),
        radial-gradient(circle at 50% 68%, rgba(${rgb},${op * 0.9}) 2px, transparent 2.5px)
      `,
      backgroundSize: '24px 21px',
      backgroundPosition: '0 0, 12px 0, 6px 10px',
    }
  }

  if (deco.kind === 'star') {
    return {
      backgroundImage: `
        radial-gradient(circle, rgba(${rgb},${op}) 2px, transparent 2.5px),
        linear-gradient(
          45deg,
          transparent 44%,
          rgba(${rgb},${op * 0.85}) 44%,
          rgba(${rgb},${op * 0.85}) 56%,
          transparent 56%
        ),
        linear-gradient(
          -45deg,
          transparent 44%,
          rgba(${rgb},${op * 0.85}) 44%,
          rgba(${rgb},${op * 0.85}) 56%,
          transparent 56%
        )
      `,
      backgroundSize: '20px 20px',
    }
  }

  if (deco.kind === 'speckle') {
    return {
      backgroundImage: `
        radial-gradient(circle at 12% 18%, rgba(${rgb},${op}) 1px, transparent 1.5px),
        radial-gradient(circle at 68% 28%, rgba(${rgb},${op * 0.85}) 1.2px, transparent 1.6px),
        radial-gradient(circle at 38% 72%, rgba(${rgb},${op * 0.75}) 1px, transparent 1.5px),
        radial-gradient(circle at 88% 78%, rgba(${rgb},${op * 0.9}) 1px, transparent 1.5px),
        radial-gradient(circle at 22% 52%, rgba(${rgb},${op * 0.65}) 0.8px, transparent 1.2px)
      `,
      backgroundSize: '26px 26px',
    }
  }

  if (deco.kind === 'checker') {
    return {
      backgroundImage: `
        linear-gradient(
          45deg,
          rgba(${rgb},${op * 0.4}) 25%,
          transparent 25%,
          transparent 75%,
          rgba(${rgb},${op * 0.4}) 75%
        ),
        linear-gradient(
          45deg,
          rgba(${rgb},${op * 0.4}) 25%,
          transparent 25%,
          transparent 75%,
          rgba(${rgb},${op * 0.4}) 75%
        )
      `,
      backgroundSize: '14px 14px',
      backgroundPosition: '0 0, 7px 7px',
    }
  }

  return undefined
}
