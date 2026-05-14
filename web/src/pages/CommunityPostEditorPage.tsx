import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useCommunityAuth } from '../community/CommunityAuthContext'
import { useCommunityPost } from '../community/useCommunityPosts'
import { resolveCommunityRepository } from '../community/repository'
import { readMockSession } from '../community/mockSessionStorage'
import { CommunityRichTextEditor } from '../components/community/CommunityRichTextEditor'
import { postBodyToPlainText } from '../lib/communityPostHtml'

export default function CommunityPostEditorPage({
  mode,
}: {
  mode: 'new' | 'edit'
}) {
  const { id } = useParams<{ id: string }>()
  const auth = useCommunityAuth()
  const nav = useNavigate()
  const { post, busy } = useCommunityPost(mode === 'edit' ? id : undefined)
  const repo = useMemo(
    () => resolveCommunityRepository(readMockSession()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth.user?.id, auth.role],
  )

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'edit' || !post || busy) return
    queueMicrotask(() => {
      setTitle(post.title)
      setBody(post.body)
    })
  }, [mode, post, busy])

  if (!auth.user) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErr('제목을 입력하세요.')
      return
    }
    if (!postBodyToPlainText(body)) {
      setErr('내용을 입력하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    void (async () => {
      try {
        if (mode === 'new') {
          const row = await repo.createPost({
            title,
            body: body.trim(),
            authorId: auth.user!.id,
            authorDisplayName: auth.user!.displayName,
          })
          nav(`/community/${row.id}`, { replace: true })
        } else if (id) {
          await repo.updatePost(id, {
            title,
            body: body.trim(),
          })
          nav(`/community/${id}`, { replace: true })
        }
      } catch (m) {
        setErr(m instanceof Error ? m.message : '저장하지 못했습니다.')
      } finally {
        setSaving(false)
      }
    })()
  }

  if (mode === 'edit' && busy && !post) {
    return <p className="px-4 py-8 text-center text-sm text-text-soft">불러오는 중…</p>
  }

  if (mode === 'edit' && !busy && id && !post) {
    return <p className="px-4 py-8 text-center text-sm text-danger">글을 불러오지 못했습니다.</p>
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6">
      <h1 className="font-serif-display text-starbucks-green">{mode === 'new' ? '글쓰기' : '글 수정'}</h1>
      <Card className="mt-4 border border-black/[0.06] bg-white p-6 md:p-8">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="pt" className="block text-xs font-semibold text-text-soft">
              제목
            </label>
            <input
              id="pt"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-[var(--radius-card)] border border-input-border px-3 py-2 text-[rgba(0,0,0,0.87)] outline-none focus:border-green-accent"
            />
          </div>
          <div className="flex min-h-[14rem] flex-col">
            <span id="pb" className="block text-xs font-semibold text-text-soft">
              내용
            </span>
            <CommunityRichTextEditor
              key={mode === 'edit' && id ? id : 'new'}
              initialHtml={
                mode === 'edit' && post ? post.body : body
              }
              onHtmlChange={setBody}
              disabled={saving}
              aria-labelledby="pb"
            />
          </div>
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={saving}
              onClick={() => nav(-1)}
            >
              취소
            </Button>
          </div>
        </form>
      </Card>
    </main>
  )
}
