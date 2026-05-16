import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  deleteCalendarMemo,
  upsertCalendarMemo,
  type CalendarDayMemo,
} from '../calendar/calendarMemoStorage'
import { lunarCellInfo } from '../calendar/lunarDisplay'
import { useHouseholdCalendarMemos } from '../calendar/useHouseholdCalendarMemos'
import { useLedger } from '../hooks/useLedger'
import { holidayLabel } from '../lib/holidays'
import { isCloudSyncEnabled } from '../lib/supabaseClient'
import { ledgerBackendMode } from '../lib/ledgerBackend'

const WEEK = ['일', '월', '화', '수', '목', '금', '토'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function todayIso() {
  const n = new Date()
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}

function buildGrid(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1)
  const pad = start.getDay()
  const cells: { iso: string; day: number; inMonth: boolean }[] = []
  const gridStart = new Date(year, monthIndex, 1 - pad)
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push({
      iso: toIso(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === monthIndex,
    })
  }
  return cells
}

function formatMonthLabel(year: number, monthIndex: number) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, monthIndex))
}

function formatSelectedHeading(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${iso}T12:00:00`))
}

function memoHasContent(memo: CalendarDayMemo | undefined): boolean {
  return !!(memo && (memo.title?.trim() || memo.body?.trim()))
}

/** 셀 점 색 — 중요(별)면 호박색, 아니면 녹색 */
function memoDotClass(memo: CalendarDayMemo | undefined): string | null {
  if (!memoHasContent(memo)) return null
  return memo?.important ? 'bg-amber-500' : 'bg-green-accent'
}

/** 메모·일정 카드용 한두 줄 미리보기 (구형 title 또는 본문 첫 줄) */
function memoPreviewText(m: CalendarDayMemo | undefined): string {
  if (!m) return ''
  const t = m.title?.trim()
  if (t) return t
  const b = m.body?.trim()
  if (!b) return ''
  const line = b.split(/\r?\n/)[0]?.trim() ?? ''
  return line.length > 120 ? `${line.slice(0, 119)}…` : line
}

function formatTimeKo(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return hhmm
  return `${m[1]}:${m[2]}`
}

type DayMemoPersistDraft = Pick<CalendarDayMemo, 'body' | 'time' | 'important'>

type DayMemoPanelProps = {
  iso: string
  initial: CalendarDayMemo | undefined
  ledgerTxCount: number
  onPersist: (draft: DayMemoPersistDraft) => void
  onDelete: () => void
}

function DayMemoPanel({
  iso,
  initial,
  ledgerTxCount,
  onPersist,
  onDelete,
}: DayMemoPanelProps) {
  const [body, setBody] = useState(initial?.body ?? '')
  const [time, setTime] = useState(initial?.time ?? '')
  const [important, setImportant] = useState(initial?.important ?? false)

  useEffect(() => {
    setBody(initial?.body ?? '')
    setTime(initial?.time ?? '')
    setImportant(initial?.important ?? false)
  }, [iso, initial?.body, initial?.time, initial?.important])

  const hol = holidayLabel(iso)
  const lunar = lunarCellInfo(iso, hol)

  return (
    <Card
      id="calendar-day-detail"
      className="scroll-mt-24 p-0"
    >
      <div className="border-b border-black/[0.06] px-4 py-3 md:px-5 md:py-4">
        <p className="text-base font-semibold text-starbucks-green">
          {formatSelectedHeading(iso)}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-soft">
          {hol ? (
            <span className="font-medium text-gold">{hol}</span>
          ) : null}
          {lunar ? (
            <span
              className={
                lunar.emphasize ? 'font-semibold text-starbucks-green' : ''
              }
            >
              음력 {lunar.label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 px-4 py-3 md:px-5">
        <div
          className="rounded-lg border border-black/[0.08] bg-ceramic/60 px-3 py-2.5"
          aria-label="이 날 일정 요약"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
            이 날 요약
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-[rgba(0,0,0,0.87)]">
            <li>
              <span className="text-text-soft">메모 · </span>
              {memoPreviewText({
                title: initial?.title ?? '',
                body,
                updatedAt: '',
              }) || '내용 없음 · 아래에서 입력'}
            </li>
            {time.trim() || initial?.time ? (
              <li>
                <span className="text-text-soft">시간 · </span>
                {formatTimeKo(time.trim() || initial?.time || '')}
              </li>
            ) : null}
            <li>
              <span className="text-text-soft">중요 · </span>
              {important ? (
                <span className="text-amber-600">★ 표시됨</span>
              ) : (
                '없음'
              )}
            </li>
            <li>
              <span className="text-text-soft">장부 · </span>
              거래 {ledgerTxCount}건
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-text-soft">중요 표시</span>
          <button
            type="button"
            className={[
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 text-2xl leading-none transition-colors',
              important
                ? 'border-amber-400 bg-amber-50 text-amber-500'
                : 'border-black/[0.12] bg-white text-text-soft hover:border-amber-300/80',
            ].join(' ')}
            aria-pressed={important}
            aria-label={important ? '중요 표시 끄기' : '중요 표시 켜기'}
            onClick={() => setImportant((v) => !v)}
          >
            {important ? '★' : '☆'}
          </button>
        </div>

        <label className="block text-sm font-medium text-text-soft">
          시간 (선택)
          <input
            type="time"
            className="mt-1 w-full max-w-[12rem] rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2 sm:w-auto"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-text-soft">
          메모
          <textarea
            className="mt-1 min-h-[7rem] w-full resize-y rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2 md:min-h-[10rem]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="그날 할 일이나 메모를 적어요."
            maxLength={8000}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-black/[0.06] p-4">
        <Button
          type="button"
          variant="darkOutlined"
          className="min-h-11 flex-1 !border-danger !text-danger"
          onClick={() => {
            if (confirm('이 날짜 메모를 삭제할까요?')) onDelete()
          }}
        >
          삭제
        </Button>
        <Button
          type="button"
          variant="primary"
          className="min-h-11 flex-1"
          onClick={() => onPersist({ body, time, important })}
        >
          저장
        </Button>
      </div>
    </Card>
  )
}

export default function CalendarPage() {
  const now = useMemo(() => new Date(), [])
  const nav = useNavigate()
  const detailRef = useRef<HTMLDivElement | null>(null)
  const [cursorY, setCursorY] = useState(now.getFullYear())
  const [cursorM, setCursorM] = useState(now.getMonth())
  const [selectedIso, setSelectedIso] = useState<string>(() => todayIso())

  const { transactions, userId, householdId } = useLedger()
  const { memos, patchMemos, cloudStatus, cloudMessage, cloudEnabled } =
    useHouseholdCalendarMemos()

  const backend = ledgerBackendMode()
  const cloudConfigured = isCloudSyncEnabled()

  const txCountByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactions) {
      m.set(t.date, (m.get(t.date) ?? 0) + 1)
    }
    return m
  }, [transactions])

  const cells = useMemo(
    () => buildGrid(cursorY, cursorM),
    [cursorY, cursorM],
  )

  const today = todayIso()

  const goPrevMonth = useCallback(() => {
    setCursorM((m) => {
      if (m <= 0) {
        setCursorY((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }, [])

  const goNextMonth = useCallback(() => {
    setCursorM((m) => {
      if (m >= 11) {
        setCursorY((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }, [])

  const scrollDetailIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    })
  }, [])

  const goThisMonth = useCallback(() => {
    const n = new Date()
    setCursorY(n.getFullYear())
    setCursorM(n.getMonth())
    setSelectedIso(todayIso())
    scrollDetailIntoView()
  }, [scrollDetailIntoView])

  const onPickDay = useCallback(
    (iso: string) => {
      setSelectedIso(iso)
      scrollDetailIntoView()
    },
    [scrollDetailIntoView],
  )

  const persistMemo = useCallback(
    (draft: DayMemoPersistDraft) => {
      patchMemos((prev) =>
        upsertCalendarMemo(prev, selectedIso, {
          title: '',
          body: draft.body,
          time: draft.time,
          important: draft.important,
        }),
      )
    },
    [patchMemos, selectedIso],
  )

  const removeMemo = useCallback(() => {
    patchMemos((prev) => deleteCalendarMemo(prev, selectedIso))
  }, [patchMemos, selectedIso])

  const selectedMemo = memos[selectedIso]

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="font-serif-display text-2xl font-semibold text-starbucks-green md:text-3xl">
          일정 · 메모 달력
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-soft md:text-base">
          위 달력에서 날짜를 누르면 아래에 그날 요약·메모를 쓸 수 있어요.
          {cloudEnabled
            ? ' 같은 가구(공유코드)에 연결된 가족과 실시간으로 동기화됩니다.'
            : cloudConfigured && backend === 'supabase'
              ? ' 로그인 후 가구를 만들거나 공유코드로 참여하면 가족과 일정을 공유할 수 있어요.'
              : ' 비로그인·로컬 모드에서는 이 브라우저에만 저장됩니다.'}
        </p>
        {backend === 'supabase' && cloudConfigured ? (
          <div className="mt-4 space-y-2">
            {!userId ? (
              <div className="rounded-[var(--radius-card)] border border-black/[0.08] bg-ceramic/80 px-4 py-3 text-sm text-[rgba(0,0,0,0.87)]">
                Google 로그인 후 가구에 참여하면 일정이 다른 기기·가족과
                맞춰집니다.
                <Button
                  type="button"
                  variant="outlined"
                  className="mt-2 w-full min-h-11 sm:w-auto"
                  onClick={() => nav('/auth/setup')}
                >
                  로그인 안내로 이동
                </Button>
              </div>
            ) : !householdId ? (
              <div className="rounded-[var(--radius-card)] border border-black/[0.08] bg-amber-50/90 px-4 py-3 text-sm text-[rgba(0,0,0,0.87)]">
                아직 가구에 연결되지 않았어요. 장부 화면에서 가구를 만들거나
                공유코드를 입력하면 일정도 함께 공유돼요.
                <Button
                  type="button"
                  variant="primary"
                  className="mt-2 w-full min-h-11 sm:w-auto"
                  onClick={() => nav('/')}
                >
                  장부에서 가구 설정
                </Button>
              </div>
            ) : cloudStatus === 'error' && cloudMessage ? (
              <div className="rounded-[var(--radius-card)] border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-danger">
                <p className="font-medium">동기화 오류: {cloudMessage}</p>
                <p className="mt-2 text-xs text-[rgba(0,0,0,0.65)]">
                  로컬 메모는 이 기기에 저장·편집할 수 있어요. 테이블을 방금
                  만들었었다면 PostgREST 스키마 반영까지 잠시 걸릴 수 있어요.
                  새로고침 후에도 같으면 Supabase 프로젝트 URL이 이 앱의 환경
                  변수와 같은지 확인해 주세요.
                </p>
              </div>
            ) : cloudStatus === 'loading' ? (
              <p className="text-sm text-text-soft">가구 일정을 불러오는 중…</p>
            ) : cloudEnabled ? (
              <p className="text-sm font-medium text-starbucks-green">
                가구와 연결됨 · 일정 변경이 저장되면 가족에게도 반영돼요.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <Card className="min-w-0 p-3 md:p-5">
          <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-card)] bg-ceramic/80 p-3 md:flex-row md:items-center md:justify-between md:p-4">
            <div className="flex flex-1 items-center justify-between gap-2 md:justify-start">
              <Button
                variant="outlined"
                className="!min-h-11 min-w-11 !px-3"
                aria-label="이전 달"
                type="button"
                onClick={goPrevMonth}
              >
                ‹
              </Button>
              <p className="min-w-[10rem] flex-1 text-center text-base font-semibold text-[rgba(0,0,0,0.87)] md:text-lg">
                {formatMonthLabel(cursorY, cursorM)}
              </p>
              <Button
                variant="outlined"
                className="!min-h-11 min-w-11 !px-3"
                aria-label="다음 달"
                type="button"
                onClick={goNextMonth}
              >
                ›
              </Button>
            </div>
            <Button
              variant="outlined"
              type="button"
              className="min-h-11 w-full shrink-0 md:w-auto"
              onClick={goThisMonth}
            >
              오늘 / 이번 달
            </Button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-sm font-medium text-text-soft md:text-base">
            {WEEK.map((d, i) => (
              <div
                key={d}
                className={
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''
                }
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ iso, day, inMonth }, cellIdx) => {
              const hol = holidayLabel(iso)
              const lunar = lunarCellInfo(iso, hol)
              const memo = memos[iso]
              const hasMemo = memoHasContent(memo)
              const txCount = txCountByDate.get(iso) ?? 0
              const hasLedger = txCount > 0
              const isToday = iso === today
              const isSel = iso === selectedIso
              const isSunday = cellIdx % 7 === 0
              const isRedDay = (isSunday || !!hol) && inMonth
              const dotCls = memoDotClass(memo)
              const starImportant = !!memo?.important && hasMemo

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onPickDay(iso)}
                  aria-pressed={isSel}
                  aria-label={`${iso} 메모·일정`}
                  className={[
                    'relative flex min-h-[4.5rem] w-full cursor-pointer flex-col rounded-lg border px-1 py-1.5 text-left transition-colors active:scale-[0.98] md:min-h-[5.5rem] md:px-1.5 md:py-2',
                    inMonth
                      ? 'border-black/[0.08] bg-white hover:border-green-accent/45 hover:bg-green-light/35'
                      : 'border-transparent bg-neutral-cool/50 text-text-soft/60 hover:bg-neutral-cool',
                    hol && inMonth ? 'ring-1 ring-inset ring-red-300/60' : '',
                    hasLedger && inMonth
                      ? 'shadow-[0_0_0_1px_rgba(0,117,74,0.2)]'
                      : '',
                    isToday
                      ? 'outline outline-2 outline-offset-[-2px] outline-green-accent/70'
                      : '',
                    isSel ? 'bg-green-light/50' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="flex w-full items-start justify-between gap-0.5">
                    <span
                      className={[
                        'text-sm font-semibold tabular-nums md:text-base',
                        inMonth && !isRedDay ? 'text-[rgba(0,0,0,0.87)]' : '',
                        isRedDay ? 'text-red-500' : '',
                        !inMonth ? 'text-text-soft/60' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {day}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {starImportant ? (
                        <span
                          className="text-[0.65rem] leading-none text-amber-500 md:text-xs"
                          aria-label="중요 메모"
                          title="중요"
                        >
                          ★
                        </span>
                      ) : null}
                      {hasMemo && dotCls ? (
                        <span
                          className={`inline-block size-1.5 rounded-full ${dotCls}`}
                          aria-label="메모 있음"
                          title="메모 있음"
                        />
                      ) : null}
                      {hasLedger ? (
                        <span
                          className="rounded bg-green-accent/15 px-1 text-[0.625rem] font-semibold tabular-nums text-green-accent md:text-[0.6875rem]"
                          title="이 날 장부 거래 수"
                        >
                          {txCount}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {lunar ? (
                    <span
                      className={[
                        'mt-0.5 line-clamp-1 text-[0.65rem] leading-tight text-text-soft md:text-[0.7rem]',
                        lunar.emphasize ? 'font-semibold text-starbucks-green' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {lunar.label}
                    </span>
                  ) : null}
                  {hol && inMonth ? (
                    <span className="mt-0.5 line-clamp-2 text-left text-[0.62rem] font-medium leading-tight text-red-400 md:text-[0.68rem]">
                      {hol}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </Card>

        <div ref={detailRef}>
          <DayMemoPanel
            iso={selectedIso}
            initial={selectedMemo}
            ledgerTxCount={txCountByDate.get(selectedIso) ?? 0}
            onPersist={persistMemo}
            onDelete={removeMemo}
          />
        </div>
      </div>
    </main>
  )
}
