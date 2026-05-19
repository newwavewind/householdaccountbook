import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export type MarqueeSegment = {
  id: string
  node: ReactNode
}

type Props = {
  segments: MarqueeSegment[]
  ariaLabel: string
  variant?: 'banner' | 'cell'
  className?: string
  pauseOnHover?: boolean
  staggerKey?: string
}

function staggerDelaySec(key: string | undefined): number {
  if (!key) return 0
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return -(Math.abs(h) % 100) / 10
}

function SegmentRow({
  segments,
  separatorClass,
}: {
  segments: MarqueeSegment[]
  separatorClass: string
}) {
  return (
    <>
      {segments.map((seg, i) => (
        <span
          key={seg.id}
          className="inline-flex shrink-0 items-center whitespace-nowrap"
        >
          {i > 0 ? (
            <span className={separatorClass} aria-hidden>
              ·
            </span>
          ) : null}
          {seg.node}
        </span>
      ))}
    </>
  )
}

export function MarqueeTicker({
  segments,
  ariaLabel,
  variant = 'banner',
  className = '',
  pauseOnHover = true,
  staggerKey,
}: Props) {
  const reducedMotion = usePrefersReducedMotion()
  const [hoverPause, setHoverPause] = useState(false)
  const [inView, setInView] = useState(true)
  const [needsMarquee, setNeedsMarquee] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const labelId = useId()

  const isCell = variant === 'cell'
  const separatorClass = isCell
    ? 'mx-1.5 select-none text-text-soft/45'
    : 'mx-5 select-none text-gold/50'

  const textClass = isCell
    ? 'text-[0.62rem] font-medium leading-tight text-text-soft md:text-[0.68rem]'
    : 'text-sm font-medium text-text-primary md:text-[0.95rem]'

  const durationSec = useMemo(
    () =>
      Math.min(
        isCell ? 48 : 110,
        Math.max(isCell ? 12 : 24, 8 + segments.length * (isCell ? 3.5 : 6.5)),
      ),
    [isCell, segments.length],
  )

  const segmentsWithNodes = useMemo(
    () =>
      segments.map((seg) => ({
        ...seg,
        node:
          typeof seg.node === 'string' ? (
            <span className={textClass}>{seg.node}</span>
          ) : (
            seg.node
          ),
      })),
    [segments, textClass],
  )

  useEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const check = () => {
      setNeedsMarquee(measure.scrollWidth > container.clientWidth + 2)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(container)
    ro.observe(measure)
    return () => ro.disconnect()
  }, [segmentsWithNodes])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      { rootMargin: '40px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (segmentsWithNodes.length === 0) return null

  const dupSegments = segmentsWithNodes.map((s) => ({
    ...s,
    id: `dup-${s.id}`,
  }))

  const paused =
    (pauseOnHover && hoverPause) || !inView || !needsMarquee

  const trackClass = [
    'marquee-ticker-track',
    paused ? 'marquee-ticker-paused' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const minH = isCell ? 'min-h-[1.125rem]' : 'min-h-[2.75rem]'

  return (
    <div
      ref={containerRef}
      className={[
        'pointer-events-none relative min-w-0 flex-1 overflow-hidden',
        minH,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={labelId}
      onMouseEnter={pauseOnHover ? () => setHoverPause(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setHoverPause(false) : undefined}
    >
      <span id={labelId} className="sr-only">
        {ariaLabel}
      </span>

      <div
        ref={measureRef}
        className={[
          'pointer-events-none absolute left-0 top-0 flex w-max items-center whitespace-nowrap opacity-0',
          isCell ? 'py-0' : 'py-2 pl-3 pr-10',
        ].join(' ')}
        aria-hidden
      >
        <SegmentRow
          segments={segmentsWithNodes}
          separatorClass={separatorClass}
        />
      </div>

      {reducedMotion || !needsMarquee ? (
        <div
          className={[
            'overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            isCell ? 'py-0' : 'px-3 py-2',
          ].join(' ')}
          tabIndex={needsMarquee ? 0 : undefined}
        >
          <div className="flex w-max items-center whitespace-nowrap">
            <SegmentRow
              segments={segmentsWithNodes}
              separatorClass={separatorClass}
            />
          </div>
        </div>
      ) : (
        <>
          <div
            className={trackClass}
            style={{
              animationDuration: `${durationSec}s`,
              animationDelay: `${staggerDelaySec(staggerKey)}s`,
            }}
          >
            <div
              className={[
                'flex shrink-0 items-center',
                isCell ? 'py-0 pr-4' : 'py-2 pl-3 pr-10',
              ].join(' ')}
            >
              <SegmentRow
                segments={segmentsWithNodes}
                separatorClass={separatorClass}
              />
            </div>
            <div
              className={[
                'flex shrink-0 items-center',
                isCell ? 'py-0 pr-4' : 'py-2 pl-3 pr-10',
              ].join(' ')}
              aria-hidden
            >
              <SegmentRow
                segments={dupSegments}
                separatorClass={separatorClass}
              />
            </div>
          </div>
          {!isCell ? (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-ceramic to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-12 bg-gradient-to-l from-ceramic to-transparent"
                aria-hidden
              />
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
