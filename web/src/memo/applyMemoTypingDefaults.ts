import type { Editor } from '@tiptap/react'
import type { MemoDefaults } from './memoDefaultsStorage'

export function isMemoEditorEmpty(editor: Editor): boolean {
  if (editor.getText().trim()) return false
  const html = editor.getHTML().trim()
  return (
    html === '' ||
    html === '<p></p>' ||
    html === '<p><br></p>' ||
    html === '<p><br class="ProseMirror-trailingBreak"></p>'
  )
}

/** 빈 메모에 새로 입력할 때 적용할 글꼴·크기 마크 */
export function applyMemoTypingDefaults(
  editor: Editor,
  defaults: MemoDefaults,
): void {
  if (!defaults.fontFamily && !defaults.fontSize) {
    editor.chain().focus().unsetMark('textStyle').run()
    return
  }
  const attrs: { fontFamily?: string | null; fontSize?: string | null } = {}
  if (defaults.fontFamily) attrs.fontFamily = defaults.fontFamily
  if (defaults.fontSize) attrs.fontSize = defaults.fontSize
  editor.chain().focus().setMark('textStyle', attrs).run()
}
