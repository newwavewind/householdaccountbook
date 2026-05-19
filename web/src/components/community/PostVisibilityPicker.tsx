import { POST_VISIBILITY_OPTIONS } from '../../community/postVisibility'
import type { PostVisibility } from '../../community/types'

type Props = {
  value: PostVisibility
  onChange: (v: PostVisibility) => void
  disabled?: boolean
  /** 비회원이면 회원공개·비공개 비활성 */
  isGuest?: boolean
}

export function PostVisibilityPicker({ value, onChange, disabled, isGuest }: Props) {
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">공개 설정</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="shrink-0 text-[11px] font-semibold text-text-soft">공개</span>
        {POST_VISIBILITY_OPTIONS.map((opt) => {
          const locked = Boolean(isGuest && !opt.guestAllowed)
          const selected = value === opt.value
          return (
            <label
              key={opt.value}
              title={opt.description}
              className={`inline-flex cursor-pointer items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                selected
                  ? 'border-green-accent bg-green-accent text-on-accent'
                  : 'border-border-muted bg-surface-raised text-text-secondary hover:border-green-accent/50'
              } ${locked ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <input
                type="radio"
                name="post-visibility"
                value={opt.value}
                checked={selected}
                disabled={locked}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
