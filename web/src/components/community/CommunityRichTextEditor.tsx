import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, Node, mergeAttributes, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { getCommunitySupabase } from '../../lib/communitySupabaseClient'

const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      style: { default: 'max-width:100%;border-radius:8px;' },
    }
  },
  parseHTML() {
    return [{ tag: 'video' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes)]
  },
})

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
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { style: 'max-width:100%;border-radius:8px;' },
      }),
      VideoNode,
    ],
    content: initialHtml || '',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => onHtmlChange(ed.getHTML()),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return

    const sb = getCommunitySupabase()
    if (!sb) { alert('Supabase 연결이 필요합니다.'); return }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('community-media').upload(path, file)
      if (error) throw new Error(error.message)

      const { data: urlData } = sb.storage.from('community-media').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      if (file.type.startsWith('video/')) {
        editor.chain().focus().insertContent({
          type: 'video',
          attrs: { src: publicUrl, controls: true },
        }).run()
      } else {
        editor.chain().focus().setImage({ src: publicUrl, alt: '업로드 이미지' }).run()
      }
      onHtmlChange(editor.getHTML())
    } catch (err) {
      alert(err instanceof Error ? err.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

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
        <Button type="button" variant="outlined" className="!px-2 !py-0.5 !text-xs" disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()} data-active={editor.isActive('bold')}>
          굵게
        </Button>
        <Button type="button" variant="outlined" className="!px-2 !py-0.5 !text-xs" disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()} data-active={editor.isActive('italic')}>
          기울임
        </Button>
        <Button type="button" variant="outlined" className="!px-2 !py-0.5 !text-xs" disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()} data-active={editor.isActive('strike')}>
          취소선
        </Button>
        <Button type="button" variant="outlined" className="!px-2 !py-0.5 !text-xs" disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} data-active={editor.isActive('heading', { level: 2 })}>
          제목
        </Button>
        <Button type="button" variant="outlined" className="!px-2 !py-0.5 !text-xs" disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()} data-active={editor.isActive('bulletList')}>
          목록
        </Button>
        <Button type="button" variant="outlined" className="!px-2 !py-0.5 !text-xs" disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()} data-active={editor.isActive('orderedList')}>
          번호
        </Button>
        <Button type="button" variant="outlined" className="!px-2 !py-0.5 !text-xs" disabled={disabled}
          onClick={setLink} data-active={editor.isActive('link')}>
          링크
        </Button>
        {/* 미디어 업로드 버튼 */}
        <Button
          type="button"
          variant="outlined"
          className="!px-2 !py-0.5 !text-xs"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? '업로드 중…' : '📷 사진·동영상'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={handleMediaUpload}
        />
      </div>
      <EditorContent editor={editor} className="community-rich-editor flex-1 px-3 py-2" />
    </div>
  )
}
