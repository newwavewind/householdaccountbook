import { useMemo } from 'react'
import { parseCommunityPostBodySegments } from '../../community/communityPostBodySegments'
import { youtubeEmbedUrl } from '../../lib/youtubeSearch'
import { CommunityPollEmbed } from './CommunityPollEmbed'

type Props = {
  body: string
  postId: string
  voterId: string
  userDisplayName?: string | null
  className?: string
  onImageClick?: (src: string) => void
}

export function CommunityPostBody({
  body,
  postId,
  voterId,
  userDisplayName,
  className,
  onImageClick,
}: Props) {
  const segments = useMemo(() => parseCommunityPostBodySegments(body), [body])

  return (
    <div className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'poll') {
          return (
            <CommunityPollEmbed
              key={`poll-${seg.data.pollId}-${i}`}
              postId={postId}
              poll={seg.data}
              voterId={voterId}
              userDisplayName={userDisplayName ?? null}
            />
          )
        }
        if (seg.type === 'youtube') {
          return (
            <div key={`yt-${seg.videoId}-${i}`} className="my-4 aspect-video w-full overflow-hidden rounded-lg border border-border-muted bg-black">
              <iframe
                title="YouTube"
                src={youtubeEmbedUrl(seg.videoId)}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )
        }
        return (
          <div
            key={`html-${i}`}
            className="community-post-body-segment"
            dangerouslySetInnerHTML={{ __html: seg.html }}
            onClick={(e) => {
              const target = e.target as HTMLElement
              if (target.tagName === 'IMG' && onImageClick) {
                const src = (target as HTMLImageElement).src
                if (src) onImageClick(src)
              }
            }}
          />
        )
      })}
    </div>
  )
}

