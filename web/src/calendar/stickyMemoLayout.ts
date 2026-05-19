import {
  htmlToPlain,
  sanitizeStickyNoteHtml,
} from './calendarHtmlSanitize'
import {
  clampCompactMemoHeight,
  clampCompactMemoWidth,
  compactSizeEmpty,
  compactSizeFromContent,
  STICKY_MEMO_DEFAULT_SIZE,
  STICKY_MEMO_EXPANDED_MIN_HEIGHT,
  STICKY_MEMO_EXPANDED_WIDTH,
  stickyMemoHeight,
} from './stickyMemoSize'
import type { CalendarStickyNote } from './calendarStickyNotesStorage'

function derivePlain(note: CalendarStickyNote): string {
  const rawHtml = note.bodyHtml?.trim()
    ? note.bodyHtml
    : note.body
      ? `<p>${note.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
      : ''
  const safe = sanitizeStickyNoteHtml(rawHtml || '<p></p>')
  return htmlToPlain(safe).trim()
}

/** 저장된 크기가 없을 때 본문 기준 추정(보드 높이 계산용) */
export function estimateCompactFootprint(note: CalendarStickyNote): {
  width: number
  height: number
} {
  if (note.widthPx != null && note.heightPx != null) {
    return {
      width: clampCompactMemoWidth(note.widthPx),
      height: clampCompactMemoHeight(note.heightPx),
    }
  }
  const plain = derivePlain(note)
  if (!plain) return compactSizeEmpty()
  const charW = 7.5
  const lineH = 15
  const lines = plain.split(/\n/)
  const longest = Math.max(1, ...lines.map((l) => l.length))
  return compactSizeFromContent(longest * charW, lines.length * lineH)
}
const GAP = 16
const COLS = 3
const MAX_BOARD_COORD = 2400

export function parseStickyBoardCoord(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.round(Math.min(MAX_BOARD_COORD, Math.max(0, value)))
}

export function defaultStickyNotePosition(index: number): { xPx: number; yPx: number } {
  const size = STICKY_MEMO_DEFAULT_SIZE
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return {
    xPx: col * (size + GAP),
    yPx: row * (size + GAP),
  }
}

export function resolveStickyNotePosition(
  note: CalendarStickyNote,
  index: number,
): { xPx: number; yPx: number } {
  const fallback = defaultStickyNotePosition(index)
  return {
    xPx: note.xPx ?? fallback.xPx,
    yPx: note.yPx ?? fallback.yPx,
  }
}

export function stickyNoteFootprint(
  note: CalendarStickyNote,
  expanded: boolean,
): { width: number; height: number } {
  if (expanded) {
    return {
      width: STICKY_MEMO_EXPANDED_WIDTH,
      height: Math.max(
        stickyMemoHeight(note.heightPx),
        STICKY_MEMO_EXPANDED_MIN_HEIGHT,
      ),
    }
  }
  if (note.widthPx != null && note.heightPx != null) {
    return {
      width: clampCompactMemoWidth(note.widthPx),
      height: clampCompactMemoHeight(note.heightPx),
    }
  }
  return estimateCompactFootprint(note)
}

export function computeStickyBoardHeight(
  notes: CalendarStickyNote[],
  expandedIds: Set<string>,
): number {
  if (notes.length === 0) return 0
  let maxBottom = 0
  notes.forEach((note, index) => {
    const { yPx } = resolveStickyNotePosition(note, index)
    const { height } = stickyNoteFootprint(note, expandedIds.has(note.id))
    maxBottom = Math.max(maxBottom, yPx + height)
  })
  return maxBottom + GAP
}

export type NextStickyNotePositionOptions = {
  /** + 버튼을 누른 기준 메모가 펼쳐진 상태인지 */
  anchorExpanded?: boolean
  /** 보드 가로 폭 — 오른쪽에 놓을 공간이 없으면 아래로 배치 */
  canvasWidth?: number
}

export function nextStickyNotePosition(
  notes: CalendarStickyNote[],
  afterId?: string,
  options: NextStickyNotePositionOptions = {},
): { xPx: number; yPx: number } {
  if (!afterId) {
    return defaultStickyNotePosition(notes.length)
  }
  const i = notes.findIndex((n) => n.id === afterId)
  if (i < 0) return defaultStickyNotePosition(notes.length)
  const anchor = notes[i]!
  const pos = resolveStickyNotePosition(anchor, i)
  const anchorExpanded = options.anchorExpanded ?? false
  const { width: anchorW, height: anchorH } = stickyNoteFootprint(
    anchor,
    anchorExpanded,
  )
  const newW = compactSizeEmpty().width
  const canvasW = options.canvasWidth ?? 900

  let xPx = pos.xPx + anchorW + GAP
  let yPx = pos.yPx

  if (xPx + newW > canvasW - GAP) {
    xPx = pos.xPx
    yPx = pos.yPx + anchorH + GAP
  }

  return {
    xPx: Math.round(Math.max(0, xPx)),
    yPx: Math.round(Math.max(0, yPx)),
  }
}

export function clampStickyNotePosition(
  xPx: number,
  yPx: number,
  footprintW: number,
  _footprintH: number,
  canvasW: number,
): { xPx: number; yPx: number } {
  const maxX = Math.max(0, canvasW - footprintW)
  return {
    xPx: Math.round(Math.min(maxX, Math.max(0, xPx))),
    yPx: Math.round(Math.max(0, yPx)),
  }
}
