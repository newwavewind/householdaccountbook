import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarEventRichField } from './CalendarEventRichField'
import {
  htmlToPlain,
  sanitizeStickyNoteHtml,
} from './calendarHtmlSanitize'
import type { CalendarStickyNote } from './calendarStickyNotesStorage'
import { CalendarEventMemoTintPicker } from './CalendarEventMemoTintPicker'
import { STICKY_THEMES, stickyTintCardChrome } from './stickyNoteTheme'
import { stickyMemoHeight, stickyMemoWidth } from './stickyMemoSize'

function deriveEditorHtml(html: string | undefined, plain: string): string {
  const h = html?.trim()
  if (h) return h
  const p = plain.trim()
  if (!p) return '<p></p>'
  const esc = p
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<p>${esc}</p>`
}

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const RESIZE_HANDLE_CLASS: Record<ResizeEdge, string> = {
  n: 'left-1 right-1 top-0 h-2 cursor-ns-resize',
  s: 'left-1 right-1 bottom-0 h-2 cursor-ns-resize',
  e: 'right-0 top-1 bottom-1 w-2 cursor-ew-resize',
  w: 'left-0 top-1 bottom-1 w-2 cursor-ew-resize',
  ne: 'right-0 top-0 h-3 w-3 cursor-nesw-resize',
  nw: 'left-0 top-0 h-3 w-3 cursor-nwse-resize',
  se: 'right-0 bottom-0 h-3 w-3 cursor-nwse-resize',
  sw: 'left-0 bottom-0 h-3 w-3 cursor-nesw-resize',
}

const RESIZE_EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

type PatchProps = {
  note: CalendarStickyNote
  onPatch: (id: string, patch: Partial<CalendarStickyNote>) => void
  onRemove: (id: string) => void
  onAddAfter: (afterId: string) => void
}

function StickyMemoCompactPreview({
  note,
  onResize,
}: {
  note: CalendarStickyNote
  onResize: (widthPx: number, heightPx: number) => void
}) {
  const theme = STICKY_THEMES[note.tint]
  const rawHtml = deriveEditorHtml(note.bodyHtml, note.body)
  const safe = sanitizeStickyNoteHtml(rawHtml)
  const plain = htmlToPlain(safe)
  const empty = !plain

  const storedW = stickyMemoWidth(note.widthPx)
  const storedH = stickyMemoHeight(note.heightPx)
  const [size, setSize] = useState({ w: storedW, h: storedH })
  const sizeRef = useRef(size)
  sizeRef.current = size

  useEffect(() => {
    setSize({ w: storedW, h: storedH })
  }, [storedW, storedH])

  const startResize = useCallback(
    (edge: ResizeEdge, e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startW = sizeRef.current.w
      const startH = sizeRef.current.h
      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        let w = startW
        let h = startH
        if (edge.includes('e')) w = startW + dx
        if (edge.includes('w')) w = startW - dx
        if (edge.includes('s')) h = startH + dy
        if (edge.includes('n')) h = startH - dy
        setSize({ w: stickyMemoWidth(w), h: stickyMemoHeight(h) })
      }

      const onUp = () => {
        target.releasePointerCapture(e.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        const { w, h } = sizeRef.current
        onResize(w, h)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [onResize],
  )

  return (
    <div
      className="relative shrink-0"
      style={{ width: size.w, height: size.h }}
    >
      <div
        className={`absolute inset-2 flex flex-col overflow-hidden rounded-[5px] ${theme.bodyClass}`}
        aria-hidden={empty}
      >
        {!empty ? (
          <div
            className={`sticky-compact-preview min-h-0 flex-1 overflow-hidden p-2 text-[0.72rem] leading-snug sm:text-[0.76rem] ${
              note.tint === 'charcoal' ? 'text-white/90' : 'text-text-primary'
            } [&_img]:max-h-16 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded [&_ul]:list-disc [&_ul]:pl-3.5`}
            dangerouslySetInnerHTML={{ __html: safe }}
          />
        ) : null}
      </div>

      <div
        className={`pointer-events-none absolute inset-0 rounded-md border ${stickyTintCardChrome(note.tint)}`}
        aria-hidden
      />

      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          role="separator"
          aria-label={
            edge === 'n' || edge === 's'
              ? '높이 조절'
              : edge === 'e' || edge === 'w'
                ? '너비 조절'
                : '크기 조절'
          }
          data-sticky-resize
          className={`absolute z-20 touch-none select-none ${RESIZE_HANDLE_CLASS[edge]}`}
          onPointerDown={(e) => startResize(edge, e)}
        />
      ))}
    </div>
  )
}

function StickyMemoExpandedCard({
  note,
  onPatch,
  onRemove,
  onAddAfter,
  onRequestClose,
}: PatchProps & { onRequestClose: () => void }) {
  const theme = STICKY_THEMES[note.tint]
  const rootRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedulePatch = useCallback(
    (html: string, plain: string) => {
      const safe = sanitizeStickyNoteHtml(html)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        onPatch(note.id, { bodyHtml: safe, body: plain })
      }, 220)
    },
    [note.id, onPatch],
  )

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current
      if (!root || root.contains(e.target as Node)) return
      const tintMenu = document.querySelector('[data-sticky-tint-menu]')
      if (tintMenu?.contains(e.target as Node)) return
      onRequestClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onRequestClose])

  return (
    <div
      ref={rootRef}
      data-sticky-expanded
      className={`flex min-h-[18rem] w-full flex-col overflow-visible rounded-md border ${stickyTintCardChrome(note.tint)}`}
    >
      <header
        data-sticky-drag-handle
        className={`relative z-10 flex h-9 shrink-0 cursor-grab items-center justify-between overflow-visible px-1.5 active:cursor-grabbing ${theme.headerClass}`}
      >
        <button
          type="button"
          className={theme.headerBtnClass}
          aria-label="새 메모"
          onClick={() => onAddAfter(note.id)}
        >
          <span className="text-lg font-light leading-none">+</span>
        </button>
        <div className="flex items-center gap-0.5">
          <CalendarEventMemoTintPicker
            value={note.tint}
            aria-label="메모 배경 색"
            listLabel="배경 색"
            menuAlign="right"
            onPick={(t) => onPatch(note.id, { tint: t })}
          />
          <button
            type="button"
            className={theme.headerBtnClass}
            aria-label="이 메모 삭제"
            onClick={() => onRemove(note.id)}
          >
            <span className="px-1 text-sm leading-none">×</span>
          </button>
        </div>
      </header>

      <div
        data-sticky-no-drag
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${theme.bodyClass}`}
      >
        <CalendarEventRichField
          aria-label="스티커 메모"
          placeholder="메모를 작성하세요…"
          html={note.bodyHtml}
          plain={note.body}
          variant="sticky"
          paperTint={note.tint}
          onChange={({ html, plain }) => schedulePatch(html, plain)}
        />
      </div>
    </div>
  )
}

type Props = {
  note: CalendarStickyNote
  expanded: boolean
  onToggleExpand: () => void
  onPatch: (id: string, patch: Partial<CalendarStickyNote>) => void
  onRemove: (id: string) => void
  onAddAfter: (afterId: string) => void
}

export function CalendarStickyMemoCard({
  note,
  expanded,
  onToggleExpand,
  onPatch,
  onRemove,
  onAddAfter,
}: Props) {
  const handleClose = useCallback(() => {
    if (expanded) onToggleExpand()
  }, [expanded, onToggleExpand])

  const handleResize = useCallback(
    (widthPx: number, heightPx: number) => {
      onPatch(note.id, { widthPx, heightPx })
    },
    [note.id, onPatch],
  )

  return (
    <div
      className={
        expanded ? 'relative w-[min(100%,24rem)] min-w-[10rem]' : 'relative shrink-0'
      }
    >
      {expanded ? (
        <StickyMemoExpandedCard
          note={note}
          onPatch={onPatch}
          onRemove={onRemove}
          onAddAfter={onAddAfter}
          onRequestClose={handleClose}
        />
      ) : (
        <StickyMemoCompactPreview note={note} onResize={handleResize} />
      )}
    </div>
  )
}
