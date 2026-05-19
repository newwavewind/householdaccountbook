export type TextHueId =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'navy'
  | 'black'
  | 'white'

export type TextHueOption = {
  id: TextHueId
  label: string
  /** HSL hue 0–360; solid 색이면 null */
  hue: number | null
  solid?: string
}

export const COMMUNITY_TEXT_HUES: TextHueOption[] = [
  { id: 'red', label: '빨', hue: 0 },
  { id: 'orange', label: '주', hue: 28 },
  { id: 'yellow', label: '노', hue: 52 },
  { id: 'green', label: '초', hue: 142 },
  { id: 'blue', label: '파', hue: 210 },
  { id: 'navy', label: '남', hue: 228 },
  { id: 'black', label: '검', hue: null, solid: '#111111' },
  { id: 'white', label: '흰', hue: null, solid: '#ffffff' },
]

export function gradientCssForHue(hue: number): string {
  return `linear-gradient(to right, #ffffff 0%, hsl(${hue} 100% 50%) 50%, #111111 100%)`
}

/** 그라데이션 막대 클릭 위치(0~1) → hex 색 */
export function colorFromHueGradient(hue: number, t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  if (clamped <= 0.5) {
    const u = clamped * 2
    return mixHex('#ffffff', hslToHex(hue, 100, 50), u)
  }
  const u = (clamped - 0.5) * 2
  return mixHex(hslToHex(hue, 100, 50), '#111111', u)
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  )
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  return rgbToHex(
    Math.round(pa.r + (pb.r - pa.r) * t),
    Math.round(pa.g + (pb.g - pa.g) * t),
    Math.round(pa.b + (pb.b - pa.b) * t),
  )
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}
