import { useState } from 'react'
import { Button } from '../ui/Button'
import { useCommunityAuth } from '../../community/CommunityAuthContext'
import {
  isValidNickname,
  nicknameValidationMessage,
  normalizeNickname,
  suggestRandomNickname,
} from '../../lib/nickname'

type Props = {
  initialNickname?: string
  submitLabel?: string
  onSaved?: (nickname: string) => void
}

export function NicknameEditor({
  initialNickname,
  submitLabel,
  onSaved,
}: Props) {
  const auth = useCommunityAuth()
  const [nickname, setNickname] = useState(() => {
    const seed = initialNickname?.trim()
    if (seed && seed !== '익명') return seed
    return suggestRandomNickname()
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = normalizeNickname(nickname)
    const msg = nicknameValidationMessage(n)
    if (!isValidNickname(n) || msg) {
      setErr(msg ?? '닉네임을 확인해 주세요.')
      setOk(null)
      return
    }
    setBusy(true)
    setErr(null)
    setOk(null)
    try {
      await auth.setNickname(n)
      setOk('닉네임을 저장했습니다.')
      onSaved?.(n)
    } catch (m) {
      setErr(m instanceof Error ? m.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <div>
        <label htmlFor="nickname-editor" className="block text-xs font-semibold text-text-soft">
          닉네임
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="nickname-editor"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            autoComplete="off"
            disabled={busy}
            placeholder="예: 맑은고양이42"
            className="min-w-0 flex-1 rounded-[var(--radius-card)] border border-input-border px-3 py-2.5 text-text-primary outline-none focus:border-green-accent"
          />
          <Button
            type="button"
            variant="outlined"
            className="shrink-0 !text-xs"
            disabled={busy}
            onClick={() => setNickname(suggestRandomNickname())}
          >
            추천
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-text-soft">
          2~24자 · 한글·영문·숫자 · . _ - 허용 · 실명은 공개되지 않습니다
        </p>
      </div>
      {err ? <p className="text-sm text-danger">{err}</p> : null}
      {ok ? <p className="text-sm text-green-accent">{ok}</p> : null}
      <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={busy}>
        {busy ? '저장 중…' : submitLabel ?? '닉네임 저장'}
      </Button>
    </form>
  )
}
