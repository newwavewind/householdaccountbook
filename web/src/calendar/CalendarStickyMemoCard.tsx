import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
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

const IMG_MAX_BYTES = 1_800_000

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
          // sanitizeStickyNoteHtml 로 정제된 HTML
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
  const fileRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, setToolbarTick] = useState(0)

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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
        orderedList: false,
        bulletList: {
          HTMLAttributes: { class: 'list-disc pl-5 space-y-0.5' },
        },
      }),
      Underline,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: '메모를 작성하세요…',
      }),
    ],
    content: deriveEditorHtml(note.bodyHtml, note.body),
    editorProps: {
      attributes: {
        'aria-label': '스티커 메모 내용',
        class: `max-w-none min-h-[inherit] px-3 py-2 text-sm leading-relaxed outline-none [&_.ProseMirror]:outline-none [&_img]:max-h-48 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded ${
          note.tint === 'charcoal'
            ? 'text-white/92 [&_.ProseMirror]:text-white/92'
            : 'text-text-primary'
        }`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const raw = ed.getHTML()
      const safe = sanitizeStickyNoteHtml(raw)
      const plain = ed.getText().replace(/\s+/g, ' ').trim()
      schedulePatch(safe, plain)
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = deriveEditorHtml(note.bodyHtml, note.body)
    const cur = editor.getHTML()
    if (sanitizeStickyNoteHtml(cur) === sanitizeStickyNoteHtml(next)) return
    editor.commands.setContent(next, { emitUpdate: false })
  }, [editor, note.body, note.bodyHtml])

  useEffect(() => {
    if (!editor) return
    const bump = () => setToolbarTick((t) => t + 1)
    editor.on('selectionUpdate', bump)
    editor.on('transaction', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('transaction', bump)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const ink =
      note.tint === 'charcoal'
        ? 'text-white/92 [&_.ProseMirror]:text-white/92'
        : 'text-text-primary'
    const prevProps = editor.options.editorProps ?? {}
    editor.setOptions({
      editorProps: {
        ...prevProps,
        attributes: {
          ...(prevProps.attributes as Record<string, unknown>),
          'aria-label': '스티커 메모 내용',
          class: `max-w-none min-h-[inherit] px-3 py-2 text-sm leading-relaxed outline-none [&_.ProseMirror]:outline-none [&_img]:max-h-48 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded ${ink}`,
        },
      },
    })
  }, [editor, note.tint])

  const onImagePick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !editor) return
    if (!f.type.startsWith('image/')) return
    if (f.size > IMG_MAX_BYTES) {
      window.alert('이미지는 약 1.8MB 이하로 올려 주세요.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src.startsWith('data:image/')) return
      editor.chain().focus().setImage({ src }).run()
    }
    reader.readAsDataURL(f)
  }

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
    <div className="flex min-h-[18rem] flex-col overflow-hidden rounded-md border border-black/15 shadow-[3px_5px_18px_rgba(0,0,0,0.14)]">
      <header
        className={`flex h-9 shrink-0 items-center justify-between px-1.5 ${theme.headerClass}`}
      >
        <button
          type="button"
          className={theme.headerBtnClass}
          aria-label="새 메모"
          onClick={() => onAddAfter(note.id)}
        >
          <span className="text-lg font-light leading-none">+</span>
        </button>
        <div className="relative flex items-center gap-0.5" ref={paletteRef}>
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
              className={`absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border bg-surface-raised p-2 shadow-lg ${isCharcoal ? 'border-white/20' : 'border-black/10'}`}
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

      <div className={`min-h-0 flex-1 overflow-y-auto ${theme.bodyClass}`}>
        <EditorContent
          editor={editor}
          className={`sticky-editor min-h-[inherit] [&_.ProseMirror]:min-h-[11rem] ${theme.placeholderClass}`}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        onChange={onImagePick}
      />

      <footer
        className={`flex shrink-0 flex-wrap items-center gap-0.5 px-1.5 py-1 ${theme.footerClass}`}
      >
        {editor ? (
          <>
            <button
              type="button"
              className={`${theme.toolbarBtnClass} ${editor.isActive('bold') ? theme.toolbarBtnActiveClass : ''}`}
              aria-label="굵게"
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`${theme.toolbarBtnClass} ${editor.isActive('italic') ? theme.toolbarBtnActiveClass : ''}`}
              aria-label="기울임"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`${theme.toolbarBtnClass} ${editor.isActive('underline') ? theme.toolbarBtnActiveClass : ''}`}
              aria-label="밑줄"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <span className="underline">U</span>
            </button>
            <button
              type="button"
              className={`${theme.toolbarBtnClass} ${editor.isActive('strike') ? theme.toolbarBtnActiveClass : ''}`}
              aria-label="취소선"
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <s>ab</s>
            </button>
            <button
              type="button"
              className={`${theme.toolbarBtnClass} ${editor.isActive('bulletList') ? theme.toolbarBtnActiveClass : ''}`}
              aria-label="글머리 기호"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <span className="text-xs">•≡</span>
            </button>
            <button
              type="button"
              className={theme.toolbarBtnClass}
              aria-label="이미지 넣기"
              onClick={() => fileRef.current?.click()}
            >
              <span className="text-xs">▢</span>
            </button>
          </>
        ) : null}
      </footer>
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
