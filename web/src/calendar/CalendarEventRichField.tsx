import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'
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
  { label: '고정폭', value: 'Consolas, monospace' },
] as const

const HL = ['#fef08a', '#bbf7d0', '#fbcfe8'] as const

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

  return (
    <div className="w-full">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor={`cal-font-${encodeURIComponent(ariaLabel)}`}>
          글꼴
        </label>
        <select
          id={`cal-font-${encodeURIComponent(ariaLabel)}`}
          value={
            FONTS.some((f) => f.value === fontSel) ? fontSel : ''
          }
          onChange={(e) => {
            const v = e.target.value
            const chain = editor.chain().focus()
            if (!v) {
              chain.unsetFontFamily().run()
            } else {
              chain.setFontFamily(v).run()
            }
            setFontSel(v)
            onChange({
              html: sanitizeCalendarEventHtml(editor.getHTML()),
              plain: editor.getText().trim(),
            })
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
            onChange({
              html: sanitizeCalendarEventHtml(editor.getHTML()),
              plain: editor.getText().trim(),
            })
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
            onChange({
              html: sanitizeCalendarEventHtml(editor.getHTML()),
              plain: editor.getText().trim(),
            })
          }}
          className={`rounded-md border px-2 py-1 text-xs italic ${
            editor.isActive('italic')
              ? 'border-starbucks-green bg-green-light'
              : 'border-black/[0.12] bg-white'
          }`}
        >
          기울임
        </button>
        <span className="text-[0.65rem] font-medium text-text-soft">형광</span>
        {HL.map((c) => (
          <button
            key={c}
            type="button"
            title="형광펜"
            className="h-6 w-6 rounded border border-black/15 shadow-inner"
            style={{ backgroundColor: c }}
            onClick={() => {
              if (editor.isActive('highlight', { color: c })) {
                editor.chain().focus().unsetHighlight().run()
              } else {
                editor.chain().focus().setHighlight({ color: c }).run()
              }
              onChange({
                html: sanitizeCalendarEventHtml(editor.getHTML()),
                plain: editor.getText().trim(),
              })
            }}
          />
        ))}
        <button
          type="button"
          className="text-xs text-text-soft underline decoration-black/20"
          onClick={() => {
            editor.chain().focus().unsetHighlight().run()
            onChange({
              html: sanitizeCalendarEventHtml(editor.getHTML()),
              plain: editor.getText().trim(),
            })
          }}
        >
          형광 해제
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
