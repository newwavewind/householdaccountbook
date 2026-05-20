import { MarqueeTicker, type MarqueeSegment } from './MarqueeTicker'

export type MarqueeTickerRow = {
  id: string
  node: MarqueeSegment['node']
  ariaLabel: string
  forceMarquee?: boolean
}

type Props = {
  rows: MarqueeTickerRow[]
  staggerKeyPrefix?: string
  className?: string
  rowClassName?: string
}

/** 달력 칸 — 항목마다 한 줄씩 독립 마키 */
export function MarqueeTickerRows({
  rows,
  staggerKeyPrefix,
  className = '',
  rowClassName = '',
}: Props) {
  if (rows.length === 0) return null

  return (
    <div
      className={['flex min-w-0 flex-col gap-px', className].filter(Boolean).join(' ')}
    >
      {rows.map((row) => (
        <MarqueeTicker
          key={row.id}
          variant="cell"
          segments={[{ id: row.id, node: row.node }]}
          ariaLabel={row.ariaLabel}
          forceMarquee={row.forceMarquee}
          staggerKey={
            staggerKeyPrefix ? `${staggerKeyPrefix}-${row.id}` : row.id
          }
          className={['!min-h-[1.05rem] !flex-none', rowClassName]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  )
}
