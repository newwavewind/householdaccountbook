import type { HTMLAttributes } from 'react'

export function Card({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-black/[0.08] bg-white p-4 md:p-6 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}
