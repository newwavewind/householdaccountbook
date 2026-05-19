import { useState } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { COMMUNITY_GRADE_LABELS, NOTICE_MIN_GRADE } from '../../community/communityGrades'
import type { CommunityRepository } from '../../community/repository'

type Props = {
  repo: CommunityRepository
}

export function AdminMemberGradePanel({ repo }: Props) {
  const [userId, setUserId] = useState('')
  const [grade, setGrade] = useState('2')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const handleSave = async () => {
    const id = userId.trim()
    const g = Number(grade)
    if (!id) {
      setMsg('사용자 UUID를 입력하세요.')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await repo.setCommunityGrade(id, g)
      const label = COMMUNITY_GRADE_LABELS[g as 0 | 1 | 2 | 3] ?? String(g)
      setMsg(`등급을 ${label}(으)로 변경했습니다.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '변경에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-8 border border-border-muted bg-surface-raised p-4">
      <h2 className="text-base font-semibold text-starbucks-green">회원 등급</h2>
      <p className="mt-1 text-xs text-text-soft">
        0=일반, 1=활동, 2=우수(공지 작성 가능), 3=운영진. 공지 작성 최소 등급: {NOTICE_MIN_GRADE}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-semibold text-text-soft">
          사용자 ID (profiles.id)
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded border border-input-border px-2 py-1.5 text-sm text-text-primary"
            placeholder="uuid"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">
          등급
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded border border-input-border px-2 py-1.5 text-sm"
          >
            {([0, 1, 2, 3] as const).map((k) => (
              <option key={k} value={String(k)}>
                {k} — {COMMUNITY_GRADE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="primary"
          className="!text-xs"
          disabled={busy}
          onClick={() => void handleSave()}
        >
          {busy ? '저장 중…' : '등급 저장'}
        </Button>
      </div>
      {msg ? <p className="mt-2 text-xs text-text-secondary">{msg}</p> : null}
    </Card>
  )
}
