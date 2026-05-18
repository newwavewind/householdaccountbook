import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react'
import { CalendarInkColorDropdown } from './CalendarInkColorDropdown'
import { CalendarFontSize } from './calendarFontSizeExtension'
import {
  CALENDAR_FONT_SIZES,
  CALENDAR_RICH_FONTS,
  resolveCalendarFontSelectValue,
  resolveCalendarFontSizeSelectValue,
} from './calendarRichTextFonts'
import {
  sanitizeCalendarEventHtml,
  sanitizeStickyNoteHtml,
} from './calendarHtmlSanitize'
import type { CalendarEventInkId } from './calendarEventInk'
import type { StickyTint } from './calendarStickyNotesStorage'
import { STICKY_THEMES } from './stickyNoteTheme'

const IMG_MAX_BYTES = 1_800_000

function deriveContent(html: string | undefined, plain: string): string {
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

/** 부드러운 형광펜 느낌(원색 금지) — 사용자 지정 기본 5색 */
export const HIGHLIGHT_PALETTE = [
  { hex: '#ffc9cf', label: '빨강' },
  { hex: '#f8c8eb', label: '핑크' },
  { hex: '#c5edd2', label: '초록' },
  { hex: '#fff4b8', label: '노랑' },
  { hex: '#c6e7ff', label: '파랑' },
] as const

function useCloseOnDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return
    const onDocMouse = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouse, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouse, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, rootRef, onClose])
}

type Props = {
  'aria-label': string
  placeholder: string
  html: string | undefined
  plain: string
  onChange: (next: { html: string; plain: string }) => void
  minHeightClass?: string
  /** 스티커 메모와 같은 본문·하단 툴바 배치 */
  variant?: 'card' | 'sticky'
  /** sticky 변형일 때 메모지 헤더·푸터·본문 톤 */
  paperTint?: StickyTint
  /** sticky: 메모 글자색 — 글꼴 선택과 B 사이 */
  memoInk?: CalendarEventInkId | undefined
  onMemoInkChange?: (next: CalendarEventInkId | undefined) => void
  inkControlId?: string
  /** sticky 등 다른 HTML 정책이 필요할 때 */
  sanitizeHtml?: (raw: string) => string
}

export function CalendarEventRichField({
  'aria-label': ariaLabel,
  placeholder,
  html,
  plain,
  onChange,
  minHeightClass = 'min-h-[5rem]',
  variant = 'card',
  paperTint = 'yellow',
  memoInk,
  onMemoInkChange,
  inkControlId,
  sanitizeHtml,
}: Props) {
  const sanitize =
    sanitizeHtml ?? (variant === 'sticky' ? sanitizeStickyNoteHtml : sanitizeCalendarEventHtml)

  const [fontSel, setFontSel] = useState('')
  const [fontSizeSel, setFontSizeSel] = useState('')
  const [highlightOpen, setHighlightOpen] = useState(false)
  const [, setToolbarTick] = useState(0)
  const hlWrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useCloseOnDismiss(highlightOpen, hlWrapRef, () => setHighlightOpen(false))

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: {
          HTMLAttributes: { class: 'list-disc pl-5 space-y-0.5' },
        },
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      CalendarFontSize,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: deriveContent(html, plain),
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        class: `max-w-full px-3 py-2.5 text-sm text-text-primary outline-none ring-0 focus-visible:ring-0 ${minHeightClass} [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror]:outline-none [&_.ProseMirror]:leading-relaxed [&_img]:max-h-48 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const style = ed.getAttributes('textStyle')
      setFontSel((style.fontFamily as string) ?? '')
      setFontSizeSel((style.fontSize as string) ?? '')
      const raw = ed.getHTML()
      const safe = sanitize(raw)
      onChange({ html: safe, plain: ed.getText().trim() })
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const style = ed.getAttributes('textStyle')
      setFontSel((style.fontFamily as string) ?? '')
      setFontSizeSel((style.fontSize as string) ?? '')
    },
  })

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
    const next = deriveContent(html, plain)
    const cur = editor.getHTML()
    if (next !== cur && next.replace(/\s/g, '') !== cur.replace(/\s/g, '')) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
    const style = editor.getAttributes('textStyle')
    setFontSel((style.fontFamily as string) ?? '')
    setFontSizeSel((style.fontSize as string) ?? '')
  }, [editor, html, plain])

  if (!editor) return null

  const highlightOn = editor.isActive('highlight')
  const isSticky = variant === 'sticky'
  const st = STICKY_THEMES[paperTint]

  function pushChange() {
    onChange({
      html: sanitize(editor.getHTML()),
      plain: editor.getText().trim(),
    })
  }

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
      pushChange()
    }
    reader.readAsDataURL(f)
  }

  const highlightPanel = highlightOpen ? (
    <div
      role="dialog"
      aria-label="형광 색 선택"
      className={`absolute ${isSticky ? 'bottom-full left-0 mb-1' : 'right-0 top-full mt-1'} z-[60] w-[min(100vw-2rem,11.5rem)] rounded-[var(--radius-card)] border border-border-subtle bg-surface-raised p-2 shadow-[var(--shadow-frap-stack)]`}
    >
      <div className="grid grid-cols-5 gap-1">
        {HIGHLIGHT_PALETTE.map((opt) => {
          const pressed = editor.isActive('highlight', { color: opt.hex })
          return (
            <button
              key={opt.hex}
              type="button"
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={pressed}
              className={[
                'aspect-square w-full rounded-md border outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-green-accent/40',
                pressed
                  ? 'ring-2 ring-green-accent ring-offset-1 ring-offset-surface-raised'
                  : 'border-border-default hover:border-border-strong',
              ].join(' ')}
              style={{ backgroundColor: opt.hex }}
              onClick={() => {
                if (editor.isActive('highlight', { color: opt.hex })) {
                  editor.chain().focus().unsetHighlight().run()
                } else {
                  editor.chain().focus().setHighlight({ color: opt.hex }).run()
                }
                pushChange()
              }}
            />
          )
        })}
      </div>
      <button
        type="button"
        className="mt-2 w-full rounded-md border border-border-muted py-1 text-[10px] text-text-soft transition-colors hover:bg-well"
        onClick={() => {
          editor.chain().focus().unsetHighlight().run()
          pushChange()
        }}
      >
        형광 모두 해제
      </button>
    </div>
  ) : null

  const toolbarSelectClass = isSticky
    ? `${st.toolbarBtnClass} h-7 max-w-[4.75rem] shrink-0 rounded border border-black/10 bg-white/80 px-1 text-[9px]`
    : 'h-8 max-w-[5.5rem] shrink-0 rounded-md border border-border-default bg-surface-raised px-2 text-[11px] text-text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-green-accent/35'

  const fontSelect = (
    <>
      <label className="sr-only" htmlFor={`cal-font-${encodeURIComponent(ariaLabel)}`}>
        글꼴
      </label>
      <select
        id={`cal-font-${encodeURIComponent(ariaLabel)}`}
        value={resolveCalendarFontSelectValue(fontSel)}
        onChange={(e) => {
          const v = e.target.value
          const chain = editor.chain().focus()
          if (!v) {
            chain.unsetFontFamily().run()
          } else {
            chain.setFontFamily(v).run()
          }
          setFontSel(v)
          pushChange()
        }}
        className={toolbarSelectClass}
      >
        {CALENDAR_RICH_FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </>
  )

  const fontSizeSelect = (
    <>
      <label className="sr-only" htmlFor={`cal-font-size-${encodeURIComponent(ariaLabel)}`}>
        글자 크기
      </label>
      <select
        id={`cal-font-size-${encodeURIComponent(ariaLabel)}`}
        value={resolveCalendarFontSizeSelectValue(fontSizeSel)}
        onChange={(e) => {
          const v = e.target.value
          const chain = editor.chain().focus()
          if (!v) {
            chain.unsetFontSize().run()
          } else {
            chain.setFontSize(v).run()
          }
          setFontSizeSel(v)
          pushChange()
        }}
        className={toolbarSelectClass}
      >
        {CALENDAR_FONT_SIZES.map((s) => (
          <option key={s.label} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </>
  )

  const boldItalic = (
    <>
      <button
        type="button"
        onClick={() => {
          editor.chain().focus().toggleBold().run()
          pushChange()
        }}
        className={
          isSticky
            ? `${st.toolbarBtnClass} ${editor.isActive('bold') ? st.toolbarBtnActiveClass : ''}`
            : `h-8 min-w-8 shrink-0 rounded-md border px-2 text-[11px] font-bold transition-colors ${
                editor.isActive('bold')
                  ? 'border-green-accent bg-green-light/50 text-text-primary'
                  : 'border-transparent bg-surface-raised text-text-secondary hover:bg-well'
              }`
        }
        aria-label="굵게"
      >
        {isSticky ? <strong>B</strong> : '굵게'}
      </button>
      <button
        type="button"
        onClick={() => {
          editor.chain().focus().toggleItalic().run()
          pushChange()
        }}
        className={
          isSticky
            ? `${st.toolbarBtnClass} ${editor.isActive('italic') ? st.toolbarBtnActiveClass : ''}`
            : `h-8 min-w-8 shrink-0 rounded-md border px-2 text-[11px] italic transition-colors ${
                editor.isActive('italic')
                  ? 'border-green-accent bg-green-light/50 text-text-primary'
                  : 'border-transparent bg-surface-raised text-text-secondary hover:bg-well'
              }`
        }
        aria-label="기울임"
      >
        {isSticky ? <em>I</em> : '기울임'}
      </button>
    </>
  )

  const underlineStrikeListImgSticky = isSticky ? (
    <>
      <button
        type="button"
        className={`${st.toolbarBtnClass} ${editor.isActive('underline') ? st.toolbarBtnActiveClass : ''}`}
        aria-label="밑줄"
        onClick={() => {
          editor.chain().focus().toggleUnderline().run()
          pushChange()
        }}
      >
        <span className="underline">U</span>
      </button>
      <button
        type="button"
        className={`${st.toolbarBtnClass} ${editor.isActive('strike') ? st.toolbarBtnActiveClass : ''}`}
        aria-label="취소선"
        onClick={() => {
          editor.chain().focus().toggleStrike().run()
          pushChange()
        }}
      >
        <s>ab</s>
      </button>
      <button
        type="button"
        className={`${st.toolbarBtnClass} ${editor.isActive('bulletList') ? st.toolbarBtnActiveClass : ''}`}
        aria-label="글머리 기호"
        onClick={() => {
          editor.chain().focus().toggleBulletList().run()
          pushChange()
        }}
      >
        <span className="text-xs">•≡</span>
      </button>
      <button
        type="button"
        className={st.toolbarBtnClass}
        aria-label="이미지 넣기"
        onClick={() => fileRef.current?.click()}
      >
        <span className="text-xs">▢</span>
      </button>
    </>
  ) : null

  const highlightBlock = (
    <div
      ref={hlWrapRef}
      className={`relative flex min-w-0 items-center ${isSticky ? '' : 'flex-1 sm:flex-initial'}`}
    >
      <button
        type="button"
        aria-expanded={highlightOpen}
        aria-haspopup="dialog"
        onClick={() => setHighlightOpen((o) => !o)}
        className={
          isSticky
            ? [
                st.toolbarBtnClass,
                highlightOpen || highlightOn ? st.toolbarBtnActiveClass : '',
              ].join(' ')
            : [
                'h-8 shrink-0 rounded-md border px-2 text-[11px] font-medium transition-colors',
                highlightOpen || highlightOn
                  ? 'border-green-accent/60 bg-green-light/40 text-text-primary'
                  : 'border-transparent bg-surface-raised text-text-secondary hover:bg-well',
              ].join(' ')
        }
      >
        {isSticky ? <span className="text-xs">형광</span> : '형광'}
      </button>
      {highlightPanel}
    </div>
  )

  const memoInkControl =
    isSticky && onMemoInkChange ? (
      <CalendarInkColorDropdown
        id={inkControlId ?? `cal-ink-${encodeURIComponent(ariaLabel)}`}
        aria-label={`${ariaLabel} 글자색`}
        ink={memoInk}
        density="toolbar"
        menuAlign="left"
        onPick={onMemoInkChange}
      />
    ) : null

  const toolbar = isSticky ? (
    <>
      {fontSelect}
      {fontSizeSelect}
      {memoInkControl}
      {boldItalic}
      {underlineStrikeListImgSticky}
      {highlightBlock}
    </>
  ) : (
    <>
      {fontSelect}
      {fontSizeSelect}
      <span
        className="mx-0.5 hidden h-5 w-px shrink-0 bg-border-muted sm:block"
        aria-hidden
      />
      {boldItalic}
      <span
        className="mx-0.5 hidden h-5 w-px shrink-0 bg-border-muted sm:block"
        aria-hidden
      />
      {highlightBlock}
    </>
  )

  if (isSticky) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-transparent">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden
          onChange={onImagePick}
        />
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${st.placeholderClass} [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2`}
        >
          <EditorContent
            editor={editor}
            className="min-h-[inherit] [&_.ProseMirror]:min-h-[11rem]"
          />
        </div>
        <div
          className={`flex shrink-0 flex-wrap items-center gap-0.5 px-1.5 py-1 ${st.footerClass}`}
          role="toolbar"
          aria-label={`${ariaLabel} 서식`}
        >
          {toolbar}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-[var(--radius-card)] border border-border-subtle bg-surface-raised shadow-[var(--shadow-card)]">
      <div
        className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border-muted bg-ceramic/35 px-2 py-1.5 theme2:border-border-subtle theme2:bg-well theme2:shadow-none theme3:bg-neutral-cool/40"
        role="toolbar"
        aria-label={`${ariaLabel} 서식`}
      >
        {toolbar}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
