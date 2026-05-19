import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useCommunityAuth } from '../community/CommunityAuthContext'
import { useCommunityPost } from '../community/useCommunityPosts'
import { isProbablyRichHtml } from '../lib/communityPostHtml'
import { CommunityPostBody } from '../components/community/CommunityPostBody'
import type { CommunityComment } from '../community/types'
import { sharePageUrl } from '../lib/sharePageUrl'

/** 이미지 라이트박스: 클릭된 src를 전달하면 전체화면 오버레이로 표시 */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale((s) => Math.max(0.5, Math.min(5, s - e.deltaY * 0.001)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    setPos((p) => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseUp = () => { dragging.current = false }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      onWheel={handleWheel}
    >
      {/* 닫기 버튼 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised/20 text-white hover:bg-surface-raised/30"
        aria-label="닫기"
      >
        ✕
      </button>
      {/* 줌 컨트롤 */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface-raised/15 px-3 py-1.5 text-white backdrop-blur-sm">
        <button type="button" onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(0.5, s - 0.25)) }} className="text-lg leading-none px-1">−</button>
        <span className="text-xs tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(5, s + 0.25)) }} className="text-lg leading-none px-1">+</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); setScale(1); setPos({ x: 0, y: 0 }) }} className="text-xs border border-white/30 rounded px-2 py-0.5 ml-1">초기화</button>
      </div>
      <img
        src={src}
        alt="확대 이미지"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        draggable={false}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transition: dragging.current ? 'none' : 'transform 0.1s ease',
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
          cursor: dragging.current ? 'grabbing' : 'grab',
          borderRadius: 8,
          userSelect: 'none',
        }}
      />
    </div>
  )
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function fmtDateShort(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export default function CommunityPostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const auth = useCommunityAuth()
  const nav = useNavigate()
  const { post, busy, error, repo } = useCommunityPost(id)

  // 댓글 상태
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  // 추천·비추천
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [dislikeCount, setDislikeCount] = useState(0)
  const [voteBusy, setVoteBusy] = useState(false)
  // 라이트박스
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const closeLightbox = useCallback(() => setLightboxSrc(null), [])

  const canEdit =
    auth.user && post && (post.authorId === auth.user.id || auth.role === 'admin')

  // 댓글 로드
  useEffect(() => {
    if (!post) return
    setLikeCount(post.likeCount)
    setDislikeCount(post.dislikeCount ?? 0)
    void repo.listComments(post.id).then(setComments).catch(() => {})
    if (auth.user) {
      void repo.isLiked(post.id, auth.user.id).then(setLiked).catch(() => {})
      void repo.isDisliked(post.id, auth.user.id).then(setDisliked).catch(() => {})
    } else {
      setLiked(false)
      setDisliked(false)
    }
  }, [post, repo, auth.user])

  const handleAddComment = async () => {
    if (!commentBody.trim() || !auth.user || !post) return
    setCommentBusy(true)
    try {
      const newComment = await repo.addComment({
        postId: post.id,
        authorId: auth.user.id,
        authorDisplayName: auth.user.displayName || auth.user.email,
        body: commentBody.trim(),
      })
      setComments((prev) => [...prev, newComment])
      setCommentBody('')
    } catch (e) {
      alert(e instanceof Error ? e.message : '댓글 작성에 실패했습니다.')
    } finally {
      setCommentBusy(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('댓글을 삭제할까요?')) return
    try {
      await repo.deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const refreshVoteCounts = async (postId: string) => {
    try {
      const counts = await repo.getVoteCounts(postId)
      setLikeCount(counts.likeCount)
      setDislikeCount(counts.dislikeCount)
    } catch {
      // ignore
    }
  }

  const handleToggleLike = async () => {
    if (!auth.user || !post || voteBusy) return
    setVoteBusy(true)
    try {
      const result = await repo.toggleLike(post.id, auth.user.id)
      setLiked(result.liked)
      setDisliked(result.disliked)
      await refreshVoteCounts(post.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : '추천 처리에 실패했습니다.')
    } finally {
      setVoteBusy(false)
    }
  }

  const handleToggleDislike = async () => {
    if (!auth.user || !post || voteBusy) return
    setVoteBusy(true)
    try {
      const result = await repo.toggleDislike(post.id, auth.user.id)
      setLiked(result.liked)
      setDisliked(result.disliked)
      await refreshVoteCounts(post.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : '비추천 처리에 실패했습니다.')
    } finally {
      setVoteBusy(false)
    }
  }

  const handleShare = () => {
    if (!post) return
    void sharePageUrl(window.location.href, post.title)
  }

  return (
    <>
    {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={closeLightbox} />}
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6">
      {busy ? (
        <p className="text-center text-sm text-text-soft">불러오는 중…</p>
      ) : error ? (
        <Card className="border border-danger/30 bg-surface-raised p-6 text-danger">{error}</Card>
      ) : !post ? (
        <Card className="border border-border-muted bg-surface-raised p-10 text-center text-text-soft">
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
            <div className="flex gap-2">
              {/* 공유 버튼 */}
              <Button type="button" variant="outlined" className="!text-xs !px-3 !py-1" onClick={handleShare}>
                🔗 공유
              </Button>
              {canEdit ? (
                <>
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
                </>
              ) : null}
            </div>
          </div>

          {/* 본문 카드 */}
          <Card className="border border-border-muted bg-surface-raised">
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
                <CommunityPostBody
                  body={post.body}
                  postId={post.id}
                  userId={auth.user?.id ?? null}
                  userDisplayName={
                    auth.user?.displayName || auth.user?.email || null
                  }
                  className="community-post-body mt-6 text-base leading-relaxed text-text-primary"
                  onImageClick={setLightboxSrc}
                />
              ) : (
                <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-text-primary">
                  {post.body}
                </div>
              )}

              {/* 추천 · 비추천 */}
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border-muted pt-4">
                <button
                  type="button"
                  onClick={() => void handleToggleLike()}
                  disabled={!auth.user || voteBusy}
                  className={`inline-flex min-w-[5.5rem] items-center justify-center gap-1.5 rounded border px-4 py-2 text-sm font-bold transition-colors ${
                    liked
                      ? 'border-green-accent bg-green-accent text-on-accent'
                      : 'border-border-subtle bg-surface-raised text-text-secondary hover:border-green-accent/50 hover:bg-green-light/30'
                  } disabled:opacity-40`}
                >
                  <span>추천</span>
                  <span className="tabular-nums">{likeCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleDislike()}
                  disabled={!auth.user || voteBusy}
                  className={`inline-flex min-w-[5.5rem] items-center justify-center gap-1.5 rounded border px-4 py-2 text-sm font-bold transition-colors ${
                    disliked
                      ? 'border-rose-500 bg-rose-500 text-white'
                      : 'border-border-subtle bg-surface-raised text-text-secondary hover:border-rose-400/50 hover:bg-rose-50'
                  } disabled:opacity-40`}
                >
                  <span>비추천</span>
                  <span className="tabular-nums">{dislikeCount}</span>
                </button>
                {!auth.user ? (
                  <span className="text-xs text-text-soft">로그인하면 추천·비추천을 할 수 있어요.</span>
                ) : null}
              </div>
            </div>
          </Card>

          {/* 댓글 섹션 */}
          <div className="mt-6">
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              댓글 {comments.length > 0 ? `${comments.length}개` : ''}
            </h2>

            {comments.length === 0 ? (
              <p className="mb-4 text-sm text-text-soft">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
            ) : (
              <ul className="mb-4 space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-xl border border-border-muted bg-surface-raised p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-gray-700">{c.authorDisplayName}</span>
                        <span className="ml-2 text-xs text-text-soft">{fmtDateShort(c.createdAt)}</span>
                        <p className="mt-1 text-sm leading-relaxed text-gray-800">{c.body}</p>
                      </div>
                      {auth.user && (c.authorId === auth.user.id || auth.role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteComment(c.id)}
                          className="shrink-0 text-xs text-text-soft hover:text-danger"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* 댓글 작성 */}
            {auth.user ? (
              <div className="rounded-xl border border-border-muted bg-surface-raised p-4">
                <textarea
                  ref={commentInputRef}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="댓글을 입력하세요…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    className="!text-xs !px-4 !py-2"
                    onClick={() => void handleAddComment()}
                    disabled={commentBusy || !commentBody.trim()}
                  >
                    {commentBusy ? '등록 중…' : '댓글 등록'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-border-muted bg-surface-raised p-4 text-center text-sm text-text-soft">
                댓글을 작성하려면 로그인하세요.
              </p>
            )}
          </div>
        </>
      )}
    </main>
    </>
  )
}
