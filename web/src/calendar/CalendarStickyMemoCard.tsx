import { useCallback, useEffect, useRef } from 'react'
import { KakaoTalkShareIconButton } from '../components/KakaoTalkShareIconButton'
import { CalendarEventRichField } from './CalendarEventRichField'
import {
  htmlToPlain,
  sanitizeStickyNoteHtml,
} from './calendarHtmlSanitize'
import type { CalendarStickyNote } from './calendarStickyNotesStorage'
import { CalendarEventMemoTintPicker } from './CalendarEventMemoTintPicker'
import { STICKY_THEMES, stickyTintCardChrome } from './stickyNoteTheme'

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
      className={`flex aspect-square w-36 shrink-0 flex-col overflow-hidden rounded-md border sm:w-40 ${stickyTintCardChrome(note.tint)} ${theme.bodyClass}`}
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

  return (
    <div
      className={`flex min-h-[18rem] flex-col overflow-visible rounded-md border ${stickyTintCardChrome(note.tint)}`}
    >
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
        <div className="flex items-center gap-0.5">
          <CalendarEventMemoTintPicker
            value={note.tint}
            aria-label="메모 색 선택"
            listLabel="배경 색"
            menuAlign="right"
            onPick={(t) => onPatch(note.id, { tint: t })}
          />
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
