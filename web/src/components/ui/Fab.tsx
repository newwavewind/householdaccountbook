import type { ButtonHTMLAttributes } from 'react'

export function Fab({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={[
        'fixed z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full',
        'bg-green-accent text-white transition-all duration-200 ease-out',
        'shadow-[var(--shadow-frap-stack)] active:scale-[0.95] active:shadow-[var(--shadow-frap-base)]',
        'bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
