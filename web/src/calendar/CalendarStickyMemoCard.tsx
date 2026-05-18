import { useCallback, useEffect, useRef, useState } from 'react'
import { KakaoTalkShareIconButton } from '../components/KakaoTalkShareIconButton'
import { CalendarEventRichField } from './CalendarEventRichField'
import {
  htmlToPlain,
  sanitizeStickyNoteHtml,
} from './calendarHtmlSanitize'
import type { CalendarStickyNote, StickyTint } from './calendarStickyNotesStorage'
import {
  STICKY_TINT_LABEL,
  STICKY_TINT_ORDER,
} from './calendarStickyNotesStorage'
import { STICKY_THEMES } from './stickyNoteTheme'

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

type PatchProps = {
  note: CalendarStickyNote
  onPatch: (id: string, patch: Partial<CalendarStickyNote>) => void
  onRemove: (id: string) => void
  onAddAfter: (afterId: string) => void
}

function StickyMemoCompactPreview({ note }: { note: CalendarStickyNote }) {
  const theme = STICKY_THEMES[note.tint]
  const rawHtml = deriveEditorHtml(note.bodyHtml, note.body)
  const safe = sanitizeStickyNoteHtml(rawHtml)
  const plain = htmlToPlain(safe)
  const empty = !plain

  return (
    <div
      className={`flex aspect-square w-36 shrink-0 flex-col overflow-hidden rounded-md border border-black/15 shadow-[3px_5px_18px_rgba(0,0,0,0.14)] sm:w-40 ${theme.bodyClass}`}
      aria-label="스티커 메모 미리보기 — 펼치기에서 편집"
    >
      {empty ? (
        <p
          className={`m-0 flex flex-1 items-center justify-center p-2 text-center text-[0.7rem] ${
            note.tint === 'charcoal' ? 'text-white/45' : 'text-black/40'
          }`}
        >
          빈 메모
        </p>
      ) : (
        <div
          className={`sticky-compact-preview min-h-0 flex-1 overflow-hidden p-2 text-[0.72rem] leading-snug sm:p-2.5 sm:text-[0.76rem] ${
            note.tint === 'charcoal' ? 'text-white/90' : 'text-text-primary'
          } [&_img]:max-h-16 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded [&_ul]:list-disc [&_ul]:pl-3.5`}
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      )}
    </div>
  )
}

function StickyMemoExpandedCard({
  note,
  onPatch,
  onRemove,
  onAddAfter,
}: PatchProps) {
  const theme = STICKY_THEMES[note.tint]
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteRef = useRef<HTMLDivElement>(null)
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
    if (!paletteOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!paletteRef.current?.contains(e.target as Node)) setPaletteOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [paletteOpen])

  const isCharcoal = note.tint === 'charcoal'
  const swatchBorder = isCharcoal ? 'border-white/25' : 'border-black/15'

  const bodyPreviewColors: Record<StickyTint, string> = {
    yellow: '#fffef5',
    green: '#eef8ef',
    pink: '#fff5f8',
    purple: '#f7f2ff',
    blue: '#f3f8ff',
    gray: '#f5f5f5',
    charcoal: '#3d3d3d',
  }

  return (
    <div className="flex min-h-[18rem] flex-col overflow-visible rounded-md border border-black/15 shadow-[3px_5px_18px_rgba(0,0,0,0.14)]">
      <header
        className={`relative z-10 flex h-9 shrink-0 items-center justify-between overflow-visible px-1.5 ${theme.headerClass}`}
      >
        <button
          type="button"
          className={theme.headerBtnClass}
          aria-label="새 메모"
          onClick={() => onAddAfter(note.id)}
        >
          <span className="text-lg font-light leading-none">+</span>
        </button>
        <div className="relative z-20 flex items-center gap-0.5" ref={paletteRef}>
          <button
            type="button"
            className={theme.headerBtnClass}
            aria-label="메모 색 선택"
            aria-expanded={paletteOpen}
            onClick={() => setPaletteOpen((v) => !v)}
          >
            <span className="px-1 text-base font-bold leading-none">⋯</span>
          </button>
          {paletteOpen ? (
            <div
              className={`absolute bottom-full right-0 z-[70] mb-1 w-[min(calc(100vw-2rem),13rem)] rounded-lg border bg-surface-raised p-2 shadow-lg ${isCharcoal ? 'border-white/20' : 'border-black/10'}`}
              role="listbox"
              aria-label="노트 색"
            >
              <p className="mb-1.5 px-1 text-[0.65rem] font-medium text-text-soft">
                색 선택
              </p>
              <div className="grid grid-cols-4 gap-2">
                {STICKY_TINT_ORDER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    title={STICKY_TINT_LABEL[t]}
                    className={`flex flex-col items-center gap-0.5 rounded-md border-2 p-0.5 text-[0.6rem] text-text-soft shadow-sm transition-transform active:scale-95 ${
                      note.tint === t ? 'ring-2 ring-starbucks-green ring-offset-1' : ''
                    } ${swatchBorder}`}
                    onClick={() => {
                      onPatch(note.id, { tint: t })
                      setPaletteOpen(false)
                    }}
                  >
                    <span
                      className="block h-7 w-full rounded-sm border border-black/10"
                      style={{ backgroundColor: bodyPreviewColors[t] }}
                      aria-hidden
                    />
                    <span className="max-w-[3.25rem] truncate px-0.5">
                      {STICKY_TINT_LABEL[t]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <KakaoTalkShareIconButton
            className={theme.headerBtnClass}
            titlePrefix="[달력 스티커 메모]"
            text={
              htmlToPlain(
                sanitizeStickyNoteHtml(deriveEditorHtml(note.bodyHtml, note.body)),
              ) ||
              note.body.trim() ||
              ''
            }
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

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${theme.bodyClass}`}>
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
  compact: boolean
  onPatch: (id: string, patch: Partial<CalendarStickyNote>) => void
  onRemove: (id: string) => void
  onAddAfter: (afterId: string) => void
}

export function CalendarStickyMemoCard({
  note,
  compact,
  onPatch,
  onRemove,
  onAddAfter,
}: Props) {
  if (compact) {
    return <StickyMemoCompactPreview note={note} />
  }
  return (
    <StickyMemoExpandedCard
      note={note}
      onPatch={onPatch}
      onRemove={onRemove}
      onAddAfter={onAddAfter}
    />
  )
}
