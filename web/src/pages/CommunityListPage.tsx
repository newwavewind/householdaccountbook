import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useCommunityAuth } from '../community/CommunityAuthContext'
import { useCommunityPosts } from '../community/useCommunityPosts'
import { communityBackendMode } from '../lib/communityBackend'
import { postBodyToPlainText } from '../lib/communityPostHtml'

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function CommunityListPage() {
  const nav = useNavigate()
  const auth = useCommunityAuth()
  const { posts, busy, error } = useCommunityPosts(false)
  const mode = communityBackendMode()

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-starbucks-green">커뮤니티</h1>
          <p className="mt-1 text-sm text-text-soft">
            글을 읽고, 로그인 후 작성할 수 있습니다.
            {mode === 'mock' ? (
              <>
                {' '}
                <Link to="/auth/setup" className="font-medium text-green-accent underline">
                  Google 로그인 연결 방법
                </Link>
                을 먼저 확인하세요.
              </>
            ) : null}
          </p>
        </div>
        {auth.user ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => nav('/community/new')}
          >
            글쓰기
          </Button>
        ) : (
          <p className="text-xs text-text-soft">글쓰기는 로그인 후 이용할 수 있습니다.</p>
        )}
      </div>

      {busy ? (
        <p className="text-center text-sm text-text-soft">불러오는 중…</p>
      ) : error ? (
        <Card className="border border-danger/30 bg-white p-6 text-danger">{error}</Card>
      ) : posts.length === 0 ? (
        <Card className="border border-black/[0.06] bg-white p-10 text-center text-text-soft">
          아직 글이 없습니다. 첫 글을 남겨 보세요.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Card className="border border-black/[0.06] bg-white transition-shadow hover:shadow-md">
                <Link to={`/community/${p.id}`} className="block p-4 no-underline text-inherit">
                  <span className="text-xs font-medium uppercase tracking-wide text-text-soft">
                    {p.authorDisplayName} · {fmtDate(p.createdAt)}
                  </span>
                  <h2 className="mt-2 text-lg font-semibold text-[rgba(0,0,0,0.87)]">
                    {p.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm text-text-soft">
                    {postBodyToPlainText(p.body)}
                  </p>
                  {p.hidden ? (
                    <span className="mt-3 inline-block rounded-full bg-black/[0.06] px-2 py-0.5 text-xs text-text-soft">
                      숨김(본인/관리자만 보임)
                    </span>
                  ) : null}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
