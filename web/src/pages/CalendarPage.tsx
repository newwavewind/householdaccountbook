import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KakaoTalkShareIconButton } from '../components/KakaoTalkShareIconButton'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  deleteCalendarMemo,
  getDayEvents,
  setCalendarDayEvents,
  type CalendarDayEvent,
  type CalendarDayMemo,
} from '../calendar/calendarMemoStorage'
import {
  lunarCellInfo,
  lunarCenterDayText,
  lunarMonthRangeLabel,
} from '../calendar/lunarDisplay'
import {
  loadCalendarLunarView,
  saveCalendarLunarView,
} from '../calendar/calendarLunarViewStorage'
import CalendarStickyNotesBoard from '../calendar/CalendarStickyNotesBoard'
import { useHouseholdCalendarMemos } from '../calendar/useHouseholdCalendarMemos'
import { useHouseholdCalendarStickers } from '../calendar/useHouseholdCalendarStickers'
import { useDiaryCloudMigration } from '../hooks/useDiaryCloudMigration'
import { buildDdaySummaryLines, eventsOnCalendarDay } from '../dday/ddayCompute'
import { DdaySummaryTicker } from '../dday/DdaySummaryTicker'
import { useHouseholdDDays } from '../dday/useHouseholdDDays'
import { useLedger } from '../hooks/useLedger'
import {
  calendarLabelTextClass,
  getCalendarDayLabels,
  holidayLabel,
  isRedCalendarDay,
} from '../lib/holidays'
import { CalendarDayLabelsInline } from '../components/CalendarDayLabelsInline'
import { MarqueeTickerRows, type MarqueeTickerRow } from '../components/MarqueeTickerRows'
import { isCloudSyncEnabled } from '../lib/supabaseClient'
import { ledgerBackendMode } from '../lib/ledgerBackend'
import {
  calendarEventInkTextClass,
  resolveCalendarEventMemoInk,
  type CalendarEventInkId,
} from '../calendar/calendarEventInk'
import { CalendarEventMemoTintPicker } from '../calendar/CalendarEventMemoTintPicker'
import { CalendarEventRichField } from '../calendar/CalendarEventRichField'
import type { StickyTint } from '../calendar/calendarStickyNotesStorage'
import { STICKY_THEMES, stickyTintCalendarCellBg } from '../calendar/stickyNoteTheme'
import {
  extractFirstImageSrc,
  htmlToPlain,
  htmlWithoutImages,
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

/** 요약 모달 제목 줄: 본문(연월일)과 요일 토큰 분리 */
function splitSelectedHeadingForPeek(iso: string): { main: string; weekday: string } {
  const full = formatSelectedHeading(iso).trim()
  const tokens = full.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return { main: full, weekday: '' }
  const weekday = tokens[tokens.length - 1]!
  const main = tokens.slice(0, -1).join(' ')
  return { main, weekday }
}

function memoHasContent(memo: CalendarDayMemo | undefined): boolean {
  return getDayEvents(memo).length > 0
}

/** 달력 칸 색 — 첫 번째 일정의 메모지 색과 동일하게 */
function firstEventPaperTint(memo: CalendarDayMemo | undefined): StickyTint {
  return getDayEvents(memo)[0]?.memoTint ?? 'yellow'
}

function formatTimeKo(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return hhmm
  return `${m[1]}:${m[2]}`
}

function mergeCalendarEventToUnifiedMemo(e: CalendarDayEvent): CalendarDayEvent {
  const lhRaw = e.labelHtml?.trim()
  const nhRaw = e.noteHtml?.trim()
  const lh = lhRaw ? sanitizeCalendarEventHtml(lhRaw) : ''
  const nh = nhRaw ? sanitizeCalendarEventHtml(nhRaw) : ''
  const lp = e.label.trim()
  const np = (e.note ?? '').trim()

  const hasLh = !!(lh && htmlToPlain(lh))
  const hasNh = !!(nh && htmlToPlain(nh))
  const hasLp = !!lp
  const hasNp = !!np

  let noteHtml: string | undefined
  let notePlain: string | undefined

  if (hasLh && hasNh) {
    noteHtml = sanitizeCalendarEventHtml(`${lh}${nh}`)
    notePlain = htmlToPlain(noteHtml) || undefined
  } else if (hasLh) {
    noteHtml = lh
    notePlain = htmlToPlain(lh) || undefined
  } else if (hasNh) {
    noteHtml = nh
    notePlain = htmlToPlain(nh) || undefined
  } else if (hasLp && hasNp) {
    notePlain = `${lp}\n\n${np}`
  } else if (hasLp) {
    notePlain = lp
  } else if (hasNp) {
    notePlain = np
  }

  const memoInk = resolveCalendarEventMemoInk(e)

  return {
    ...e,
    label: '',
    labelHtml: undefined,
    labelInk: undefined,
    note: notePlain,
    noteHtml: noteHtml?.trim() ? noteHtml : undefined,
    noteInk: memoInk && memoInk !== 'default' ? memoInk : undefined,
  }
}

function calendarCellBackgroundImage(
  memo: CalendarDayMemo | undefined,
): string | null {
  for (const e of getDayEvents(memo)) {
    const merged = mergeCalendarEventToUnifiedMemo(e)
    const src =
      extractFirstImageSrc(merged.noteHtml) ??
      extractFirstImageSrc(e.noteHtml) ??
      extractFirstImageSrc(e.labelHtml)
    if (src) return src
  }
  return null
}

function calendarCellPreviewContent(
  e: CalendarDayEvent,
):
  | { kind: 'plain'; text: string; ink: CalendarEventInkId | undefined }
  | null {
  const ink = resolveCalendarEventMemoInk(e)
  const noteSan =
    e.noteHtml?.trim() ? sanitizeCalendarEventHtml(e.noteHtml) : ''
  if (noteSan) {
    const plain = htmlToPlain(htmlWithoutImages(noteSan))
    if (plain) return { kind: 'plain', text: plain, ink }
  }
  const nt = e.note?.trim()
  if (nt) return { kind: 'plain', text: nt, ink }

  const labelSan =
    e.labelHtml?.trim() ? sanitizeCalendarEventHtml(e.labelHtml) : ''
  if (labelSan) {
    const plain = htmlToPlain(htmlWithoutImages(labelSan))
    if (plain) return { kind: 'plain', text: plain, ink }
  }
  const lt = e.label.trim()
  if (lt) return { kind: 'plain', text: lt, ink }

  const t = e.time?.trim()
  if (t) return { kind: 'plain', text: formatTimeKo(t), ink }

  return null
}

type DayMemoPanelProps = {
  iso: string
  initial: CalendarDayMemo | undefined
  onPersist: (events: CalendarDayEvent[]) => void
  onDelete: () => void
}

function emptyEventRow(): CalendarDayEvent {
  return { id: crypto.randomUUID(), label: '' }
}

function DayMemoPanel({
  iso,
  initial,
  onPersist,
  onDelete,
}: DayMemoPanelProps) {
  const [events, setEvents] = useState<CalendarDayEvent[]>([emptyEventRow()])

  useEffect(() => {
    const raw = getDayEvents(initial)
    const list = raw.map(mergeCalendarEventToUnifiedMemo)
    setEvents(list.length > 0 ? list : [emptyEventRow()])
  }, [iso, initial])

  const hol = holidayLabel(iso)
  const lunar = lunarCellInfo(iso, hol)

  return (
    <Card
      id="calendar-day-detail"
      className="scroll-mt-24 p-0"
    >
      <div className="border-b border-border-muted px-4 py-3 md:px-5 md:py-4">
        <div className="min-w-0">
          <p className="text-base font-semibold text-starbucks-green">
            {formatSelectedHeading(iso)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-soft">
            <CalendarDayLabelsInline iso={iso} variant="detail" />
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
      </div>

      <div className="space-y-3 px-4 py-3 md:px-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-text-primary">
              일정 · 메모
            </p>
            <Button
              type="button"
              variant="outlined"
              className="!min-h-11 min-w-[5.5rem] shrink-0 touch-manipulation !px-3 !py-2 !text-xs"
              onClick={() =>
                setEvents((prev) => [...prev, emptyEventRow()])
              }
            >
              일정 추가
            </Button>
          </div>

          {events.map((ev, i) => {
            const paper: StickyTint = ev.memoTint ?? 'yellow'
            const stickyTheme = STICKY_THEMES[paper]
            return (
              <div
                key={ev.id}
                className="flex min-h-[18rem] flex-col overflow-visible rounded-md border border-black/15 shadow-[3px_5px_18px_rgba(0,0,0,0.14)]"
              >
                <header
                  className={`relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 overflow-visible px-1.5 py-1 ${stickyTheme.headerClass}`}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:gap-x-3">
                    <span className="text-[0.72rem] font-semibold tabular-nums text-text-secondary">
                      일정 {i + 1}
                    </span>
                    <label className="flex cursor-pointer items-center gap-1 text-[0.65rem] font-medium text-text-secondary">
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
                        className="size-3.5 rounded border-black/25 text-text-primary"
                      />
                      중요
                    </label>
                    <div
                      className="relative flex h-7 w-[7.25rem] max-w-[42vw] shrink-0 items-stretch overflow-hidden rounded border border-black/20 bg-white/90 sm:max-w-none"
                      title={ev.time?.trim() ? undefined : '시간 미지정'}
                    >
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
                        className={`h-full min-w-0 flex-1 border-0 bg-transparent text-xs text-text-primary outline-none focus-visible:ring-0 ${
                          ev.time?.trim() ? 'pl-1.5 pr-5' : 'px-1.5'
                        }`}
                        aria-label={`일정 ${i + 1} 시간`}
                      />
                      {ev.time?.trim() ? (
                        <button
                          type="button"
                          className="absolute right-0 top-0 flex h-full w-6 shrink-0 items-center justify-center border-l border-black/15 bg-white/95 text-[0.95rem] leading-none text-text-muted hover:bg-black/[0.06]"
                          aria-label={`일정 ${i + 1} 시간 없음`}
                          title="시간 지정 안 함"
                          onClick={() => {
                            setEvents((prev) => {
                              const next = [...prev]
                              next[i] = { ...ev, time: undefined }
                              return next
                            })
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <CalendarEventMemoTintPicker
                      value={paper}
                      aria-label={`일정 ${i + 1} 메모지 색`}
                      menuAlign="right"
                      onPick={(t) => {
                        setEvents((prev) => {
                          const next = [...prev]
                          const row: CalendarDayEvent = { ...ev }
                          if (t === 'yellow') delete row.memoTint
                          else row.memoTint = t
                          next[i] = row
                          return next
                        })
                      }}
                    />
                    <KakaoTalkShareIconButton
                      className={stickyTheme.headerBtnClass}
                      titlePrefix={`${formatSelectedHeading(iso)} · 일정 ${i + 1}`}
                      text={
                        htmlToPlain(
                          ev.noteHtml?.trim()
                            ? sanitizeCalendarEventHtml(ev.noteHtml)
                            : '',
                        ) ||
                        ev.note?.trim() ||
                        '(메모 없음)'
                      }
                    />
                    <button
                      type="button"
                      className={stickyTheme.headerBtnClass}
                      aria-label="이 일정 삭제"
                      onClick={() => {
                        setEvents((prev) => {
                          const next = prev.filter((_, j) => j !== i)
                          return next.length > 0 ? next : [emptyEventRow()]
                        })
                      }}
                    >
                      <span className="px-1 text-sm leading-none">×</span>
                    </button>
                  </div>
                </header>
                <div
                  className={`flex min-h-0 flex-1 flex-col overflow-hidden ${stickyTheme.bodyClass}`}
                >
                  <div
                    className={`flex min-h-0 flex-1 flex-col ${calendarEventInkTextClass(
                      resolveCalendarEventMemoInk(ev),
                    )}`}
                  >
                    <CalendarEventRichField
                      variant="sticky"
                      paperTint={paper}
                      memoInk={ev.noteInk}
                      inkControlId={`cal-ink-toolbar-${ev.id}`}
                      onMemoInkChange={(next) => {
                        setEvents((prev) => {
                          const nextRows = [...prev]
                          nextRows[i] = { ...ev, noteInk: next }
                          return nextRows
                        })
                      }}
                      aria-label={`일정 ${i + 1} 메모`}
                      placeholder="메모를 작성하세요…"
                      key={`${ev.id}-memo`}
                      html={ev.noteHtml}
                      plain={ev.note ?? ''}
                      minHeightClass="min-h-0"
                      onChange={({ html, plain }) => {
                        setEvents((prev) => {
                          const next = [...prev]
                          next[i] = {
                            ...ev,
                            label: '',
                            labelHtml: undefined,
                            labelInk: undefined,
                            note: plain,
                            noteHtml: html.trim() ? html : undefined,
                          }
                          return next
                        })
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
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
  onGoToMemoEdit,
  onGoToLedger,
  onToggleEventImportant,
}: {
  iso: string
  memo: CalendarDayMemo | undefined
  ledgerTxCount: number
  ddaysThisDay: DdayEvent[]
  onClose: () => void
  onGoToMemoEdit: () => void
  onGoToLedger: () => void
  /** 모달에서 일정 중요 표시를 바로 저장할 때 */
  onToggleEventImportant?: (eventId: string, important: boolean) => void
}) {
  const hol = holidayLabel(iso)
  const lunar = lunarCellInfo(iso, hol)
  const events = getDayEvents(memo)
  const { main: headingMain, weekday: headingWeekday } =
    splitSelectedHeadingForPeek(iso)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-peek-heading"
        className="mx-auto max-h-[min(85dvh,36rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-strong bg-ceramic/95 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-[1] border-b border-border-subtle bg-ceramic/95 px-4 py-3 backdrop-blur-[6px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                id="calendar-peek-heading"
                className="font-serif-display flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold text-starbucks-green"
              >
                <span>{headingMain}</span>
                {headingWeekday ? (
                  <span className="shrink-0 whitespace-nowrap">
                    {headingWeekday}
                  </span>
                ) : null}
                {onToggleEventImportant && events.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium">
                    {events.map((ev, idx) => (
                      <label
                        key={ev.id}
                        className="inline-flex cursor-pointer items-center gap-1 text-text-secondary"
                      >
                        <input
                          type="checkbox"
                          checked={ev.important === true}
                          onChange={(e) =>
                            onToggleEventImportant(ev.id, e.target.checked)
                          }
                          className="size-3.5 rounded border-black/25 text-amber-600"
                        />
                        <span className="text-amber-800">
                          {events.length > 1 ? `일정 ${idx + 1} 중요` : '중요'}
                        </span>
                      </label>
                    ))}
                  </span>
                ) : null}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-soft">
                <CalendarDayLabelsInline iso={iso} variant="detail" />
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                일정
              </p>
              <Button
                type="button"
                variant="outlined"
                className="!min-h-0 shrink-0 !px-2.5 !py-1 !text-xs"
                onClick={onGoToMemoEdit}
              >
                입력
              </Button>
            </div>
            {events.length > 0 ? (
              <ul className="mt-2 space-y-3">
                {events.map((e) => {
                  const u = mergeCalendarEventToUnifiedMemo(e)
                  return (
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
                      {!onToggleEventImportant && e.important === true ? (
                        <span className="text-xs font-semibold text-amber-600">
                          중요
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`mt-1 text-[0.95rem] [&_*]:leading-snug [&_strong]:font-semibold ${calendarEventInkTextClass(
                        resolveCalendarEventMemoInk(u),
                      )}`}
                    >
                      {u.noteHtml?.trim() ? (
                        <span
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{
                            __html: sanitizeCalendarEventHtml(u.noteHtml ?? ''),
                          }}
                        />
                      ) : (
                        <span className="font-medium">
                          {u.note?.trim() || '메모 없음'}
                        </span>
                      )}
                    </div>
                  </li>
                  )
                })}
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
            {ledgerTxCount > 0 ? (
              <button
                type="button"
                className="mt-1 text-left text-text-primary underline-offset-2 transition-colors hover:text-starbucks-green hover:underline"
                onClick={onGoToLedger}
              >
                이 날 거래{' '}
                <span className="font-semibold tabular-nums">{ledgerTxCount}</span>건
              </button>
            ) : (
              <p className="mt-1 text-text-soft">이 날 거래 없음</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const now = useMemo(() => new Date(), [])
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const detailRef = useRef<HTMLDivElement | null>(null)
  const deepLinkDayRef = useRef<string | null>(null)
  const [cursorY, setCursorY] = useState(now.getFullYear())
  const [cursorM, setCursorM] = useState(now.getMonth())
  const [selectedIso, setSelectedIso] = useState<string>(() => todayIso())
  const [peekIso, setPeekIso] = useState<string | null>(null)
  const [lunarView, setLunarView] = useState(() => loadCalendarLunarView())

  const { transactions, userId, householdId } = useLedger()
  const { memos, patchMemos, cloudStatus, cloudMessage } =
    useHouseholdCalendarMemos()

  const { events: ddayEvents, cloudStatus: ddayCloudStatus } = useHouseholdDDays()
  const {
    notes: stickyNotes,
    patchNotes: patchStickyNotes,
    cloudStatus: stickerCloudStatus,
    cloudMessage: stickerCloudMessage,
  } = useHouseholdCalendarStickers()

  useDiaryCloudMigration(householdId, {
    memos: cloudStatus,
    ddays: ddayCloudStatus,
    stickers: stickerCloudStatus,
  })
  const ddaySummaryLines = useMemo(
    () => buildDdaySummaryLines(ddayEvents),
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

  const lunarMonthSubtitle = useMemo(
    () => (lunarView ? lunarMonthRangeLabel(cursorY, cursorM) : ''),
    [lunarView, cursorY, cursorM],
  )

  const today = todayIso()

  const toggleLunarView = useCallback(() => {
    setLunarView((prev) => {
      const next = !prev
      saveCalendarLunarView(next)
      return next
    })
  }, [])

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

  useEffect(() => {
    const raw = searchParams.get('day')
    if (!raw) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      setSearchParams({}, { replace: true })
      return
    }
    const [y, mo, dd] = raw.split('-').map(Number)
    const dt = new Date(y, mo - 1, dd)
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== dd
    ) {
      setSearchParams({}, { replace: true })
      return
    }
    deepLinkDayRef.current = raw
    setPeekIso(null)
    setCursorY(y)
    setCursorM(mo - 1)
    setSelectedIso(raw)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const d = deepLinkDayRef.current
    if (!d) return
    if (selectedIso !== d) {
      deepLinkDayRef.current = null
      return
    }
    if (cloudStatus === 'loading') return
    scrollDetailIntoView()
    deepLinkDayRef.current = null
  }, [selectedIso, cloudStatus, scrollDetailIntoView])

  const goThisMonth = useCallback(() => {
    setPeekIso(null)
    const n = new Date()
    setCursorY(n.getFullYear())
    setCursorM(n.getMonth())
    setSelectedIso(todayIso())
    scrollDetailIntoView()
  }, [scrollDetailIntoView])

  const onPickDay = useCallback((iso: string) => {
    setSelectedIso(iso)
    setPeekIso(iso)
  }, [])

  const patchPeekDayEventImportant = useCallback(
    (eventId: string, important: boolean) => {
      if (!peekIso) return
      patchMemos((prev) => {
        const list = getDayEvents(prev[peekIso])
        const next = list.map((row) =>
          row.id === eventId ? { ...row, important } : row,
        )
        return setCalendarDayEvents(prev, peekIso, next)
      })
    },
    [patchMemos, peekIso],
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
        <DdaySummaryTicker lines={ddaySummaryLines} />
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
            ) : cloudStatus === 'loading' ||
              ddayCloudStatus === 'loading' ||
              stickerCloudStatus === 'loading' ? (
              <p className="text-sm text-text-soft">가구 다이어리를 불러오는 중…</p>
            ) : stickerCloudStatus === 'error' && stickerCloudMessage ? (
              <div className="rounded-[var(--radius-card)] border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-danger">
                스티커 동기화 오류: {stickerCloudMessage}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <CalendarStickyNotesBoard notes={stickyNotes} patchNotes={patchStickyNotes} />

        <Card className="min-w-0 p-1.5 md:p-2">
          <div className="mb-2 flex flex-col gap-2 rounded-[var(--radius-card)] bg-ceramic/80 p-2 md:flex-row md:items-center md:justify-between md:p-3">
            <div className="flex flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-2 md:justify-start">
              <Button
                variant="outlined"
                className="!min-h-11 min-w-11 !px-3"
                aria-label="이전 달"
                type="button"
                onClick={goPrevMonth}
              >
                ‹
              </Button>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1">
                <p className="w-full text-center text-base font-semibold text-text-primary md:text-lg">
                  {formatMonthLabel(cursorY, cursorM)}
                </p>
                {lunarMonthSubtitle ? (
                  <p className="text-center text-xs font-medium text-starbucks-green">
                    {lunarMonthSubtitle}
                  </p>
                ) : null}
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-green-accent/40 hover:bg-green-light/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green-accent/50">
                <input
                  type="checkbox"
                  checked={lunarView}
                  onChange={toggleLunarView}
                  className="size-3.5 rounded border-black/25 text-green-accent"
                />
                음력
              </label>
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

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-sm font-medium text-text-soft md:gap-1 md:text-base">
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

          <div className="grid grid-cols-7 gap-0.5 md:gap-1">
            {cells.map(({ iso, day, inMonth }, cellIdx) => {
              const dayLabels = getCalendarDayLabels(iso)
              const holText = holidayLabel(iso)
              const lunar = lunarCellInfo(iso, holText)
              const memo = memos[iso]
              const hasMemo = memoHasContent(memo)
              const cellBgImage = hasMemo
                ? calendarCellBackgroundImage(memo)
                : null
              const txCount = txCountByDate.get(iso) ?? 0
              const hasLedger = txCount > 0
              const isToday = iso === today
              const isSel = iso === selectedIso
              const isSunday = cellIdx % 7 === 0
              const isRedDay =
                inMonth &&
                (isSunday || isRedCalendarDay(dayLabels?.primaryKind))
              const starImportant =
                  getDayEvents(memo).some((e) => e.important === true) && hasMemo
              const ddaysThisDay = eventsOnCalendarDay(iso, ddayEvents)
              const cellTextShadow = cellBgImage
                ? 'font-semibold drop-shadow-[0_0_4px_rgba(255,255,255,0.95)]'
                : ''
              const cellTickerRows: MarqueeTickerRow[] = []
              if (dayLabels && inMonth) {
                for (const e of dayLabels.entries) {
                  cellTickerRows.push({
                    id: `label-${e.kind}-${e.name}`,
                    ariaLabel: e.name,
                    node: (
                      <span
                        className={`text-[0.62rem] font-medium leading-tight md:text-[0.68rem] ${calendarLabelTextClass(e.kind)} ${cellTextShadow}`}
                      >
                        {e.name}
                      </span>
                    ),
                  })
                }
              }
              if (hasMemo) {
                for (const e of getDayEvents(memo)) {
                  const preview = calendarCellPreviewContent(e)
                  if (!preview) continue
                  cellTickerRows.push({
                    id: `event-${e.id}`,
                    ariaLabel: preview.text,
                    node: (
                      <span
                        className={`text-[0.65rem] leading-snug md:text-[0.7rem] ${cellTextShadow} ${calendarEventInkTextClass(preview.ink)}`}
                      >
                        {preview.text}
                      </span>
                    ),
                  })
                }
              }
              for (const d of ddaysThisDay) {
                cellTickerRows.push({
                  id: `dday-${d.id}`,
                  ariaLabel: d.title,
                  node: (
                    <span
                      className={`text-[0.58rem] font-semibold leading-tight text-gold md:text-[0.62rem] ${cellTextShadow}`}
                    >
                      D {d.title}
                    </span>
                  ),
                })
              }
              const hasCellTicker = cellTickerRows.length > 0

              const inMonthBase = hasMemo
                ? cellBgImage
                  ? 'border-border-subtle bg-surface-raised/30 hover:border-green-accent/45'
                  : `border-border-subtle ${stickyTintCalendarCellBg(
                      firstEventPaperTint(memo),
                      true,
                    )} hover:border-green-accent/45 hover:bg-green-light/30`
                : 'border-border-subtle bg-surface-raised hover:border-green-accent/45 hover:bg-green-light/35'

              const outMonthBase = hasMemo
                ? cellBgImage
                  ? 'border-transparent bg-surface-raised/25 text-text-soft/80 hover:bg-neutral-cool/40'
                  : `border-transparent ${stickyTintCalendarCellBg(
                      firstEventPaperTint(memo),
                      false,
                    )} text-text-soft/60 hover:bg-neutral-cool/65`
                : 'border-transparent bg-neutral-cool/50 text-text-soft/60 hover:bg-neutral-cool'

              const selectedCellClass =
                isSel && hasMemo
                  ? 'ring-2 ring-inset ring-green-accent/60'
                  : isSel
                    ? 'bg-green-light/50'
                    : ''

              const centerDayText =
                lunarView && lunar
                  ? lunarCenterDayText(lunar.label, lunar.emphasize)
                  : String(day)
              const centerDayClass =
                lunarView && lunar
                  ? lunar.emphasize
                    ? 'text-starbucks-green/[0.22] md:text-[2.4rem]'
                    : 'text-text-primary/[0.14] md:text-[2.8rem]'
                  : inMonth && isRedDay
                    ? 'text-red-500/[0.11]'
                    : inMonth
                      ? 'text-text-primary/[0.08]'
                      : 'text-text-soft/[0.14]'

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onPickDay(iso)}
                  aria-pressed={isSel}
                  aria-label={
                    starImportant
                      ? lunarView && lunar
                        ? `${iso} 양력 ${day}일, 음력 ${lunar.label}, 중요 일정 있음`
                        : `${iso} 메모·일정, 중요 일정 있음`
                      : lunarView && lunar
                        ? `${iso} 양력 ${day}일, 음력 ${lunar.label}`
                        : `${iso} 메모·일정`
                  }
                  className={[
                    'relative flex min-h-[5rem] w-full cursor-pointer flex-col overflow-hidden rounded-lg border px-1 py-1.5 text-left transition-colors active:scale-[0.98] md:min-h-[6.25rem] md:px-1.5 md:py-2',
                    inMonth ? inMonthBase : outMonthBase,
                    inMonth && isRedCalendarDay(dayLabels?.primaryKind)
                      ? 'ring-1 ring-inset ring-red-300/60'
                      : '',
                    hasLedger && inMonth
                      ? 'shadow-[0_0_0_1px_rgba(0,117,74,0.2)]'
                      : '',
                    isToday
                      ? 'outline outline-2 outline-offset-[-2px] outline-green-accent/70'
                      : '',
                    lunarView && lunar?.emphasize && inMonth
                      ? 'ring-1 ring-inset ring-starbucks-green/35'
                      : '',
                    selectedCellClass,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {cellBgImage ? (
                    <>
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${JSON.stringify(cellBgImage)})`,
                        }}
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-b from-white/50 via-white/15 to-black/30"
                      />
                    </>
                  ) : null}
                  {starImportant ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-[42%] z-0 -translate-x-1/2 -translate-y-1/2 select-none text-[3.75rem] font-normal leading-none text-amber-500/[0.32] drop-shadow-[0_0_10px_rgba(245,158,11,0.45)] md:top-[44%] md:text-[4.5rem]"
                    >
                      ★
                    </span>
                  ) : null}
                  {lunarView ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1 top-0.5 z-[2] select-none text-[0.625rem] font-semibold tabular-nums text-text-soft md:text-[0.6875rem]"
                    >
                      {day}
                    </span>
                  ) : null}
                  <span
                    aria-hidden
                    className={[
                      'pointer-events-none absolute left-1/2 top-[42%] z-[1] -translate-x-1/2 -translate-y-1/2 select-none text-[2.6rem] font-semibold leading-none tabular-nums md:top-[44%] md:text-[3.1rem]',
                      centerDayClass,
                    ].join(' ')}
                  >
                    {centerDayText}
                  </span>

                  <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-0.5 pt-0.5">
                    {hasLedger ? (
                      <span
                        className="pointer-events-none absolute right-0 top-0 z-[2] rounded bg-green-accent/15 px-1 text-[0.625rem] font-semibold tabular-nums text-green-accent md:text-[0.6875rem]"
                        title="이 날 장부 거래 수"
                      >
                        {txCount}
                      </span>
                    ) : null}
                    {hasCellTicker ? (
                      <MarqueeTickerRows
                        rows={cellTickerRows}
                        staggerKeyPrefix={iso}
                        className={[
                          'w-full shrink-0',
                          !inMonth ? 'opacity-80' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      />
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
              onGoToMemoEdit={() => {
                const iso = peekIso
                setPeekIso(null)
                if (!iso) return
                const [y, mo] = iso.split('-').map(Number)
                setCursorY(y)
                setCursorM(mo - 1)
                setSelectedIso(iso)
                scrollDetailIntoView()
              }}
              onGoToLedger={() => {
                const iso = peekIso
                setPeekIso(null)
                if (!iso) return
                nav(`/?ledgerDay=${encodeURIComponent(iso)}`)
              }}
              onToggleEventImportant={patchPeekDayEventImportant}
            />,
            document.body,
          )
        : null}
    </main>
  )
}
