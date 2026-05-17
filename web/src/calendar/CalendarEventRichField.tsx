import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { sanitizeCalendarEventHtml } from './calendarHtmlSanitize'

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

const FONTS = [
  { label: '기본', value: '' },
  { label: '본고딕', value: 'system-ui, sans-serif' },
  { label: '명조', value: 'Georgia, "Apple SD Gothic Neo", serif' },
  { label: '궁서', value: '"Gungsuh", "궁서", Batang, "Apple SD Gothic Neo", serif' },
  { label: '고정폭', value: 'Consolas, monospace' },
] as const

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
}

export function CalendarEventRichField({
  'aria-label': ariaLabel,
  placeholder,
  html,
  plain,
  onChange,
  minHeightClass = 'min-h-[5rem]',
}: Props) {
  const [fontSel, setFontSel] = useState('')
  const [highlightOpen, setHighlightOpen] = useState(false)
  const hlWrapRef = useRef<HTMLDivElement>(null)

  useCloseOnDismiss(highlightOpen, hlWrapRef, () => setHighlightOpen(false))

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: deriveContent(html, plain),
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        class: `mt-1 max-w-full rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-sm outline-none ring-green-accent/30 focus-within:ring-2 ${minHeightClass} [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror]:outline-none`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const ff = (ed.getAttributes('textStyle').fontFamily as string) ?? ''
      setFontSel(ff)
      const raw = ed.getHTML()
      const safe = sanitizeCalendarEventHtml(raw)
      onChange({ html: safe, plain: ed.getText().trim() })
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const ff = (ed.getAttributes('textStyle').fontFamily as string) ?? ''
      setFontSel(ff)
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = deriveContent(html, plain)
    const cur = editor.getHTML()
    if (next !== cur && next.replace(/\s/g, '') !== cur.replace(/\s/g, '')) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
    const ff = (editor.getAttributes('textStyle').fontFamily as string) ?? ''
    setFontSel(ff)
  }, [editor, html, plain])

  if (!editor) return null

  const highlightOn = editor.isActive('highlight')

  function pushChange() {
    onChange({
      html: sanitizeCalendarEventHtml(editor.getHTML()),
      plain: editor.getText().trim(),
    })
  }

  return (
    <div className="w-full">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor={`cal-font-${encodeURIComponent(ariaLabel)}`}>
          글꼴
        </label>
        <select
          id={`cal-font-${encodeURIComponent(ariaLabel)}`}
          value={FONTS.some((f) => f.value === fontSel) ? fontSel : ''}
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
          className="rounded-md border border-black/[0.12] bg-white px-2 py-1 text-xs outline-none focus:border-green-accent"
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleBold().run()
            pushChange()
          }}
          className={`rounded-md border px-2 py-1 text-xs font-bold ${
            editor.isActive('bold')
              ? 'border-starbucks-green bg-green-light'
              : 'border-black/[0.12] bg-white'
          }`}
        >
          굵게
        </button>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleItalic().run()
            pushChange()
          }}
          className={`rounded-md border px-2 py-1 text-xs italic ${
            editor.isActive('italic')
              ? 'border-starbucks-green bg-green-light'
              : 'border-black/[0.12] bg-white'
          }`}
        >
          기울임
        </button>

        <div ref={hlWrapRef} className="relative inline-block">
          <button
            type="button"
            aria-expanded={highlightOpen}
            aria-haspopup="dialog"
            onClick={() => setHighlightOpen((o) => !o)}
            className={[
              'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              highlightOpen || highlightOn
                ? 'border-starbucks-green bg-green-light text-starbucks-green'
                : 'border-black/[0.12] bg-white text-[rgba(0,0,0,0.75)]',
            ].join(' ')}
          >
            형광
          </button>
          {highlightOpen ? (
            <div
              role="dialog"
              aria-label="형광 색 선택"
              className="absolute left-0 top-full z-[60] mt-1 w-[min(100vw-2rem,12.5rem)] rounded-lg border border-black/[0.12] bg-white p-2 shadow-lg"
            >
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-text-soft">
                색 선택
              </p>
              <div className="grid grid-cols-5 gap-1.5">
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
                        'h-8 w-full rounded-md border shadow-inner outline-none ring-green-accent/0 transition-shadow focus-visible:ring-2',
                        pressed
                          ? 'ring-2 ring-starbucks-green ring-offset-1'
                          : 'border-black/15 hover:border-black/30',
                      ].join(' ')}
                      style={{ backgroundColor: opt.hex }}
                      onClick={() => {
                        if (
                          editor.isActive('highlight', { color: opt.hex })
                        ) {
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
                className="mt-2 w-full rounded-md border border-black/[0.1] px-2 py-1 text-[0.7rem] text-text-soft underline decoration-black/20"
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run()
                  pushChange()
                }}
              >
                형광 해제
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
