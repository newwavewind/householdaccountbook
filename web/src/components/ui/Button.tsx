import type { ButtonHTMLAttributes } from 'react'

const base =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-[7px] text-base font-semibold tracking-tight transition-all duration-200 ease-in-out active:scale-[0.95] disabled:pointer-events-none disabled:opacity-50'

const variants = {
  primary: 'border-green-accent bg-green-accent text-white',
  outlined: 'border-green-accent bg-transparent text-green-accent',
  black: 'border-black bg-black text-sm text-white',
  darkOutlined:
    'border-[rgba(0,0,0,0.87)] bg-transparent text-sm text-[rgba(0,0,0,0.87)]',
  inverted: 'border-white bg-white text-green-accent',
  outlinedOnDark: 'border-white bg-transparent text-white',
} as const

export type ButtonVariant = keyof typeof variants

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
