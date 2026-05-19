type Props = {
  className?: string
}

export function CommunityConceptBadge({ className = '' }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1 py-px text-[10px] font-bold leading-none text-sky-800 ring-1 ring-sky-300/80 bg-sky-100 ${className}`}
      title="개념글"
    >
      개념
    </span>
  )
}
