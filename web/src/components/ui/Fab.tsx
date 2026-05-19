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
        'fixed bottom-[calc(3.5rem+0.375rem+max(0.75rem,env(safe-area-inset-bottom,0px))+1rem)] right-[max(1rem,env(safe-area-inset-right))] z-50 flex h-14 w-14 cursor-pointer items-center justify-center md:bottom-[max(1rem,env(safe-area-inset-bottom))]',
        'rounded-full border border-green-accent bg-green-accent text-on-accent transition-all duration-200 ease-out theme2:rounded-md theme2:border-charcoal-border theme3:rounded-md',
        'shadow-[var(--shadow-frap-stack)] theme2:shadow-[var(--shadow-frap-base)] active:scale-[0.95] active:shadow-[var(--shadow-frap-base)]',
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
