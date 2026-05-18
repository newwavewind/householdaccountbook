import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  deleteCalendarMemo,
  getDayEvents,
  setCalendarDayEvents,
  type CalendarDayEvent,
  type CalendarDayMemo,
} from '../calendar/calendarMemoStorage'
import { lunarCellInfo } from '../calendar/lunarDisplay'
import CalendarStickyNotesBoard from '../calendar/CalendarStickyNotesBoard'
import { useHouseholdCalendarMemos } from '../calendar/useHouseholdCalendarMemos'
import { buildDdaySummaryLines, eventsOnCalendarDay } from '../dday/ddayCompute'
import { useHouseholdDDays } from '../dday/useHouseholdDDays'
import { useLedger } from '../hooks/useLedger'
import { holidayLabel } from '../lib/holidays'
import { isCloudSyncEnabled } from '../lib/supabaseClient'
import { ledgerBackendMode } from '../lib/ledgerBackend'
import {
  CALENDAR_EVENT_INK_SWATCHES,
  calendarEventInkTextClass,
  type CalendarEventInkId,
} from '../calendar/calendarEventInk'
import { CalendarEventRichField } from '../calendar/CalendarEventRichField'
import {
  htmlToPlain,
  sanitizeCalendarEventHtml,
} from '../calendar/calendarHtmlSanitize'
import type { DdayEvent } from '../dday/ddayTypes'

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
  return getDayEvents(memo).length > 0
}

function formatTimeKo(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return hhmm
  return `${m[1]}:${m[2]}`
}

function eventHasListingContent(e: CalendarDayEvent): boolean {
  return !!(
    e.label.trim() ||
    htmlToPlain(e.labelHtml) ||
    e.note?.trim() ||
    htmlToPlain(e.noteHtml) ||
    e.time?.trim()
  )
}

function calendarCellPreviewContent(
  e: CalendarDayEvent,
):
  | { kind: 'html'; html: string }
  | { kind: 'plain'; text: string }
  | null {
  const labelSan =
    e.labelHtml?.trim() ? sanitizeCalendarEventHtml(e.labelHtml) : ''
  if (labelSan && htmlToPlain(labelSan)) {
    return { kind: 'html', html: labelSan }
  }
  const lt = e.label.trim()
  if (lt) return { kind: 'plain', text: lt }

  const noteSan =
    e.noteHtml?.trim() ? sanitizeCalendarEventHtml(e.noteHtml) : ''
  if (noteSan && htmlToPlain(noteSan)) {
    return { kind: 'html', html: noteSan }
  }
  const nt = e.note?.trim()
  if (nt) return { kind: 'plain', text: nt }

  const t = e.time?.trim()
  if (t) return { kind: 'plain', text: formatTimeKo(t) }

  return null
}

type DayMemoPanelProps = {
  iso: string
  initial: CalendarDayMemo | undefined
  ledgerTxCount: number
  onPersist: (events: CalendarDayEvent[]) => void
  onDelete: () => void
}

function emptyEventRow(): CalendarDayEvent {
  return { id: crypto.randomUUID(), label: '' }
}

function CalendarInkPopover({
  ink,
  isOpen,
  onToggle,
  onRequestClose,
  onPick,
}: {
  ink: CalendarEventInkId | undefined
  isOpen: boolean
  onToggle: () => void
  onRequestClose: () => void
  onPick: (id: CalendarEventInkId | undefined) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onDocMouse = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onRequestClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose()
    }
    document.addEventListener('mousedown', onDocMouse, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouse, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onRequestClose])

  const current =
    CALENDAR_EVENT_INK_SWATCHES.find((s) => s.id === (ink ?? 'default')) ??
    CALENDAR_EVENT_INK_SWATCHES[0]

  return (
    <div ref={wrapRef} className="relative mt-1">
      <p className="text-xs font-medium text-text-soft">글자 색</p>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`글자 색: ${current.label}`}
        onClick={onToggle}
        className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border-strong bg-surface-raised py-1.5 pl-2 pr-2 text-left text-xs font-medium outline-none ring-green-accent/0 transition-colors hover:bg-ceramic/40 focus-visible:ring-2"
      >
        <span
          className={`block h-4 w-4 shrink-0 rounded-full ring-2 ring-black/10 ${current.dot}`}
          aria-hidden
        />
        <span className="min-w-0 max-w-[6.75rem] shrink truncate">
          {current.label}
        </span>
        <span className="shrink-0 text-[0.65rem] text-text-soft/80" aria-hidden>
          ▾
        </span>
      </button>
      {isOpen ? (
        <div
          role="dialog"
          aria-label="글자 색 선택"
          className="absolute left-0 z-[55] mt-1 max-h-[14rem] w-[min(100%,13rem)] overflow-y-auto rounded-lg border border-border-default bg-surface-raised py-1 shadow-xl"
        >
          {CALENDAR_EVENT_INK_SWATCHES.map((s) => {
            const active = (ink ?? 'default') === s.id
            return (
              <button
                key={s.id}
                type="button"
                className={[
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-green-light/40',
                  active ? 'bg-green-light/25 font-semibold' : '',
                ].join(' ')}
                onClick={() => {
                  onPick(s.id === 'default' ? undefined : s.id)
                  onRequestClose()
                }}
              >
                <span
                  className={`block h-4 w-4 shrink-0 rounded-full ring-2 ring-black/10 ${s.dot}`}
                  aria-hidden
                />
                {s.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function DayMemoPanel({
  iso,
  initial,
  ledgerTxCount,
  onPersist,
  onDelete,
}: DayMemoPanelProps) {
  const [events, setEvents] = useState<CalendarDayEvent[]>([emptyEventRow()])
  const [openInkIdx, setOpenInkIdx] = useState<number | null>(null)

  const closeInkPicker = useCallback(() => setOpenInkIdx(null), [])

  useEffect(() => {
    const list = getDayEvents(initial)
    setEvents(list.length > 0 ? list : [emptyEventRow()])
    setOpenInkIdx(null)
  }, [iso, initial?.updatedAt])

  const hol = holidayLabel(iso)
  const lunar = lunarCellInfo(iso, hol)

  const summaryLines = events.filter(eventHasListingContent)

  return (
    <Card
      id="calendar-day-detail"
      className="scroll-mt-24 p-0"
    >
      <div className="border-b border-border-muted px-4 py-3 md:px-5 md:py-4">
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
          className="rounded-lg border border-border-subtle bg-ceramic/60 px-3 py-2.5"
          aria-label="이 날 일정 요약"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
            이 날 요약
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-text-primary">
            {summaryLines.length > 0 ? (
              summaryLines.map((e) => (
                <li key={e.id}>
                  <div className={`font-medium ${calendarEventInkTextClass(e.ink)}`}>
                    {e.labelHtml?.trim() ? (
                      <span
                        className="inline-block [&_*]:leading-snug [&_strong]:font-semibold"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{
                          __html: sanitizeCalendarEventHtml(e.labelHtml ?? ''),
                        }}
                      />
                    ) : (
                      <span>{e.label.trim() || '일정'}</span>
                    )}
                  </div>
                  {e.time?.trim() ? (
                    <span className="text-text-soft">
                      {' '}
                      · {formatTimeKo(e.time.trim())}
                    </span>
                  ) : null}
                  {(e.note?.trim() || htmlToPlain(e.noteHtml)) ? (
                    <div
                      className={`mt-0.5 text-xs [&_*]:leading-snug ${calendarEventInkTextClass(e.ink)}`}
                    >
                      {e.noteHtml?.trim() ? (
                        <span
                          className="inline-block [&_strong]:font-semibold"
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{
                            __html: sanitizeCalendarEventHtml(e.noteHtml ?? ''),
                          }}
                        />
                      ) : (
                        <span>{e.note?.trim()}</span>
                      )}
                    </div>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="text-text-soft">
                아직 일정 없음 · 아래에서 추가 후 저장
              </li>
            )}
            <li>
              <span className="text-text-soft">장부 · </span>
              거래 {ledgerTxCount}건
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">
              일정 · 메모
            </p>
            <Button
              type="button"
              variant="outlined"
              className="!min-h-9 !px-3 !py-1 !text-xs"
              onClick={() =>
                setEvents((prev) => [...prev, emptyEventRow()])
              }
            >
              일정 추가
            </Button>
          </div>

          {events.map((ev, i) => (
            <div
              key={ev.id}
              className="rounded-lg border border-border-default bg-surface-raised p-3 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-soft">
                  일정 {i + 1}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-soft">
                  <input
                    type="checkbox"
                    checked={ev.important === true}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setEvents((prev) => {
                        const next = [...prev]
                        next[i] = { ...ev, important: checked }
                        return next
                      })
                    }}
                    className="rounded border-input-border"
                  />
                  중요
                </label>
              </div>
              <CalendarInkPopover
                ink={ev.ink}
                isOpen={openInkIdx === i}
                onToggle={() =>
                  setOpenInkIdx((prev) => (prev === i ? null : i))
                }
                onRequestClose={closeInkPicker}
                onPick={(next) => {
                  setEvents((prev) => {
                    const nextRows = [...prev]
                    nextRows[i] = { ...ev, ink: next }
                    return nextRows
                  })
                }}
              />
              <div className="mt-2">
                <p className="text-sm font-medium text-text-soft">제목</p>
                <div
                  className={`mt-1 ${calendarEventInkTextClass(ev.ink)} [&_.ProseMirror]:text-base`}
                >
                  <CalendarEventRichField
                    aria-label={`일정 ${i + 1} 제목`}
                    placeholder="예: 조동친구, 장보기"
                    key={`${ev.id}-label`}
                    html={ev.labelHtml}
                    plain={ev.label}
                    minHeightClass="min-h-[3.25rem]"
                    onChange={({ html, plain }) => {
                      setEvents((prev) => {
                        const next = [...prev]
                        next[i] = {
                          ...ev,
                          label: plain,
                          labelHtml: html.trim()
                            ? html
                            : undefined,
                        }
                        return next
                      })
                    }}
                  />
                </div>
              </div>
              <label className="mt-2 block text-sm font-medium text-text-soft">
                시간
                <input
                  type="time"
                  value={ev.time ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setEvents((prev) => {
                      const next = [...prev]
                      next[i] = { ...ev, time: v || undefined }
                      return next
                    })
                  }}
                  className={`mt-1 max-w-[10rem] rounded-lg border border-border-strong bg-surface-raised px-2 py-1.5 text-sm outline-none ring-green-accent/30 focus:ring-2 ${calendarEventInkTextClass(ev.ink)}`}
                />
              </label>
              <div className="mt-2">
                <p className="text-sm font-medium text-text-soft">메모</p>
                <div className={`mt-1 ${calendarEventInkTextClass(ev.ink)}`}>
                  <CalendarEventRichField
                    aria-label={`일정 ${i + 1} 메모`}
                    placeholder="메모"
                    key={`${ev.id}-note`}
                    html={ev.noteHtml}
                    plain={ev.note ?? ''}
                    minHeightClass="min-h-[5rem]"
                    onChange={({ html, plain }) => {
                      setEvents((prev) => {
                        const next = [...prev]
                        next[i] = {
                          ...ev,
                          note: plain || undefined,
                          noteHtml: html.trim()
                            ? html
                            : undefined,
                        }
                        return next
                      })
                    }}
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-xs text-danger underline decoration-danger/30"
                  onClick={() => {
                    setEvents((prev) => {
                      const next = prev.filter((_, j) => j !== i)
                      return next.length > 0 ? next : [emptyEventRow()]
                    })
                  }}
                >
                  이 일정 삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border-muted p-4">
        <Button
          type="button"
          variant="darkOutlined"
          className="min-h-11 flex-1 !border-danger !text-danger"
          onClick={() => {
            if (confirm('이 날짜의 모든 일정을 지울까요?')) onDelete()
          }}
        >
          이 날 전체 삭제
        </Button>
        <Button
          type="button"
          variant="primary"
          className="min-h-11 flex-1"
          onClick={() => onPersist(events)}
        >
          저장
        </Button>
      </div>
    </Card>
  )
}

function CalendarDayPeekSheet({
  iso,
  memo,
  ledgerTxCount,
  ddaysThisDay,
  onClose,
}: {
  iso: string
  memo: CalendarDayMemo | undefined
  ledgerTxCount: number
  ddaysThisDay: DdayEvent[]
  onClose: () => void
}) {
  const hol = holidayLabel(iso)
  const lunar = lunarCellInfo(iso, hol)
  const events = getDayEvents(memo)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-peek-heading"
        className="max-h-[min(88vh,36rem)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border-strong bg-ceramic/95 shadow-2xl sm:max-h-[min(82vh,32rem)] sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-[1] border-b border-border-subtle bg-ceramic/95 px-4 py-3 backdrop-blur-[6px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                id="calendar-peek-heading"
                className="font-serif-display text-lg font-semibold text-starbucks-green"
              >
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
            <button
              type="button"
              aria-label="닫기"
              className="shrink-0 rounded-full border border-border-default bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-green-light/50"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4 text-sm">
          <section aria-label="이 날 일정">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              일정
            </p>
            {events.length > 0 ? (
              <ul className="mt-2 space-y-3">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {e.time?.trim() ? (
                        <span className="rounded bg-green-accent/12 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-green-accent">
                          {formatTimeKo(e.time.trim())}
                        </span>
                      ) : null}
                      {e.important === true ? (
                        <span className="text-xs font-semibold text-amber-600">
                          중요
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`mt-1 text-[0.95rem] [&_*]:leading-snug [&_strong]:font-semibold ${calendarEventInkTextClass(e.ink)}`}
                    >
                      {e.labelHtml?.trim() ? (
                        <span
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{
                            __html: sanitizeCalendarEventHtml(e.labelHtml),
                          }}
                        />
                      ) : (
                        <span className="font-medium">
                          {e.label.trim() || '제목 없음'}
                        </span>
                      )}
                    </div>
                    {(e.note?.trim() || htmlToPlain(e.noteHtml)) ? (
                      <div
                        className={`mt-1.5 border-t border-border-muted pt-2 text-xs [&_*]:leading-snug [&_strong]:font-semibold ${calendarEventInkTextClass(e.ink)}`}
                      >
                        {e.noteHtml?.trim() ? (
                          <span
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{
                              __html: sanitizeCalendarEventHtml(e.noteHtml),
                            }}
                          />
                        ) : (
                          <span>{e.note?.trim()}</span>
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-text-soft">등록된 일정이 없어요.</p>
            )}
          </section>

          {ddaysThisDay.length > 0 ? (
            <section aria-label="이 날 디데이">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                디데이
              </p>
              <ul className="mt-2 space-y-1 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-xs font-semibold text-gold md:text-sm">
                {ddaysThisDay.map((d) => (
                  <li key={d.id}>{d.title}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              장부
            </p>
            <p className="mt-1 text-text-primary">
              이 날 거래 <span className="font-semibold tabular-nums">{ledgerTxCount}</span>건
            </p>
            <p className="mt-3 text-xs text-text-soft">
              아래 &quot;이 날 요약&quot; 영역에서 편집·저장할 수 있어요.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const now = useMemo(() => new Date(), [])
  const nav = useNavigate()
  const detailRef = useRef<HTMLDivElement | null>(null)
  const [cursorY, setCursorY] = useState(now.getFullYear())
  const [cursorM, setCursorM] = useState(now.getMonth())
  const [selectedIso, setSelectedIso] = useState<string>(() => todayIso())
  const [peekIso, setPeekIso] = useState<string | null>(null)

  const { transactions, userId, householdId } = useLedger()
  const { memos, patchMemos, cloudStatus, cloudMessage } =
    useHouseholdCalendarMemos()

  const { events: ddayEvents } = useHouseholdDDays()
  const ddaySummaryLines = useMemo(
    () => buildDdaySummaryLines(ddayEvents).slice(0, 10),
    [ddayEvents],
  )

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

  useEffect(() => {
    if (!peekIso) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPeekIso(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [peekIso])

  const goPrevMonth = useCallback(() => {
    setPeekIso(null)
    setCursorM((m) => {
      if (m <= 0) {
        setCursorY((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }, [])

  const goNextMonth = useCallback(() => {
    setPeekIso(null)
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
    setPeekIso(null)
    const n = new Date()
    setCursorY(n.getFullYear())
    setCursorM(n.getMonth())
    setSelectedIso(todayIso())
    scrollDetailIntoView()
  }, [scrollDetailIntoView])

  const onPickDay = useCallback(
    (iso: string) => {
      const m = memos[iso]
      setSelectedIso(iso)
      setPeekIso(memoHasContent(m) ? iso : null)
    },
    [memos],
  )

  const persistMemo = useCallback(
    (nextEvents: CalendarDayEvent[]) => {
      patchMemos((prev) => setCalendarDayEvents(prev, selectedIso, nextEvents))
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {ddaySummaryLines.length > 0 ? (
              <div
                className="flex flex-wrap gap-2"
                aria-label="디데이 요약"
              >
                {ddaySummaryLines.map((line) => (
                  <span
                    key={line.id}
                    className="inline-flex max-w-[min(100%,18rem)] items-center rounded-full border border-border-subtle bg-ceramic/90 px-2.5 py-1 text-xs text-text-secondary md:max-w-md md:text-sm"
                  >
                    <span className="truncate">{line.text}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-soft">
                <Link
                  to="/calendar/dday"
                  className="font-medium text-starbucks-green underline-offset-2 hover:underline"
                >
                  디데이 설정
                </Link>
                에서 생일·시험일·아기 개월수 등을 등록할 수 있어요.
              </p>
            )}
          </div>
          <Link
            to="/calendar/dday"
            className="shrink-0 self-start rounded-full border border-border-strong bg-surface-raised px-3 py-1.5 text-sm font-semibold text-starbucks-green transition-colors hover:bg-green-light/40"
          >
            디데이 설정
          </Link>
        </div>
        {backend === 'supabase' && cloudConfigured ? (
          <div className="mt-4 space-y-2">
            {!userId ? null : !householdId ? (
              <div className="rounded-[var(--radius-card)] border border-amber-200/70 bg-alert-surface px-4 py-3 text-sm text-text-primary">
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
                <p className="mt-2 text-xs text-text-muted">
                  로컬 메모는 이 기기에 저장·편집할 수 있어요. 테이블을 방금
                  만들었었다면 PostgREST 스키마 반영까지 잠시 걸릴 수 있어요.
                  새로고침 후에도 같으면 Supabase 프로젝트 URL이 이 앱의 환경
                  변수와 같은지 확인해 주세요.
                </p>
              </div>
            ) : cloudStatus === 'loading' ? (
              <p className="text-sm text-text-soft">가구 일정을 불러오는 중…</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <CalendarStickyNotesBoard />

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
              <p className="min-w-[10rem] flex-1 text-center text-base font-semibold text-text-primary md:text-lg">
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
              const memo = memos[iso]
              const hasMemo = memoHasContent(memo)
              const txCount = txCountByDate.get(iso) ?? 0
              const hasLedger = txCount > 0
              const isToday = iso === today
              const isSel = iso === selectedIso
              const isSunday = cellIdx % 7 === 0
              const isRedDay = (isSunday || !!hol) && inMonth
              const starImportant =
                  getDayEvents(memo).some((e) => e.important === true) && hasMemo
              const ddaysThisDay = eventsOnCalendarDay(iso, ddayEvents)

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onPickDay(iso)}
                  aria-pressed={isSel}
                  aria-label={
                    starImportant
                      ? `${iso} 메모·일정, 중요 일정 있음`
                      : `${iso} 메모·일정`
                  }
                  className={[
                    'relative flex min-h-[4.5rem] w-full cursor-pointer flex-col overflow-hidden rounded-lg border px-1 py-1.5 text-left transition-colors active:scale-[0.98] md:min-h-[6rem] md:px-1.5 md:py-2',
                    inMonth
                      ? 'border-border-subtle bg-surface-raised hover:border-green-accent/45 hover:bg-green-light/35'
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
                  {starImportant ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-[42%] z-0 -translate-x-1/2 -translate-y-1/2 select-none text-[3.75rem] font-normal leading-none text-amber-500/[0.32] drop-shadow-[0_0_10px_rgba(245,158,11,0.45)] md:top-[44%] md:text-[4.5rem]"
                    >
                      ★
                    </span>
                  ) : null}
                  <span
                    aria-hidden
                    className={[
                      'pointer-events-none absolute left-1/2 top-[42%] z-[1] -translate-x-1/2 -translate-y-1/2 select-none text-[2.6rem] font-semibold leading-none tabular-nums md:top-[44%] md:text-[3.1rem]',
                      inMonth && isRedDay
                        ? 'text-red-500/[0.11]'
                        : inMonth
                          ? 'text-text-primary/[0.08]'
                          : 'text-text-soft/[0.14]',
                    ].join(' ')}
                  >
                    {day}
                  </span>

                  <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-0.5">
                    <div className="flex shrink-0 justify-end gap-0.5">
                      {hasLedger ? (
                        <span
                          className="rounded bg-green-accent/15 px-1 text-[0.625rem] font-semibold tabular-nums text-green-accent md:text-[0.6875rem]"
                          title="이 날 장부 거래 수"
                        >
                          {txCount}
                        </span>
                      ) : null}
                    </div>
                    {hol && inMonth ? (
                      <span className="line-clamp-2 text-left text-[0.62rem] font-medium leading-tight text-red-500 md:text-[0.68rem]">
                        {hol}
                      </span>
                    ) : null}
                    {hasMemo ? (
                      <ul className="line-clamp-3 w-full space-y-0.5 text-left text-[0.65rem] leading-snug md:text-[0.7rem]">
                        {getDayEvents(memo).map((e) => {
                          const preview = calendarCellPreviewContent(e)
                          if (!preview) return null
                          return (
                            <li
                              key={e.id}
                              className={`max-w-full pl-0.5 [&_mark]:rounded-[3px] ${calendarEventInkTextClass(e.ink)}`}
                            >
                              {preview.kind === 'html' ? (
                                <span
                                  className="inline-block max-w-full [&_mark]:rounded-[3px] [&_p]:m-0 [&_p]:inline"
                                  title={htmlToPlain(preview.html)}
                                  // eslint-disable-next-line react/no-danger
                                  dangerouslySetInnerHTML={{
                                    __html: preview.html,
                                  }}
                                />
                              ) : (
                                <span className="line-clamp-1 truncate">
                                  {preview.text}
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                    {ddaysThisDay.length > 0 ? (
                      <span
                        className="line-clamp-2 text-left text-[0.58rem] font-semibold leading-tight text-gold md:text-[0.62rem]"
                        title={ddaysThisDay.map((e) => e.title).join(', ')}
                      >
                        {ddaysThisDay.length === 1
                          ? `D ${ddaysThisDay[0].title}`
                          : `D ${ddaysThisDay[0].title} 외 ${ddaysThisDay.length - 1}`}
                      </span>
                    ) : null}
                  </div>
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

      {peekIso
        ? createPortal(
            <CalendarDayPeekSheet
              iso={peekIso}
              memo={memos[peekIso]}
              ledgerTxCount={txCountByDate.get(peekIso) ?? 0}
              ddaysThisDay={eventsOnCalendarDay(peekIso, ddayEvents)}
              onClose={() => setPeekIso(null)}
            />,
            document.body,
          )
        : null}
    </main>
  )
}
