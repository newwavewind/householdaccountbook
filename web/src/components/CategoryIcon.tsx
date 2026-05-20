import type { ReactNode } from 'react'

type Props = {
  name: string
  className?: string
}

type IconFn = (className?: string) => ReactNode

function Shell({
  children,
  className = 'size-4',
  round = 'rounded-[4px]',
}: {
  children: ReactNode
  className?: string
  round?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${round} ${className}`}
      aria-hidden
    >
      {children}
    </span>
  )
}

function StrokeIcon({
  className = 'size-4',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <Shell className={className} round="rounded-md bg-neutral-cool/50 text-text-secondary">
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </Shell>
  )
}

const ICONS: Record<string, IconFn> = {
  식비: (c) => (
    <StrokeIcon className={c}>
      <path d="M3 6h10M5 6V4.5a3 3 0 0 1 6 0V6" />
      <path d="M4 6l.8 7h6.4l.8-7" />
    </StrokeIcon>
  ),
  마트: (c) => (
    <StrokeIcon className={c}>
      <circle cx="5.5" cy="13" r="1" />
      <circle cx="11.5" cy="13" r="1" />
      <path d="M2 3h2l1.2 8h7.6L14 5H5" />
    </StrokeIcon>
  ),
  배달음식: (c) => (
    <StrokeIcon className={c}>
      <path d="M3 8h8l2-4H5" />
      <path d="M5 8v4h6V8" />
      <path d="M11 12h2v1.5a1.5 1.5 0 0 1-3 0V12" />
    </StrokeIcon>
  ),
  교통: (c) => (
    <StrokeIcon className={c}>
      <rect x="3" y="5" width="10" height="6" rx="1.5" />
      <path d="M5 11v1M11 11v1M6 8h4" />
    </StrokeIcon>
  ),
  주유비: (c) => (
    <StrokeIcon className={c}>
      <path d="M4 3h5l2 2v9H4V3z" />
      <path d="M9 3v2h2M6 10h2" />
    </StrokeIcon>
  ),
  하이패스: (c) => (
    <StrokeIcon className={c}>
      <rect x="2" y="5" width="12" height="6" rx="1" />
      <path d="M5 8h6M8 6v4" />
    </StrokeIcon>
  ),
  자동차할부: (c) => (
    <StrokeIcon className={c}>
      <path d="M3 9h10l-1-3H4l-1 3z" />
      <circle cx="5" cy="11" r="1" />
      <circle cx="11" cy="11" r="1" />
    </StrokeIcon>
  ),
  쇼핑: (c) => (
    <StrokeIcon className={c}>
      <path d="M4 4h8l-1 9H5L4 4z" />
      <path d="M6 4V3a2 2 0 0 1 4 0v1" />
    </StrokeIcon>
  ),
  쿠팡: (c) => (
    <Shell
      className={c === 'size-4' ? 'h-4 w-[2.75rem]' : c}
      round="rounded-md bg-white ring-1 ring-black/[0.06]"
    >
      <img
        src={`${import.meta.env.BASE_URL}category-icons/coupang.png`}
        alt=""
        className="h-full w-full object-contain object-center px-0.5"
        draggable={false}
      />
    </Shell>
  ),
  네이버스토어: (c) => (
    <Shell className={c}>
      <svg viewBox="0 0 16 16" className="size-full">
        <rect width="16" height="16" rx="3.5" fill="#03C75A" />
        <path
          fill="#fff"
          d="M4.2 4.5h2.1l2.2 3.4V4.5h2.1v7H8.5L6.3 8.1v3.4H4.2V4.5z"
        />
      </svg>
    </Shell>
  ),
  구독: (c) => (
    <StrokeIcon className={c}>
      <path d="M8 3v4l2.5 1.5" />
      <path d="M4 8a4 4 0 1 0 8 0" />
    </StrokeIcon>
  ),
  통신비: (c) => (
    <StrokeIcon className={c}>
      <rect x="5" y="2" width="6" height="12" rx="1.5" />
      <path d="M7 12h2" />
    </StrokeIcon>
  ),
  연회비: (c) => (
    <StrokeIcon className={c}>
      <path d="M3 6h10v6H3V6z" />
      <path d="M5 4h6v2H5V4zM8 9v2" />
    </StrokeIcon>
  ),
  의료: (c) => (
    <StrokeIcon className={c}>
      <path d="M8 3v10M3 8h10" />
    </StrokeIcon>
  ),
  교육: (c) => (
    <StrokeIcon className={c}>
      <path d="M3 6l5-3 5 3-5 3-5-3z" />
      <path d="M8 9v4" />
    </StrokeIcon>
  ),
  문화: (c) => (
    <StrokeIcon className={c}>
      <rect x="3" y="4" width="10" height="8" rx="1" />
      <path d="M3 7h10" />
    </StrokeIcon>
  ),
  공과금: (c) => (
    <StrokeIcon className={c}>
      <path d="M4 3h8v10H4V3z" />
      <path d="M6 6h4M6 9h3" />
    </StrokeIcon>
  ),
  도시가스: (c) => (
    <StrokeIcon className={c}>
      <path d="M8 12c2-2 3-3.5 3-5a3 3 0 0 0-6 0c0 1.5 1 3 3 5z" />
    </StrokeIcon>
  ),
  정수기구독료: (c) => (
    <StrokeIcon className={c}>
      <path d="M8 3v2M6 8c0-1.5 1-2.5 2-2.5s2 1 2 2.5" />
      <path d="M5 11h6" />
    </StrokeIcon>
  ),
  아파트관리비: (c) => (
    <StrokeIcon className={c}>
      <path d="M4 14V6l4-3 4 3v8" />
      <path d="M7 10h2v4" />
    </StrokeIcon>
  ),
  보험료: (c) => (
    <StrokeIcon className={c}>
      <path d="M8 2l4 2v4c0 3-2 5-4 6-2-1-4-3-4-6V4l4-2z" />
    </StrokeIcon>
  ),
  경조사비: (c) => (
    <StrokeIcon className={c}>
      <rect x="3" y="5" width="10" height="7" rx="1" />
      <path d="M3 7h10M8 5v7" />
    </StrokeIcon>
  ),
  기타: (c) => (
    <StrokeIcon className={c}>
      <circle cx="5" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="11" cy="8" r="0.75" fill="currentColor" stroke="none" />
    </StrokeIcon>
  ),
  급여: (c) => (
    <StrokeIcon className={c}>
      <rect x="3" y="5" width="10" height="6" rx="1" />
      <path d="M5 8h6" />
    </StrokeIcon>
  ),
  부수입: (c) => (
    <StrokeIcon className={c}>
      <circle cx="8" cy="8" r="4" />
      <path d="M8 5v6M6 8h4" />
    </StrokeIcon>
  ),
  '이자·배당': (c) => (
    <StrokeIcon className={c}>
      <path d="M3 11l4-6 3 4 3-6" />
    </StrokeIcon>
  ),
  환급: (c) => (
    <StrokeIcon className={c}>
      <path d="M11 5H5l2-2M5 11h6l-2 2" />
    </StrokeIcon>
  ),
  용돈: (c) => (
    <StrokeIcon className={c}>
      <circle cx="8" cy="8" r="3.5" />
      <path d="M8 6v4M6.5 8h3" />
    </StrokeIcon>
  ),
}

function DefaultIcon({ className }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <path d="M4 4h8v8H4V4z" />
      <path d="M6 8h4" />
    </StrokeIcon>
  )
}

export function CategoryIcon({ name, className = 'size-4' }: Props) {
  const key = name.trim()
  if (!key) return null
  const render = ICONS[key]
  return render ? render(className) : <DefaultIcon className={className} />
}
