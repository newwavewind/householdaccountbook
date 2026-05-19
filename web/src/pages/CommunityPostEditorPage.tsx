import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CommunityNicknameField } from '../components/community/CommunityNicknameField'
import { PostVisibilityPicker } from '../components/community/PostVisibilityPicker'
import { useCommunityAuth } from '../community/CommunityAuthContext'
import { getGuestNickname, setGuestNickname } from '../community/communityGuest'
import { useCommunityPost } from '../community/useCommunityPosts'
import { resolveCommunityRepository } from '../community/repository'
import { readMockSession } from '../community/mockSessionStorage'
import { CommunityRichTextEditor } from '../components/community/CommunityRichTextEditor'
import { postBodyToPlainText } from '../lib/communityPostHtml'
import { gradeLabel } from '../community/communityGrades'
import type { PostVisibility } from '../community/types'

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

  const isGuest = !auth.user
  const [nickname, setNickname] = useState(() =>
    auth.user?.displayName || getGuestNickname() || '',
  )
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<PostVisibility>('public')
  const [isNotice, setIsNotice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const canEdit =
    mode === 'new' ||
    Boolean(
      auth.user &&
        post &&
        (post.authorId === auth.user.id || auth.role === 'admin'),
    )

  useEffect(() => {
    if (mode !== 'edit' || !post || busy) return
    queueMicrotask(() => {
      setTitle(post.title)
      setBody(post.body)
      setVisibility(post.visibility)
      setIsNotice(Boolean(post.isNotice))
    })
  }, [mode, post, busy])

  useEffect(() => {
    if (isGuest && visibility !== 'public') {
      setVisibility('public')
    }
  }, [isGuest, visibility])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErr('제목\uc744 \uc785\ub825\ud558\uc138\uc694.')
      return
    }
    if (!postBodyToPlainText(body)) {
      setErr('\ub0b4\uc6a9\uc744 \uc785\ub825\ud558\uc138\uc694.')
      return
    }
    const displayName = (auth.user?.displayName || nickname).trim()
    if (!displayName) {
      setErr('\ub2c9\ub124\uc784\uc744 \uc785\ub825\ud558\uc138\uc694.')
      return
    }
    if (isGuest) setGuestNickname(displayName)

    setSaving(true)
    setErr(null)
    void (async () => {
      try {
        if (mode === 'new') {
          const row = await repo.createPost({
            title,
            body: body.trim(),
            authorId: auth.user?.id ?? null,
            authorDisplayName: displayName,
            visibility: isGuest ? 'public' : visibility,
            isNotice: auth.canWriteNotice ? isNotice : false,
          })
          nav(`/community/${row.id}`, { replace: true })
        } else if (id) {
          await repo.updatePost(id, {
            title,
            body: body.trim(),
            visibility: isGuest ? undefined : visibility,
            isNotice: auth.canWriteNotice ? isNotice : undefined,
          })
          nav(`/community/${id}`, { replace: true })
        }
      } catch (m) {
        setErr(m instanceof Error ? m.message : '\uc800\uc7a5\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.')
      } finally {
        setSaving(false)
      }
    })()
  }

  if (mode === 'edit' && busy && !post) {
    return <p className="px-4 py-8 text-center text-sm text-text-soft">\ubd88\ub7ec\uc624\ub294 \uc911\u2026</p>
  }

  if (mode === 'edit' && !busy && id && !post) {
    return <p className="px-4 py-8 text-center text-sm text-danger">\uae00\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.</p>
  }

  if (mode === 'edit' && !canEdit) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6">
        <p className="text-sm text-text-soft">
          \uc218\uc815 \uad8c\ud55c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4. \ub85c\uadf8\uc778\ud55c \uc791\uc131\uc790\ub9cc \uc218\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6">
      <h1 className="font-serif-display text-starbucks-green">
        {mode === 'new' ? '\uae00\uc4f0\uae30' : '\uae00 \uc218\uc815'}
      </h1>
      <Card className="mt-4 border border-border-muted bg-surface-raised p-6 md:p-8">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {isGuest ? (
            <CommunityNicknameField value={nickname} onChange={setNickname} disabled={saving} />
          ) : null}
          <div>
            <label htmlFor="pt" className="block text-xs font-semibold text-text-soft">
              제목
            </label>
            <input
              id="pt"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-[var(--radius-card)] border border-input-border px-3 py-2 text-text-primary outline-none focus:border-green-accent"
            />
          </div>
          <div className="flex min-h-[14rem] flex-col">
            <span id="pb" className="block text-xs font-semibold text-text-soft">
              내용
            </span>
            <CommunityRichTextEditor
              key={mode === 'edit' && id ? id : 'new'}
              initialHtml={mode === 'edit' && post ? post.body : body}
              onHtmlChange={setBody}
              disabled={saving}
              aria-labelledby="pb"
              allowGuestMedia={isGuest}
            />
          </div>
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-muted/80 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
            <PostVisibilityPicker
              value={visibility}
              onChange={setVisibility}
              disabled={saving}
              isGuest={isGuest}
            />
            {auth.canWriteNotice ? (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-text-secondary">
                <input
                  type="checkbox"
                  checked={isNotice}
                  onChange={(e) => setIsNotice(e.target.checked)}
                  disabled={saving}
                  className="accent-amber-600"
                />
                공지 등록
              </label>
            ) : auth.user ? (
              <span className="text-[11px] text-text-soft" title={`현재 등급: ${gradeLabel(auth.communityGrade)}`}>
                공지는 우수 등급 이상
              </span>
            ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? '\uc800\uc7a5 \uc911\u2026' : '\uc800\uc7a5'}
              </Button>
              <Button type="button" variant="outlined" disabled={saving} onClick={() => nav(-1)}>
                취소
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </main>
  )
}
