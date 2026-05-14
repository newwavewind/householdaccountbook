import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Link } from 'react-router-dom'
import { useCommunityPosts } from '../community/useCommunityPosts'

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function AdminModerationPage() {
  const { posts, busy, error, refresh, repo } = useCommunityPosts(true)

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-6">
      <h1 className="font-serif-display text-starbucks-green">관리 · 게시글</h1>
      <p className="mt-1 text-sm text-text-soft">
        숨김 처리된 글과 일반 글 모두 확인할 수 있습니다. 관리자(
        <code className="rounded bg-ceramic px-1">profiles.role = admin</code>) 계정만 이 화면을
        씁니다.
      </p>
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outlined" className="!text-xs" onClick={() => void refresh()}>
          새로고침
        </Button>
        <Link to="/community">
          <Button type="button" variant="outlined" className="!text-xs">
            커뮤니티 목록
          </Button>
        </Link>
      </div>

      {busy ? (
        <p className="mt-8 text-center text-sm text-text-soft">불러오는 중…</p>
      ) : error ? (
        <Card className="mt-6 border border-danger/30 p-6 text-danger">{error}</Card>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Card className="border border-black/[0.06] bg-white">
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-soft">
                      {p.authorDisplayName} · {fmtDate(p.updatedAt)}{' '}
                      {p.hidden ? (
                        <span className="ml-2 rounded-full bg-warning/25 px-2 py-0.5 font-medium text-warning">
                          숨김
                        </span>
                      ) : null}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-text-soft">{p.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link to={`/community/${p.id}`} className="inline-flex">
                      <Button type="button" variant="outlined" className="!text-xs !py-1 !px-2">
                        보기
                      </Button>
                    </Link>
                    <Link to={`/community/${p.id}/edit`} className="inline-flex">
                      <Button type="button" variant="darkOutlined" className="!text-xs !py-1 !px-2">
                        수정
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="darkOutlined"
                      className="!text-xs !py-1 !px-2"
                      onClick={() =>
                        void (async () => {
                          await repo.setHidden(p.id, !p.hidden)
                          await refresh()
                        })()
                      }
                    >
                      {p.hidden ? '숨김 해제' : '숨김'}
                    </Button>
                    <Button
                      type="button"
                      variant="darkOutlined"
                      className="!border-danger/35 !text-xs !py-1 !px-2 text-danger"
                      onClick={() => {
                        if (!window.confirm('이 글을 삭제합니다. 계속할까요?')) return
                        void (async () => {
                          await repo.deletePost(p.id)
                          await refresh()
                        })()
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
