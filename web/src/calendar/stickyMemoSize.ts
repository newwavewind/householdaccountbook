export const STICKY_MEMO_DEFAULT_SIZE = 120
export const STICKY_MEMO_MIN_SIZE = 96
/** 컴팩트 미리보기 — 내용 맞춤 최소 크기 */
export const STICKY_MEMO_MIN_COMPACT_WIDTH = 56
export const STICKY_MEMO_MIN_COMPACT_HEIGHT = 36
/** inset-1 + p-1.5 + 테두리 여유 */
export const STICKY_MEMO_COMPACT_CHROME_X = 22
export const STICKY_MEMO_COMPACT_CHROME_Y = 22
/** 높이만 상한 (너비는 제한 없음) */
export const STICKY_MEMO_MAX_HEIGHT = 560
/** 저장·파싱 시 비정상 값 방지 */
export const STICKY_MEMO_MAX_WIDTH = 3200

export function stickyMemoWidth(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return STICKY_MEMO_DEFAULT_SIZE
  return Math.round(Math.max(STICKY_MEMO_MIN_SIZE, value))
}

export function stickyMemoHeight(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return STICKY_MEMO_DEFAULT_SIZE
  return Math.round(
    Math.min(STICKY_MEMO_MAX_HEIGHT, Math.max(STICKY_MEMO_MIN_SIZE, value)),
  )
}

/** @deprecated width/height 각각 stickyMemoWidth, stickyMemoHeight 사용 */
export function stickyMemoSize(value: number | undefined): number {
  return stickyMemoHeight(value)
}

export function clampCompactMemoWidth(value: number): number {
  return Math.round(
    Math.min(STICKY_MEMO_MAX_WIDTH, Math.max(STICKY_MEMO_MIN_COMPACT_WIDTH, value)),
  )
}

export function clampCompactMemoHeight(value: number): number {
  return Math.round(
    Math.min(STICKY_MEMO_MAX_HEIGHT, Math.max(STICKY_MEMO_MIN_COMPACT_HEIGHT, value)),
  )
}

export function parseStickyMemoWidth(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return clampCompactMemoWidth(value)
}

export function parseStickyMemoHeight(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return clampCompactMemoHeight(value)
}

/** @deprecated parseStickyMemoWidth / parseStickyMemoHeight 사용 */
export function parseStickyMemoDimension(value: unknown): number | undefined {
  return parseStickyMemoHeight(value)
}

/** 컴팩트 미리보기 — 글자 영역 크기에 맞춘 카드 크기 */
export function compactSizeFromContent(
  contentWidth: number,
  contentHeight: number,
): { width: number; height: number } {
  return {
    width: clampCompactMemoWidth(contentWidth + STICKY_MEMO_COMPACT_CHROME_X),
    height: clampCompactMemoHeight(contentHeight + STICKY_MEMO_COMPACT_CHROME_Y),
  }
}

export function compactSizeEmpty(): { width: number; height: number } {
  return {
    width: STICKY_MEMO_MIN_COMPACT_WIDTH,
    height: STICKY_MEMO_MIN_COMPACT_HEIGHT,
  }
}
