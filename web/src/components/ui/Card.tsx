import type { HTMLAttributes } from 'react'

export function Card({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-border-subtle bg-surface-raised p-4 md:p-6 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}
