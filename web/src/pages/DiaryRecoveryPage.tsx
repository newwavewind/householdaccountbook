import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  parseMemoMapPayload,
  saveCalendarMemos,
  loadCalendarMemos,
  CALENDAR_MEMO_STORAGE_KEY,
  type CalendarDayMemo,
} from '../calendar/calendarMemoStorage'
import { mergeMemoMaps } from '../calendar/calendarMemoMerge'
import {
  CALENDAR_STICKY_NOTES_KEY,
  loadStickyNotes,
  parseStickyNotesPayload,
  saveStickyNotes,
  type CalendarStickyNote,
} from '../calendar/calendarStickyNotesStorage'
import { mergeDdayLists } from '../dday/ddayMerge'
import {
  DDAYS_STORAGE_KEY,
  loadDdays,
  parseDdaysPayload,
  saveDdays,
} from '../dday/ddayStorage'
import type { DdayEvent } from '../dday/ddayTypes'

function mergeStickyNotes(
  a: CalendarStickyNote[],
  b: CalendarStickyNote[],
): CalendarStickyNote[] {
  const map = new Map<string, CalendarStickyNote>()
  for (const n of a) map.set(n.id, n)
  for (const n of b) {
    const p = map.get(n.id)
    if (!p || n.updatedAt >= p.updatedAt) map.set(n.id, n)
  }
  return [...map.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
}

function parseCalendarSlice(v: unknown): Record<string, CalendarDayMemo> {
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return {}
    return parseMemoMapPayload(JSON.parse(t) as unknown)
  }
  return parseMemoMapPayload(v)
}

function parseDdaySlice(v: unknown): DdayEvent[] {
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return []
    const j = JSON.parse(t) as unknown
    if (Array.isArray(j)) return parseDdaysPayload({ events: j })
    return parseDdaysPayload(j)
  }
  if (Array.isArray(v)) return parseDdaysPayload({ events: v })
  return parseDdaysPayload(v)
}

function parseStickySlice(v: unknown): CalendarStickyNote[] {
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return []
    return parseStickyNotesPayload(JSON.parse(t) as unknown)
  }
  return parseStickyNotesPayload(v)
}

/** 내보내기 파일(v:1) */
function applyBundleV1(data: unknown, merge: boolean): string[] {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('통합 JSON은 객체여야 합니다.')
  }
  const r = data as Record<string, unknown>
  if (r.v !== 1) {
    throw new Error('통합 칸에는 「내보내기」로 받은 파일만 넣어 주세요. (맨 위에 "v": 1)')
  }

  const parts: string[] = []

  const calRaw = r[CALENDAR_MEMO_STORAGE_KEY]
  if (calRaw !== undefined && calRaw !== null && String(calRaw).trim() !== '') {
    let next = parseCalendarSlice(calRaw)
    if (merge) next = mergeMemoMaps(loadCalendarMemos(), next)
    saveCalendarMemos(next)
    parts.push(`날짜 일정 메모 ${Object.keys(next).length}일`)
  }

  const ddayRaw = r[DDAYS_STORAGE_KEY]
  if (ddayRaw !== undefined && ddayRaw !== null && String(ddayRaw).trim() !== '') {
    let next = parseDdaySlice(ddayRaw)
    if (merge) next = mergeDdayLists(loadDdays(), next)
    saveDdays(next)
    parts.push(`디데이 ${next.length}건`)
  }

  const stickyRaw = r[CALENDAR_STICKY_NOTES_KEY]
  if (stickyRaw !== undefined && stickyRaw !== null && String(stickyRaw).trim() !== '') {
    let next = parseStickySlice(stickyRaw)
    if (merge) next = mergeStickyNotes(loadStickyNotes(), next)
    saveStickyNotes(next)
    parts.push(`스티커 ${next.length}장`)
  }

  if (parts.length === 0) {
    throw new Error('백업 파일에 비어 있지 않은 항목이 없습니다.')
  }

  return parts
}

export default function DiaryRecoveryPage() {
  const [bundleText, setBundleText] = useState('')
  const [calendarText, setCalendarText] = useState('')
  const [ddayText, setDdayText] = useState('')
  const [stickyText, setStickyText] = useState('')
  const [merge, setMerge] = useState(true)
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const exportBackup = useCallback(() => {
    const bundle = {
      v: 1,
      exportedAt: new Date().toISOString(),
      [CALENDAR_MEMO_STORAGE_KEY]:
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(CALENDAR_MEMO_STORAGE_KEY) ?? ''
          : '',
      [DDAYS_STORAGE_KEY]:
        typeof localStorage !== 'undefined' ? localStorage.getItem(DDAYS_STORAGE_KEY) ?? '' : '',
      [CALENDAR_STICKY_NOTES_KEY]:
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(CALENDAR_STICKY_NOTES_KEY) ?? ''
          : '',
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mj-diary-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setBanner({
      type: 'ok',
      text: '파일을 저장했습니다. 안전한 곳에 보관해 두세요.',
    })
  }, [])

  const applyAll = useCallback(() => {
    setBanner(null)
    try {
      const parts: string[] = []

      if (bundleText.trim()) {
        const data = JSON.parse(bundleText) as unknown
        const ok = applyBundleV1(data, merge)
        parts.push(...ok)
      }

      if (calendarText.trim()) {
        let next = parseCalendarSlice(calendarText)
        if (merge) next = mergeMemoMaps(loadCalendarMemos(), next)
        saveCalendarMemos(next)
        parts.push(`날짜 일정(개별) ${Object.keys(next).length}일`)
      }

      if (ddayText.trim()) {
        let next = parseDdaySlice(ddayText)
        if (merge) next = mergeDdayLists(loadDdays(), next)
        saveDdays(next)
        parts.push(`디데이(개별) ${next.length}건`)
      }

      if (stickyText.trim()) {
        let next = parseStickySlice(stickyText)
        if (merge) next = mergeStickyNotes(loadStickyNotes(), next)
        saveStickyNotes(next)
        parts.push(`스티커(개별) ${next.length}장`)
      }

      if (parts.length === 0) {
        setBanner({ type: 'err', text: '붙여넣은 내용이 없습니다.' })
        return
      }

      setBanner({
        type: 'ok',
        text: `저장했습니다: ${parts.join(' · ')} → 다이어리에서 확인하세요. Supabase를 쓰는 경우 로그인·가구 연결 후 잠시 기다리면 동기화됩니다.`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setBanner({
        type: 'err',
        text: `JSON 형식 오류: ${msg}`,
      })
    }
  }, [bundleText, calendarText, ddayText, stickyText, merge])

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <h1 className="font-serif-display text-xl font-semibold text-starbucks-green md:text-2xl">
        다이어리 데이터 복구
      </h1>
      <p className="mt-2 text-sm text-text-soft">
        이 브라우저의 <strong className="text-text-primary">localStorage</strong>에만 씁니다.
        다른 PC·브라우저에 있던 값은 DevTools → Application → Local Storage에서 복사해 아래에
        붙여 주세요. Supabase에는 달력·디데이가 있을 때 로그인 후 달력 화면에서 자동으로 다시
        올라갑니다.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" onClick={exportBackup}>
            지금 이 기기 데이터 내보내기 (.json)
          </Button>
          <Link
            to="/calendar"
            className="text-sm font-medium text-green-accent underline underline-offset-2"
          >
            다이어리로 돌아가기
          </Link>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={merge}
            onChange={(e) => setMerge(e.target.checked)}
            className="rounded border-border-strong"
          />
          기존 이 기기 데이터와 합치기 (같은 날·같은 id면 더 최근 수정이 우선)
        </label>
      </Card>

      {banner ? (
        <div
          className={`mt-4 rounded-[var(--radius-card)] border px-4 py-3 text-sm ${
            banner.type === 'ok'
              ? 'border-green-accent/40 bg-green-light/30 text-text-primary'
              : 'border-danger/40 bg-red-50/90 text-danger'
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <Card className="mt-6 space-y-3 p-5">
        <h2 className="text-sm font-semibold text-starbucks-green">1) 통합 백업 파일</h2>
        <p className="text-xs text-text-soft">
          「내보내기」로 받은 <code className="rounded bg-ceramic px-1">v: 1</code> JSON 전체를
          붙여 넣으세요.
        </p>
        <textarea
          className="min-h-[8rem] w-full rounded-md border border-border-default bg-surface-raised p-3 font-mono text-[11px] text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-green-accent/30"
          value={bundleText}
          onChange={(e) => setBundleText(e.target.value)}
          placeholder={'{\n  "v": 1,\n  "exportedAt": "...",\n  "gaegyeobu-calendar-v1": "...",\n  ...\n}'}
          spellCheck={false}
        />
      </Card>

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="text-sm font-semibold text-starbucks-green">2) 개별 붙여넣기 (선택)</h2>
        <p className="text-xs text-text-soft">
          Application → Local Storage 에서 키 이름 그대로 복사합니다.{' '}
          <code className="rounded bg-ceramic px-1">{CALENDAR_MEMO_STORAGE_KEY}</code> 등.
        </p>

        <div>
          <label className="text-xs font-medium text-text-muted">날짜 일정 메모 (객체 JSON)</label>
          <textarea
            className="mt-1 min-h-[6rem] w-full rounded-md border border-border-default bg-surface-raised p-3 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-green-accent/30"
            value={calendarText}
            onChange={(e) => setCalendarText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted">
            디데이 (<code className="rounded bg-ceramic px-0.5">{'{ "events": [...] }'}</code> 또는
            배열)
          </label>
          <textarea
            className="mt-1 min-h-[6rem] w-full rounded-md border border-border-default bg-surface-raised p-3 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-green-accent/30"
            value={ddayText}
            onChange={(e) => setDdayText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted">스티커 (배열 JSON)</label>
          <textarea
            className="mt-1 min-h-[6rem] w-full rounded-md border border-border-default bg-surface-raised p-3 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-green-accent/30"
            value={stickyText}
            onChange={(e) => setStickyText(e.target.value)}
            spellCheck={false}
          />
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="primary" onClick={applyAll}>
          위 내용 localStorage에 적용
        </Button>
        <Button
          type="button"
          variant="outlined"
          onClick={() => {
            setBundleText('')
            setCalendarText('')
            setDdayText('')
            setStickyText('')
            setBanner(null)
          }}
        >
          입력 비우기
        </Button>
      </div>
    </main>
  )
}
