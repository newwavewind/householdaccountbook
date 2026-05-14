import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useCommunityAuth } from '../community/CommunityAuthContext'
import { useCommunityPost } from '../community/useCommunityPosts'
import {
  isProbablyRichHtml,
  sanitizeCommunityPostHtml,
} from '../lib/communityPostHtml'

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function CommunityPostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const auth = useCommunityAuth()
  const nav = useNavigate()
  const { post, busy, error, repo } = useCommunityPost(id)

  const canEdit =
    auth.user && post && (post.authorId === auth.user.id || auth.role === 'admin')

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6">
      {busy ? (
        <p className="text-center text-sm text-text-soft">불러오는 중…</p>
      ) : error ? (
        <Card className="border border-danger/30 bg-white p-6 text-danger">{error}</Card>
      ) : !post ? (
        <Card className="border border-black/[0.06] bg-white p-10 text-center text-text-soft">
          글을 찾을 수 없습니다.
          <div className="mt-6">
            <Button type="button" variant="outlined" onClick={() => nav('/community')}>
              목록으로
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outlined" className="!text-xs !px-3 !py-1" onClick={() => nav('/community')}>
              목록
            </Button>
            {canEdit ? (
              <div className="flex gap-2">
                <Link to={`/community/${post.id}/edit`} className="inline-flex">
                  <Button type="button" variant="primary" className="!text-xs !px-3 !py-1">
                    수정
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="darkOutlined"
                  className="!text-xs !px-3 !py-1 text-danger border-danger/35"
                  onClick={() => {
                    if (!window.confirm('이 글을 삭제할까요?')) return
                    void (async () => {
                      await repo.deletePost(post.id)
                      nav('/community', { replace: true })
                    })()
                  }}
                >
                  삭제
                </Button>
              </div>
            ) : null}
          </div>
          <Card className="border border-black/[0.06] bg-white">
            <div className="p-6 md:p-8">
              <p className="text-xs font-medium uppercase tracking-wide text-text-soft">
                {post.authorDisplayName} · {fmtDate(post.updatedAt)}
                {post.updatedAt !== post.createdAt ? ' · 수정됨' : ''}
              </p>
              {post.hidden ? (
                <p className="mt-3 text-xs text-warning">숨김 처리된 글입니다.</p>
              ) : null}
              <h1 className="mt-4 font-serif-display text-starbucks-green">{post.title}</h1>
              {isProbablyRichHtml(post.body) ? (
                <div
                  className="community-post-body mt-6 text-base leading-relaxed text-[rgba(0,0,0,0.87)]"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeCommunityPostHtml(post.body),
                  }}
                />
              ) : (
                <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-[rgba(0,0,0,0.87)]">
                  {post.body}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </main>
  )
}
