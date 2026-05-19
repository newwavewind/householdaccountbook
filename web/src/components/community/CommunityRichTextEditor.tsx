import FontFamily from '@tiptap/extension-font-family'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, Node, mergeAttributes, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import {
  CALENDAR_RICH_FONTS,
  resolveCalendarFontSelectValue,
} from '../../calendar/calendarRichTextFonts'
import { CalendarFontSize } from '../../calendar/calendarFontSizeExtension'
import { CommunityTextColor } from '../../calendar/communityTextColorExtension'
import {
  COMMUNITY_FONT_SIZE_OPTIONS,
  resolveCommunityFontSizeValue,
} from '../../community/communityEditorFontSizes'
import { getCommunitySupabase } from '../../lib/communitySupabaseClient'
import { Button } from '../ui/Button'
import { CommunityTextColorPicker } from './CommunityTextColorPicker'

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

const toolbarSelectClass =
  'h-7 max-w-[4.5rem] shrink-0 rounded border border-border-subtle bg-surface-raised px-1.5 text-[10px] text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-green-accent/35'

export function CommunityRichTextEditor({
  initialHtml,
  onHtmlChange,
  disabled,
  'aria-labelledby': ariaLabelledBy,
}: Props) {
  const [fontSel, setFontSel] = useState('')
  const [fontSizeSel, setFontSizeSel] = useState('')
  const [, setToolbarTick] = useState(0)

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
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      CalendarFontSize,
      CommunityTextColor,
    ],
    content: initialHtml || '',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => onHtmlChange(ed.getHTML()),
    onSelectionUpdate: ({ editor: ed }) => {
      const style = ed.getAttributes('textStyle')
      setFontSel((style.fontFamily as string) ?? '')
      setFontSizeSel((style.fontSize as string) ?? '')
      setToolbarTick((t) => t + 1)
    },
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
    if (!sb) {
      alert('Supabase 연결이 필요합니다.')
      return
    }

    setUploading(true)
    try {
      const {
        data: { session },
      } = await sb.auth.getSession()
      if (!session) {
        alert(
          '사진을 업로드하려면 구글 로그인이 필요합니다.\n오른쪽 상단 "로그인" 버튼을 눌러 로그인해 주세요.',
        )
        return
      }

      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('community-media').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (error) {
        if (error.message.includes('row-level security') || error.message.includes('Unauthorized')) {
          throw new Error('업로드 권한이 없습니다. 로그인 상태를 확인해 주세요.')
        }
        throw new Error(error.message)
      }

      const { data: urlData } = sb.storage.from('community-media').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      if (file.type.startsWith('video/')) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'video',
            attrs: { src: publicUrl, controls: true },
          })
          .run()
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

  return (
    <div
      className="mt-1 flex min-h-[14rem] flex-col overflow-hidden rounded-[var(--radius-card)] border border-input-border text-text-primary focus-within:border-green-accent"
      aria-labelledby={ariaLabelledBy}
    >
      <div
        className="flex flex-wrap items-center gap-1 border-b border-border-muted bg-neutral-warm/60 px-2 py-1.5"
        role="toolbar"
        aria-label="서식"
      >
        <label className="sr-only" htmlFor="community-editor-font">
          글꼴
        </label>
        <select
          id="community-editor-font"
          disabled={disabled}
          value={resolveCalendarFontSelectValue(fontSel)}
          onChange={(e) => {
            const v = e.target.value
            const chain = editor.chain().focus()
            if (!v) chain.unsetFontFamily().run()
            else chain.setFontFamily(v).run()
            setFontSel(v)
          }}
          className={toolbarSelectClass}
          style={{
            fontFamily: resolveCalendarFontSelectValue(fontSel) || undefined,
          }}
        >
          {CALENDAR_RICH_FONTS.map((f) => (
            <option key={f.label} value={f.value} style={{ fontFamily: f.value || undefined }}>
              {f.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="community-editor-font-size">
          글자 크기
        </label>
        <select
          id="community-editor-font-size"
          disabled={disabled}
          value={resolveCommunityFontSizeValue(fontSizeSel)}
          onChange={(e) => {
            const v = e.target.value
            const chain = editor.chain().focus()
            if (!v) chain.unsetFontSize().run()
            else chain.setFontSize(v).run()
            setFontSizeSel(v)
          }}
          className={`${toolbarSelectClass} max-w-[3.25rem]`}
        >
          {COMMUNITY_FONT_SIZE_OPTIONS.map((s) => (
            <option key={s.label + s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <CommunityTextColorPicker editor={editor} disabled={disabled} />

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
