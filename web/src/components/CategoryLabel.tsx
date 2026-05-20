import { CategoryIcon } from './CategoryIcon'

type Props = {
  name: string
  className?: string
  textClassName?: string
}

/** 카테고리 아이콘 + 이름 (장부·모달·목록 공통) */
export function CategoryLabel({
  name,
  className = 'inline-flex items-center gap-1.5',
  textClassName = '',
}: Props) {
  const trimmed = name.trim()
  if (!trimmed) return null
  return (
    <span className={className}>
      <CategoryIcon name={trimmed} />
      <span className={textClassName}>{trimmed}</span>
    </span>
  )
}
