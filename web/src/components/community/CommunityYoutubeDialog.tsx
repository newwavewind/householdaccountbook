import { useState } from 'react'
import { Button } from '../ui/Button'
import {
  parseYoutubeVideoId,
  searchYoutubeVideos,
  type YoutubeSearchItem,
} from '../../lib/youtubeSearch'

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (videoId: string) => void
}

export function CommunityYoutubeDialog({ open, onClose, onInsert }: Props) {
  const [query, setQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [results, setResults] = useState<YoutubeSearchItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const search = async () => {
    const q = query.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    try {
      setResults(await searchYoutubeVideos(q))
    } catch (e) {
      setResults([])
      setError(e instanceof Error ? e.message : '검색에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const insertFromUrl = () => {
    const id = parseYoutubeVideoId(urlInput)
    if (!id) {
      setError('유효한 유튜브 URL 또는 동영상 ID를 입력하세요.')
      return
    }
    onInsert(id)
    setQuery('')
    setUrlInput('')
    setResults([])
    setError(null)
    onClose()
  }

  const pick = (videoId: string) => {
    onInsert(videoId)
    setQuery('')
    setUrlInput('')
    setResults([])
    setError(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="youtube-dialog-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border-subtle bg-surface-raised shadow-xl">
        <div className="border-b border-border-muted p-4">
          <h2 id="youtube-dialog-title" className="text-lg font-semibold text-starbucks-green">
            유튜브 동영상
          </h2>
          <p className="mt-1 text-xs text-text-soft">검색하거나 URL을 붙여넣으세요.</p>
          <div className="mt-3 flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search()
              }}
              className="min-w-0 flex-1 rounded border border-border-subtle px-3 py-2 text-sm outline-none focus:border-green-accent/60"
              placeholder="동영상 검색"
            />
            <Button
              type="button"
              variant="primary"
              className="!text-xs shrink-0"
              disabled={busy}
              onClick={() => void search()}
            >
              {busy ? '검색 중…' : '검색'}
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="min-w-0 flex-1 rounded border border-border-subtle px-3 py-1.5 text-sm outline-none focus:border-green-accent/60"
              placeholder="https://youtu.be/… 또는 동영상 ID"
            />
            <Button type="button" variant="outlined" className="!text-xs shrink-0" onClick={insertFromUrl}>
              URL 삽입
            </Button>
          </div>
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {results.length === 0 && !busy ? (
            <li className="p-4 text-center text-xs text-text-soft">검색어를 입력해 주세요.</li>
          ) : null}
          {results.map((v) => (
            <li key={v.videoId}>
              <button
                type="button"
                className="flex w-full gap-3 rounded-lg p-2 text-left hover:bg-neutral-warm/80"
                onClick={() => pick(v.videoId)}
              >
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt="" className="h-14 w-24 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-14 w-24 shrink-0 items-center justify-center rounded bg-neutral-warm text-xs text-text-soft">
                    미리보기
                  </span>
                )}
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-medium text-text-primary">{v.title}</span>
                  {v.author ? (
                    <span className="mt-0.5 block truncate text-xs text-text-soft">{v.author}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-border-muted p-3 flex justify-end">
          <Button type="button" variant="outlined" className="!text-xs" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
}


