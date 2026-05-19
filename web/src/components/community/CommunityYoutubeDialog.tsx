import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import {
  parseYoutubeVideoId,
  searchYoutubeVideos,
  youtubeThumbnailUrl,
  type YoutubeSearchItem,
} from '../../lib/youtubeSearch'

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (videoId: string) => void
}

type SearchPhase = 'idle' | 'loading' | 'done'

export function CommunityYoutubeDialog({ open, onClose, onInsert }: Props) {
  const [query, setQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [results, setResults] = useState<YoutubeSearchItem[]>([])
  const [phase, setPhase] = useState<SearchPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setQuery('')
      setUrlInput('')
      setResults([])
      setPhase('idle')
      setError(null)
      setLastQuery('')
    }
  }, [open])

  if (!open) return null

  const search = async () => {
    const q = query.trim()
    if (!q) return
    setPhase('loading')
    setError(null)
    setResults([])
    setLastQuery(q)
    try {
      const items = await searchYoutubeVideos(q)
      setResults(items)
      setPhase('done')
    } catch (e) {
      setResults([])
      setPhase('done')
      setError(e instanceof Error ? e.message : '\uac80\uc0c9\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.')
    }
  }

  const insertFromUrl = () => {
    const id = parseYoutubeVideoId(urlInput)
    if (!id) {
      setError('\uc720\ud6a8\ud55c \uc720\ud29c\ube0c URL \ub610\ub294 \ub3d9\uc601\uc0c1 ID\ub97c \uc785\ub825\ud558\uc138\uc694.')
      return
    }
    onInsert(id)
    onClose()
  }

  const pick = (videoId: string) => {
    onInsert(videoId)
    onClose()
  }

  const showResultsPanel = phase !== 'idle'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="youtube-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[min(88vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border-muted bg-gradient-to-r from-green-light/30 to-surface-raised px-4 py-4 sm:px-5">
          <h2 id="youtube-dialog-title" className="text-lg font-semibold text-starbucks-green">
            {'\uc720\ud29c\ube0c \ub3d9\uc601\uc0c1'}
          </h2>
          <p className="mt-1 text-xs text-text-soft">
            {'\uac80\uc0c9 \ud6c4 \ubaa9\ub85d\uc5d0\uc11c \uc120\ud0dd\ud558\uac70\ub098 URL\uc744 \uc785\ub825\ud558\uc138\uc694.'}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search()
              }}
              className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-green-accent focus:ring-2 focus:ring-green-accent/20"
              placeholder={'\ub3d9\uc601\uc0c1 \uac80\uc0c9 (\uc81c\ubaa9, \ucc44\ub110\uba85...)'}
              autoFocus
            />
            <Button
              type="button"
              variant="primary"
              className="!shrink-0 !px-4 !text-sm"
              disabled={phase === 'loading' || !query.trim()}
              onClick={() => void search()}
            >
              {phase === 'loading' ? '\uac80\uc0c9 \uc911' : '\uac80\uc0c9'}
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') insertFromUrl()
              }}
              className="min-w-0 flex-1 rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-green-accent/60"
              placeholder="https://youtu.be/... \ub610\ub294 \ub3d9\uc601\uc0c1 ID"
            />
            <Button type="button" variant="outlined" className="!shrink-0 !text-xs" onClick={insertFromUrl}>
              URL {'\uc0bd\uc785'}
            </Button>
          </div>
          {error && phase !== 'loading' ? (
            <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
          ) : null}
        </div>

        {showResultsPanel ? (
          <div className="flex min-h-[220px] flex-1 flex-col overflow-hidden border-t border-border-muted/60 bg-neutral-warm/25">
            <div className="shrink-0 border-b border-border-muted/50 px-4 py-2 sm:px-5">
              <p className="text-xs font-semibold text-text-primary">
                {phase === 'loading' ? (
                  <>
                    <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-green-accent border-t-transparent align-middle" />
                    {'\u201c'}
                    {lastQuery}
                    {'\u201d \uac80\uc0c9 \uc911\u2026'}
                  </>
                ) : (
                  <>
                    {'\uac80\uc0c9 \uacb0\uacfc'}
                    {lastQuery ? (
                      <span className="ml-1 font-normal text-text-soft">
                        {'\u2014 \u201c'}
                        {lastQuery}
                        {'\u201d'}
                      </span>
                    ) : null}
                    {results.length > 0 ? (
                      <span className="ml-1 tabular-nums text-green-accent">{results.length}</span>
                    ) : null}
                  </>
                )}
              </p>
            </div>

            <ul className="flex-1 overflow-y-auto p-2 sm:p-3">
              {phase === 'loading' ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <li
                    key={i}
                    className="mb-2 flex animate-pulse gap-3 rounded-xl border border-border-muted/50 bg-surface-raised p-2"
                  >
                    <div className="h-[4.5rem] w-28 shrink-0 rounded-lg bg-neutral-warm" />
                    <div className="flex flex-1 flex-col justify-center gap-2 py-1">
                      <div className="h-3.5 w-4/5 rounded bg-neutral-warm" />
                      <div className="h-3 w-1/3 rounded bg-neutral-warm" />
                    </div>
                  </li>
                ))
              ) : results.length === 0 ? (
                <li className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-3xl" aria-hidden>
                    {'\ud83d\udd0d'}
                  </span>
                  <p className="mt-2 text-sm text-text-soft">
                    {'\uac80\uc0c9 \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.'}
                  </p>
                  <p className="mt-1 text-xs text-text-soft">URL\uc744 \uc785\ub825\ud574 \ub4f1\ub85d\ud574 \ubcf4\uc138\uc694.</p>
                </li>
              ) : (
                results.map((v) => (
                  <li key={v.videoId} className="mb-2 last:mb-0">
                    <button
                      type="button"
                      className="group flex w-full gap-3 rounded-xl border border-border-subtle bg-surface-raised p-2 text-left shadow-sm transition-all hover:border-green-accent/50 hover:shadow-md"
                      onClick={() => pick(v.videoId)}
                    >
                      <div className="relative h-[4.5rem] w-28 shrink-0 overflow-hidden rounded-lg bg-neutral-warm">
                        <img
                          src={v.thumbnailUrl || youtubeThumbnailUrl(v.videoId)}
                          alt=""
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            const img = e.currentTarget
                            if (!img.src.includes('ytimg.com')) {
                              img.src = youtubeThumbnailUrl(v.videoId)
                            }
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-text-primary">
                            {'\uc120\ud0dd'}
                          </span>
                        </span>
                      </div>
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary group-hover:text-green-accent">
                          {v.title}
                        </span>
                        {v.author ? (
                          <span className="mt-1 block truncate text-xs text-text-soft">{v.author}</span>
                        ) : null}
                        <span className="mt-1 inline-block text-[10px] text-text-soft">
                          youtube.com
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center border-t border-border-muted/40 bg-neutral-warm/20 px-6 py-10 text-center">
            <span className="text-4xl" aria-hidden>
              {'\u25b6\ufe0f'}
            </span>
            <p className="mt-3 text-sm text-text-soft">
              {'\uac80\uc0c9\uc5b4\ub97c \uc785\ub825\ud558\uace0 '}
              <strong className="text-text-primary">{'\uac80\uc0c9'}</strong>
              {' \ubc84\ud2bc\uc744 \ub204\ub974\uba74'}
              <br />
              {'\uc544\ub798\uc5d0 \ub3d9\uc601\uc0c1 \ubaa9\ub85d\uc774 \ud45c\uc2dc\ub429\ub2c8\ub2e4.'}
            </p>
          </div>
        )}

        <div className="shrink-0 border-t border-border-muted bg-surface-raised px-4 py-3 flex justify-end sm:px-5">
          <Button type="button" variant="outlined" className="!text-xs" onClick={onClose}>
            {'\ub2eb\uae30'}
          </Button>
        </div>
      </div>
    </div>
  )
}

