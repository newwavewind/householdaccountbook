export const STICKY_MEMO_DEFAULT_SIZE = 176
export const STICKY_MEMO_MIN_SIZE = 96
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

export function parseStickyMemoWidth(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(STICKY_MEMO_MAX_WIDTH, stickyMemoWidth(value))
}

export function parseStickyMemoHeight(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return stickyMemoHeight(value)
}

/** @deprecated parseStickyMemoWidth / parseStickyMemoHeight 사용 */
export function parseStickyMemoDimension(value: unknown): number | undefined {
  return parseStickyMemoHeight(value)
}
