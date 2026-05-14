import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { Button } from '../ui/Button'

type Props = {
  initialHtml: string
  onHtmlChange: (html: string) => void
  disabled?: boolean
  'aria-labelledby'?: string
}

export function CommunityRichTextEditor({
  initialHtml,
  onHtmlChange,
  disabled,
  'aria-labelledby': ariaLabelledBy,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: '내용을 입력하세요…',
      }),
    ],
    content: initialHtml || '',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => onHtmlChange(ed.getHTML()),
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) {
    return (
      <div
        className="mt-1 min-h-[14rem] rounded-[var(--radius-card)] border border-input-border px-3 py-2 text-sm text-text-soft"
        aria-labelledby={ariaLabelledBy}
      >
        편집기 준비 중…
      </div>
    )
  }

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const next = window.prompt('링크 URL', prev ?? 'https://')
    if (next === null) return
    const t = next.trim()
    if (t === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: t }).run()
  }

  return (
    <div
      className="mt-1 flex min-h-[14rem] flex-col overflow-hidden rounded-[var(--radius-card)] border border-input-border text-[rgba(0,0,0,0.87)] focus-within:border-green-accent"
      aria-labelledby={ariaLabelledBy}
    >
      <div
        className="flex flex-wrap gap-1 border-b border-black/[0.06] bg-neutral-warm/60 px-2 py-1.5"
        role="toolbar"
        aria-label="서식"
      >
        <Button
          type="button"
          variant="outlined"
          className="!px-2 !py-0.5 !text-xs"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-active={editor.isActive('bold')}
        >
          굵게
        </Button>
        <Button
          type="button"
          variant="outlined"
          className="!px-2 !py-0.5 !text-xs"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-active={editor.isActive('italic')}
        >
          기울임
        </Button>
        <Button
          type="button"
          variant="outlined"
          className="!px-2 !py-0.5 !text-xs"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          data-active={editor.isActive('strike')}
        >
          취소선
        </Button>
        <Button
          type="button"
          variant="outlined"
          className="!px-2 !py-0.5 !text-xs"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          data-active={editor.isActive('heading', { level: 2 })}
        >
          제목
        </Button>
        <Button
          type="button"
          variant="outlined"
          className="!px-2 !py-0.5 !text-xs"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          data-active={editor.isActive('bulletList')}
        >
          목록
        </Button>
        <Button
          type="button"
          variant="outlined"
          className="!px-2 !py-0.5 !text-xs"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          data-active={editor.isActive('orderedList')}
        >
          번호
        </Button>
        <Button
          type="button"
          variant="outlined"
          className="!px-2 !py-0.5 !text-xs"
          disabled={disabled}
          onClick={setLink}
          data-active={editor.isActive('link')}
        >
          링크
        </Button>
      </div>
      <EditorContent editor={editor} className="community-rich-editor flex-1 px-3 py-2" />
    </div>
  )
}
