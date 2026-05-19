import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarStickyMemoCard } from './CalendarStickyMemoCard'
import { StickyNoteDraggable } from './StickyNoteDraggable'
import {
  type CalendarStickyNote,
  nextTint,
} from './calendarStickyNotesStorage'
import {
  clampStickyNotePosition,
  computeStickyBoardHeight,
  nextStickyNotePosition,
  resolveStickyNotePosition,
  stickyNoteFootprint,
} from './stickyMemoLayout'

type Props = {
  notes: CalendarStickyNote[]
  patchNotes: (fn: (prev: CalendarStickyNote[]) => CalendarStickyNote[]) => void
}

const titlePillClass =
  'inline-flex shrink-0 items-center rounded-full border border-green-accent bg-transparent px-2.5 py-1 text-[10px] font-semibold text-green-accent md:px-3 md:py-1.5 md:text-xs'

export default function CalendarStickyNotesBoard({ notes, patchNotes }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const noteCountRef = useRef(0)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(0)

  useEffect(() => {
    noteCountRef.current = notes.length
  }, [notes.length])

  useEffect(() => {
    setExpandedIds((prev) => {
      const noteIdSet = new Set(notes.map((n) => n.id))
      return new Set([...prev].filter((id) => noteIdSet.has(id)))
    })
  }, [notes])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null) setCanvasWidth(w)
    })
    ro.observe(el)
    setCanvasWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [notes.length])

  const boardHeight = useMemo(
    () => computeStickyBoardHeight(notes, expandedIds),
    [notes, expandedIds],
  )

  const addNote = (afterId?: string) => {
    const pos = nextStickyNotePosition(notes, afterId)
    const n: CalendarStickyNote = {
      id: crypto.randomUUID(),
      body: '',
      bodyHtml: undefined,
      tint: nextTint(noteCountRef.current),
      xPx: pos.xPx,
      yPx: pos.yPx,
      updatedAt: new Date().toISOString(),
    }
    patchNotes((prev) => {
      if (!afterId) return [...prev, n]
      const i = prev.findIndex((x) => x.id === afterId)
      return i < 0 ? [...prev, n] : [...prev.slice(0, i + 1), n, ...prev.slice(i + 1)]
    })
  }

  const patchNote = (id: string, patch: Partial<CalendarStickyNote>) => {
    patchNotes((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x,
      ),
    )
  }

  const removeNote = (id: string) => {
    patchNotes((prev) => prev.filter((x) => x.id !== id))
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const moveNote = (id: string, xPx: number, yPx: number) => {
    const note = notes.find((n) => n.id === id)
    if (!note) return
    const expanded = expandedIds.has(id)
    const { width, height } = stickyNoteFootprint(note, expanded)
    const clamped = clampStickyNotePosition(
      xPx,
      yPx,
      width,
      height,
      canvasWidth || 900,
    )
    patchNote(id, clamped)
  }

  const hasNotes = notes.length > 0

  return (
    <section
      aria-label="스티커 메모"
      className="overflow-hidden rounded-[var(--radius-card)] border border-border-subtle bg-gradient-to-b from-ceramic/60 to-surface-raised px-3 py-3 md:px-5 md:py-4"
    >
      {!hasNotes ? (
        <div className="flex flex-row flex-wrap items-center justify-center gap-x-2 gap-y-1 py-0.5 md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-4 md:py-0">
          <h2 className={`${titlePillClass} shrink-0`}>스티커 메모</h2>
          <p className="min-w-0 shrink text-[11px] leading-snug text-text-soft sm:text-sm md:px-2 md:text-center">
            <button
              type="button"
              className="inline font-semibold text-green-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-accent/40"
              onClick={() => addNote()}
            >
              + 메모
            </button>
            를 눌러 스티커를 추가해 보세요.
          </p>
          <span className="hidden md:block" aria-hidden />
        </div>
      ) : null}

      {hasNotes ? (
        <div
          ref={canvasRef}
          className="relative w-full max-w-full touch-pan-y overflow-x-auto overflow-y-visible"
          style={{ height: boardHeight, minHeight: 0 }}
        >
          {notes.map((n, index) => {
            const expanded = expandedIds.has(n.id)
            const { xPx, yPx } = resolveStickyNotePosition(n, index)
            return (
              <StickyNoteDraggable
                key={n.id}
                x={xPx}
                y={yPx}
                zIndex={expanded ? 20 : 10 + index}
                dragEnabled
                onMove={(x, y) => moveNote(n.id, x, y)}
                onTap={() => {
                  if (!expanded) toggleExpand(n.id)
                }}
              >
                <CalendarStickyMemoCard
                  note={n}
                  expanded={expanded}
                  onToggleExpand={() => toggleExpand(n.id)}
                  onPatch={patchNote}
                  onRemove={removeNote}
                  onAddAfter={(id) => addNote(id)}
                />
              </StickyNoteDraggable>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
