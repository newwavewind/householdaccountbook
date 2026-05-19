import {
  STICKY_MEMO_DEFAULT_SIZE,
  stickyMemoHeight,
  stickyMemoWidth,
} from './stickyMemoSize'
import type { CalendarStickyNote } from './calendarStickyNotesStorage'

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
  const width = stickyMemoWidth(note.widthPx)
  const height = expanded
    ? Math.max(stickyMemoHeight(note.heightPx), 288)
    : stickyMemoHeight(note.heightPx)
  return { width, height }
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

export function nextStickyNotePosition(
  notes: CalendarStickyNote[],
  afterId?: string,
): { xPx: number; yPx: number } {
  if (!afterId) {
    return defaultStickyNotePosition(notes.length)
  }
  const i = notes.findIndex((n) => n.id === afterId)
  if (i < 0) return defaultStickyNotePosition(notes.length)
  const anchor = notes[i]!
  const pos = resolveStickyNotePosition(anchor, i)
  const { width, height } = stickyNoteFootprint(anchor, false)
  return {
    xPx: pos.xPx + Math.min(32, width * 0.2),
    yPx: pos.yPx + Math.min(32, height * 0.2),
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
