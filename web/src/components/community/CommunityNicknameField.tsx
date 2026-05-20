type Props = {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  id?: string
}

export function CommunityNicknameField({ value, onChange, disabled, id = 'community-nickname' }: Props) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-text-soft">
        닉네임
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={24}
        disabled={disabled}
        placeholder="익명"
        className="mt-1 w-full max-w-xs rounded-[var(--radius-card)] border border-input-border px-3 py-2 text-sm text-text-primary outline-none focus:border-green-accent"
      />
      <p className="mt-1 text-[11px] text-text-soft">
        로그인 없이 글·댓글·투표할 때 쓰는 익명 닉네임입니다.
      </p>
    </div>
  )
}
