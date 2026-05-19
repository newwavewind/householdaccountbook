import type { ReactNode } from 'react'
import type { PostContentFlags } from '../../lib/communityPostContentFlags'

type Props = PostContentFlags

function IconBadge({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className: string
}) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] leading-none ${className}`}
      title={label}
      aria-label={label}
      role="img"
    >
      {children}
    </span>
  )
}

export function CommunityPostContentIcons({ hasImage, hasVideo, hasYoutube, hasPoll }: Props) {
  if (!hasImage && !hasVideo && !hasYoutube && !hasPoll) return null

  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle">
      {hasImage ? (
        <IconBadge label={'\uc0ac\uc9c4'} className="bg-sky-100 text-sky-700">
          {'\ud83d\udcf7'}
        </IconBadge>
      ) : null}
      {hasVideo ? (
        <IconBadge label={'\ub3d9\uc601\uc0c1'} className="bg-violet-100 text-violet-700">
          {'\ud83c\udfa5'}
        </IconBadge>
      ) : null}
      {hasYoutube ? (
        <IconBadge label={'\uc720\ud29c\ube0c'} className="bg-red-50 text-red-500/80">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .6 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
          </svg>
        </IconBadge>
      ) : null}
      {hasPoll ? (
        <IconBadge label={'\ud22c\ud45c'} className="bg-amber-100 text-amber-800">
          {'\ud83d\udcca'}
        </IconBadge>
      ) : null}
    </span>
  )
}

