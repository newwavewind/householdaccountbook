import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { CalendarStickyMemoCard } from './CalendarStickyMemoCard'
import {
  loadStickyNotes,
  loadStickyViewMode,
  type CalendarStickyNote,
  nextTint,
  saveStickyNotes,
  saveStickyViewMode,
} from './calendarStickyNotesStorage'

export default function CalendarStickyNotesBoard() {
  const [notes, setNotes] = useState<CalendarStickyNote[]>(loadStickyNotes)
  const [viewMode, setViewMode] = useState<'compact' | 'expanded'>(() =>
    loadStickyViewMode(),
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteCountRef = useRef(0)

  useEffect(() => {
    noteCountRef.current = notes.length
  }, [notes.length])

  const scheduleSave = useCallback((next: CalendarStickyNote[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveStickyNotes(next)
    }, 280)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const setView = (mode: 'compact' | 'expanded') => {
    setViewMode(mode)
    saveStickyViewMode(mode)
  }

  const addNote = (afterId?: string) => {
    const n: CalendarStickyNote = {
      id: crypto.randomUUID(),
      body: '',
      bodyHtml: undefined,
      tint: nextTint(noteCountRef.current),
      updatedAt: new Date().toISOString(),
    }
    setNotes((prev) => {
      let next: CalendarStickyNote[]
      if (!afterId) {
        next = [...prev, n]
      } else {
        const i = prev.findIndex((x) => x.id === afterId)
        next =
          i < 0 ? [...prev, n] : [...prev.slice(0, i + 1), n, ...prev.slice(i + 1)]
      }
      saveStickyNotes(next)
      return next
    })
  }

  const patchNote = (id: string, patch: Partial<CalendarStickyNote>) => {
    setNotes((prev) => {
      const next = prev.map((x) =>
        x.id === id
          ? { ...x, ...patch, updatedAt: new Date().toISOString() }
          : x,
      )
      scheduleSave(next)
      return next
    })
  }

  const removeNote = (id: string) => {
    setNotes((prev) => {
      const next = prev.filter((x) => x.id !== id)
      saveStickyNotes(next)
      return next
    })
  }

  const compact = viewMode === 'compact'

  return (
    <section
      aria-label="스티커 메모"
      className="rounded-[var(--radius-card)] border border-black/[0.08] bg-gradient-to-b from-ceramic/60 to-white px-3 py-3 md:px-5 md:py-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif-display text-lg font-semibold text-starbucks-green md:text-xl">
            스티커 메모
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-full border border-black/[0.1] bg-white p-0.5 text-xs font-semibold shadow-sm"
            role="group"
            aria-label="보기 방식"
          >
            <button
              type="button"
              onClick={() => setView('compact')}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                compact
                  ? 'bg-starbucks-green text-white'
                  : 'text-text-soft hover:bg-neutral-cool'
              }`}
            >
              간략히
            </button>
            <button
              type="button"
              onClick={() => setView('expanded')}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                !compact
                  ? 'bg-starbucks-green text-white'
                  : 'text-text-soft hover:bg-neutral-cool'
              }`}
            >
              펼치기
            </button>
          </div>
          <Button
            type="button"
            variant="outlined"
            className="!rounded-full !px-3 !py-1.5 !text-xs md:!text-sm"
            onClick={() => addNote()}
          >
            + 메모
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-black/[0.1] bg-white/60 px-4 py-6 text-center text-sm text-text-soft">
          + 메모를 눌러 스티커를 추가해 보세요.
        </p>
      ) : compact ? (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {notes.map((n, idx) => (
            <div
              key={n.id}
              className="w-[min(100%,17.5rem)] shrink-0"
              style={{ transform: `rotate(${idx % 2 === 0 ? -0.6 : 0.55}deg)` }}
            >
              <CalendarStickyMemoCard
                note={n}
                compact
                onPatch={patchNote}
                onRemove={removeNote}
                onAddAfter={(id) => addNote(id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((n) => (
            <CalendarStickyMemoCard
              key={n.id}
              note={n}
              compact={false}
              onPatch={patchNote}
              onRemove={removeNote}
              onAddAfter={(id) => addNote(id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
