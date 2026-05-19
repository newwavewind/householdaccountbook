import { useEffect, useState } from 'react'
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

const YT_RED = '#FF0000'
const YT_RED_HOVER = '#CC0000'
const YT_DARK = '#0F0F0F'

function YoutubeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 90 20" fill="currentColor" aria-hidden>
      <path d="M27.2 4.6h3.7l4.2 11.2h-2.9l-.8-2.2h-4.6l-.8 2.2h-2.8L27.2 4.6zm3.3 6.8l-1.5-4.1-1.5 4.1h3zm12.5-6.8h2.6v11.2h-2.6V4.6zm8.1 0c2.8 0 4.6 1.8 4.6 5.6s-1.8 5.6-4.6 5.6h-4.2V4.6h4.2zm-1.6 9.1c1.4 0 2.2-.9 2.2-3.5s-.8-3.5-2.2-3.5h-1.5v7h1.5zM14.9 4.6c2.5 0 4.1 1.7 4.1 5.6 0 3.9-1.6 5.6-4.1 5.6H8.6V4.6h6.3zm-1.6 9.1c1.3 0 2-.9 2-3.5s-.7-3.5-2-3.5H10v7h3.3zM4.2 4.6H1.4v11.2h2.8c2.5 0 4.1-1.6 4.1-5.6S6.7 4.6 4.2 4.6z" />
    </svg>
  )
}

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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="youtube-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[min(88vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-[#f9f9f9] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 bg-white px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: YT_RED }}
            >
              <svg width="20" height="14" viewBox="0 0 24 17" fill="white" aria-hidden>
                <path d="M23.5 4.8a3 3 0 0 0-2.1-2.1C19.5 2 12 2 12 2S4.5 2 2.4 2.7A3 3 0 0 0 .3 4.8 31 31 0 0 0 0 8.5a31 31 0 0 0 .3 3.7 3 3 0 0 0 2.1 2.1C4.5 15 12 15 12 15s7.5 0 9.6-.7a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 8.5a31 31 0 0 0-.5-3.7zM9.6 12.4V4.6L16.2 8.5 9.6 12.4z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="youtube-dialog-title" className="text-base font-bold" style={{ color: YT_DARK }}>
                {'\uc720\ud29c\ube0c\uc5d0\uc11c \uac80\uc0c9'}
              </h2>
              <p className="text-[11px] text-[#606060]">
                {'\ub3d9\uc601\uc0c1\uc744 \uc120\ud0dd\ud558\uc5ec \uae00\uc5d0 \uc0bd\uc785\ud558\uc138\uc694'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-full border border-[#ccc] bg-white shadow-sm focus-within:border-[#065fd4] focus-within:shadow-[0_0_0_1px_#065fd4]">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void search()
                }}
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-[#0f0f0f] outline-none"
                placeholder={'\uac80\uc0c9'}
                autoFocus
              />
              <button
                type="button"
                disabled={phase === 'loading' || !query.trim()}
                onClick={() => void search()}
                className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#606060] transition-colors hover:bg-[#f2f2f2] disabled:opacity-40"
                aria-label={'\uac80\uc0c9'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M20.87 20.17l-5.59-5.59C16.38 13.55 17 12.28 17 11c0-3.31-2.69-6-6-6S5 7.69 5 11s2.69 6 6 6c1.28 0 2.55-.47 3.58-1.32l5.59 5.59.7-.7zM11 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              disabled={phase === 'loading' || !query.trim()}
              onClick={() => void search()}
              className="shrink-0 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: phase === 'loading' ? '#909090' : YT_RED }}
              onMouseEnter={(e) => {
                if (phase !== 'loading' && query.trim()) {
                  e.currentTarget.style.backgroundColor = YT_RED_HOVER
                }
              }}
              onMouseLeave={(e) => {
                if (phase !== 'loading') e.currentTarget.style.backgroundColor = YT_RED
              }}
            >
              {phase === 'loading' ? '\uac80\uc0c9 \uc911' : '\uac80\uc0c9'}
            </button>
          </div>

          <div className="mt-2 flex gap-2 border-t border-[#e5e5e5] pt-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') insertFromUrl()
              }}
              className="min-w-0 flex-1 rounded-lg border border-[#ccc] bg-white px-3 py-2 text-sm text-[#0f0f0f] outline-none focus:border-[#065fd4]"
              placeholder="https://youtu.be/... \ub610\ub294 \ub3d9\uc601\uc0c1 ID"
            />
            <button
              type="button"
              onClick={insertFromUrl}
              className="shrink-0 rounded-lg border border-[#ccc] bg-white px-3 py-2 text-xs font-semibold text-[#0f0f0f] hover:bg-[#f2f2f2]"
            >
              URL {'\uc0bd\uc785'}
            </button>
          </div>
        </header>

        {showResultsPanel ? (
          <div className="flex min-h-[220px] flex-1 flex-col overflow-hidden bg-white">
            <div className="shrink-0 border-b border-[#e5e5e5] px-4 py-2 sm:px-5">
              <p className="text-xs font-medium text-[#606060]">
                {phase === 'loading' ? (
                  <>
                    <span
                      className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-t-transparent align-middle"
                      style={{ borderColor: YT_RED, borderTopColor: 'transparent' }}
                    />
                    {'\u201c'}
                    {lastQuery}
                    {'\u201d \uac80\uc0c9 \uc911\u2026'}
                  </>
                ) : (
                  <>
                    {'\uac80\uc0c9 \uacb0\uacfc'}
                    {lastQuery ? (
                      <span className="ml-1 font-normal">
                        {'\u2014 \u201c'}
                        {lastQuery}
                        {'\u201d'}
                      </span>
                    ) : null}
                    {results.length > 0 ? (
                      <span className="ml-1 tabular-nums" style={{ color: YT_RED }}>
                        {results.length}
                      </span>
                    ) : null}
                  </>
                )}
              </p>
            </div>

            <ul className="flex-1 overflow-y-auto p-2 sm:p-3">
              {phase === 'loading' ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="mb-2 flex animate-pulse gap-3 rounded-lg p-1">
                    <div className="aspect-video w-36 shrink-0 rounded-lg bg-[#e5e5e5]" />
                    <div className="flex flex-1 flex-col justify-center gap-2 py-2">
                      <div className="h-3.5 w-4/5 rounded bg-[#e5e5e5]" />
                      <div className="h-3 w-1/2 rounded bg-[#e5e5e5]" />
                    </div>
                  </li>
                ))
              ) : results.length === 0 && !error ? (
                <li className="flex flex-col items-center justify-center py-12 text-center">
                  <YoutubeLogo className="h-5 w-24 text-[#909090]" />
                  <p className="mt-3 text-sm text-[#606060]">{'\uac80\uc0c9 \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.'}</p>
                </li>
              ) : results.length === 0 && error ? (
                <li className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-[#cc0000]">{error}</p>
                </li>
              ) : (
                results.map((v) => (
                  <li key={v.videoId} className="mb-1 last:mb-0">
                    <button
                      type="button"
                      className="group flex w-full gap-3 rounded-xl p-1 text-left transition-colors hover:bg-[#f2f2f2]"
                      onClick={() => pick(v.videoId)}
                    >
                      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-[#000]">
                        <img
                          src={v.thumbnailUrl || youtubeThumbnailUrl(v.videoId)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const img = e.currentTarget
                            if (!img.src.includes('ytimg.com')) {
                              img.src = youtubeThumbnailUrl(v.videoId)
                            }
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-80 group-hover:opacity-100">
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/75"
                            style={{ color: '#fff' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </span>
                      </div>
                      <span className="min-w-0 flex-1 py-1 pr-2">
                        <span className="line-clamp-2 text-sm font-medium leading-snug text-[#0f0f0f] group-hover:text-[#065fd4]">
                          {v.title}
                        </span>
                        {v.author ? (
                          <span className="mt-1 block truncate text-xs text-[#606060]">{v.author}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center border-t border-[#e5e5e5] bg-[#f9f9f9] px-6 py-12 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${YT_RED}18` }}
            >
              <svg width="32" height="22" viewBox="0 0 24 17" fill={YT_RED} aria-hidden>
                <path d="M23.5 4.8a3 3 0 0 0-2.1-2.1C19.5 2 12 2 12 2S4.5 2 2.4 2.7A3 3 0 0 0 .3 4.8 31 31 0 0 0 0 8.5a31 31 0 0 0 .3 3.7 3 3 0 0 0 2.1 2.1C4.5 15 12 15 12 15s7.5 0 9.6-.7a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 8.5a31 31 0 0 0-.5-3.7zM9.6 12.4V4.6L16.2 8.5 9.6 12.4z" />
              </svg>
            </div>
            <p className="mt-4 text-sm text-[#606060]">
              {'\uac80\uc0c9\uc5b4\ub97c \uc785\ub825\ud558\uace0 '}
              <strong className="text-[#0f0f0f]">{'\uac80\uc0c9'}</strong>
              {' \ubc84\ud2bc\uc744 \ub204\ub974\uba74'}
              <br />
              {'\uc544\ub798\uc5d0 \ub3d9\uc601\uc0c1 \ubaa9\ub85d\uc774 \ud45c\uc2dc\ub429\ub2c8\ub2e4.'}
            </p>
          </div>
        )}

        <footer className="shrink-0 border-t border-[#e5e5e5] bg-white px-4 py-3 flex justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-[#0f0f0f] hover:bg-[#f2f2f2]"
          >
            {'\ub2eb\uae30'}
          </button>
        </footer>
      </div>
    </div>
  )
}

