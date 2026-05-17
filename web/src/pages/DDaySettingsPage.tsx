import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { buildDdaySummaryLines } from '../dday/ddayCompute'
import { formatLunarMd, solarIsoFromLunarBirth } from '../dday/ddayLunar'
import { newDdayId } from '../dday/ddayStorage'
import {
  DDAY_KIND_LABEL,
  type DdayEvent,
  type DdayKind,
} from '../dday/ddayTypes'
import { useHouseholdDDays } from '../dday/useHouseholdDDays'

const KIND_OPTIONS: DdayKind[] = [
  'birthday',
  'couple',
  'baby',
  'exam',
  'custom',
]

export default function DDaySettingsPage() {
  const nav = useNavigate()
  const { events, patchEvents, cloudStatus, cloudMessage, cloudEnabled } =
    useHouseholdDDays()

  const [kind, setKind] = useState<DdayKind>('exam')
  const [title, setTitle] = useState('')

  const [dateInput, setDateInput] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const [annualBasis, setAnnualBasis] = useState<'solar' | 'lunar'>('solar')
  const [lunarMonth, setLunarMonth] = useState(1)
  const [lunarDay, setLunarDay] = useState(1)
  const [lunarLeap, setLunarLeap] = useState(false)

  const [babyBasis, setBabyBasis] = useState<'solar' | 'lunar'>('solar')
  const [birthLunarYear, setBirthLunarYear] = useState(2020)

  useEffect(() => {
    if (kind === 'birthday' || kind === 'couple') {
      setAnnualBasis('solar')
    }
  }, [kind])

  const linesById = useMemo(() => {
    const m = new Map<string, string>()
    for (const line of buildDdaySummaryLines(events)) {
      m.set(line.id, line.text)
    }
    return m
  }, [events])

  const addEvent = () => {
    const t = title.trim()
    if (!t) return

    const updatedAt = new Date().toISOString()
    let ev: DdayEvent

    if (kind === 'birthday' || kind === 'couple') {
      if (annualBasis === 'lunar') {
        ev = {
          id: newDdayId(),
          title: t,
          kind,
          dateBasis: 'lunar',
          lunarMonth,
          lunarDay,
          lunarLeap,
          updatedAt,
        }
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return
        const [, mm, dd] = dateInput.split('-').map(Number)
        ev = {
          id: newDdayId(),
          title: t,
          kind,
          dateBasis: 'solar',
          month: mm,
          day: dd,
          updatedAt,
        }
      }
    } else if (kind === 'baby') {
      if (babyBasis === 'lunar') {
        const birthDate = solarIsoFromLunarBirth(
          birthLunarYear,
          lunarMonth,
          lunarDay,
          lunarLeap,
        )
        if (!birthDate) {
          alert('음력 날짜를 확인해 주세요. (해당 연·월·일에 윤달이 없을 수 있어요)')
          return
        }
        ev = {
          id: newDdayId(),
          title: t,
          kind: 'baby',
          birthBasis: 'lunar',
          birthDate,
          birthLunarYear,
          lunarMonth,
          lunarDay,
          lunarLeap,
          updatedAt,
        }
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return
        ev = {
          id: newDdayId(),
          title: t,
          kind: 'baby',
          birthBasis: 'solar',
          birthDate: dateInput,
          updatedAt,
        }
      }
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return
      ev = {
        id: newDdayId(),
        title: t,
        kind,
        targetDate: dateInput,
        updatedAt,
      }
    }

    patchEvents((prev) => [...prev, ev])
    setTitle('')
  }

  const remove = (id: string) => {
    if (!confirm('이 디데이를 삭제할까요?')) return
    patchEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const showAnnualControls = kind === 'birthday' || kind === 'couple'
  const showBabyControls = kind === 'baby'
  const showLunarControls =
    (showAnnualControls && annualBasis === 'lunar') ||
    (showBabyControls && babyBasis === 'lunar')
  const showSolarDateOnly =
    (showAnnualControls && annualBasis === 'solar') ||
    (showBabyControls && babyBasis === 'solar') ||
    kind === 'exam' ||
    kind === 'custom'

  const dateLabel =
    kind === 'exam' || kind === 'custom'
      ? '목표일'
      : kind === 'baby'
        ? babyBasis === 'lunar'
          ? '출생 연도·음력 (아래)'
          : '출생일 (양력)'
        : annualBasis === 'lunar'
          ? '음력 월·일 (아래)'
          : '기념일 (양력, 매년)'

  const eventSubtitle = (e: DdayEvent): string => {
    const base = DDAY_KIND_LABEL[e.kind]
    if (
      e.kind === 'birthday' ||
      e.kind === 'couple'
    ) {
      if (e.dateBasis === 'lunar') {
        return `${base} · 음력 ${formatLunarMd(e.lunarMonth, e.lunarDay, e.lunarLeap)}`
      }
      return `${base} · 양력 ${e.month}.${e.day}`
    }
    if (e.kind === 'baby' && e.birthBasis === 'lunar') {
      return `${base} · 음력 ${e.birthLunarYear}.${formatLunarMd(e.lunarMonth, e.lunarDay, e.lunarLeap)}`
    }
    return base
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-starbucks-green md:text-3xl">
            디데이 설정
          </h1>
          <p className="mt-2 text-sm text-text-soft">
            생일·아기 개월수·기념일·시험일 등을 등록하면 일정 달력과 요약에
            함께 표시돼요.
            {cloudEnabled
              ? ' 같은 가구와 동기화됩니다.'
              : ' 이 브라우저에 저장됩니다.'}
          </p>
        </div>
        <Button
          type="button"
          variant="outlined"
          className="shrink-0"
          onClick={() => nav('/calendar')}
        >
          달력으로
        </Button>
      </div>

      {cloudStatus === 'error' && cloudMessage ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-danger">
          동기화 오류: {cloudMessage}
        </p>
      ) : null}
      {cloudStatus === 'loading' ? (
        <p className="mb-4 text-sm text-text-soft">불러오는 중…</p>
      ) : null}

      <Card className="mb-6 p-4 md:p-5">
        <h2 className="text-base font-semibold text-[rgba(0,0,0,0.87)]">
          새로 추가
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-text-soft">
            종류
            <select
              className="mt-1 w-full rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2 md:max-w-md"
              value={kind}
              onChange={(e) => setKind(e.target.value as DdayKind)}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {DDAY_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>

          {showAnnualControls ? (
            <div className="flex flex-wrap gap-3 text-sm font-medium text-text-soft">
              <span>양·음력</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="annualBasis"
                  checked={annualBasis === 'solar'}
                  onChange={() => setAnnualBasis('solar')}
                />
                양력 (매년 같은 날짜)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="annualBasis"
                  checked={annualBasis === 'lunar'}
                  onChange={() => setAnnualBasis('lunar')}
                />
                음력 (생신·음력 기념일)
              </label>
            </div>
          ) : null}

          {showBabyControls ? (
            <div className="flex flex-wrap gap-3 text-sm font-medium text-text-soft">
              <span>출생일</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="babyBasis"
                  checked={babyBasis === 'solar'}
                  onChange={() => setBabyBasis('solar')}
                />
                양력
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="babyBasis"
                  checked={babyBasis === 'lunar'}
                  onChange={() => setBabyBasis('lunar')}
                />
                음력
              </label>
            </div>
          ) : null}

          <label className="block text-sm font-medium text-text-soft">
            이름
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 엄마, 결혼기념일, 2026 수능"
              maxLength={80}
            />
          </label>

          {showBabyControls && babyBasis === 'lunar' ? (
            <label className="block text-sm font-medium text-text-soft">
              음력 출생 연도
              <input
                type="number"
                min={1900}
                max={2100}
                className="mt-1 w-full max-w-[10rem] rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
                value={birthLunarYear}
                onChange={(e) => setBirthLunarYear(Number(e.target.value))}
              />
            </label>
          ) : null}

          {showLunarControls ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-text-soft">
                음력 월
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="mt-1 block w-20 rounded-lg border border-black/[0.12] bg-white px-2 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
                  value={lunarMonth}
                  onChange={(e) => setLunarMonth(Number(e.target.value))}
                />
              </label>
              <label className="text-sm font-medium text-text-soft">
                음력 일
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="mt-1 block w-20 rounded-lg border border-black/[0.12] bg-white px-2 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
                  value={lunarDay}
                  onChange={(e) => setLunarDay(Number(e.target.value))}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-text-soft">
                <input
                  type="checkbox"
                  checked={lunarLeap}
                  onChange={(e) => setLunarLeap(e.target.checked)}
                />
                윤달
              </label>
            </div>
          ) : null}

          {showSolarDateOnly ? (
            <label className="block text-sm font-medium text-text-soft">
              {dateLabel}
              <input
                type="date"
                className="mt-1 w-full max-w-[12rem] rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </label>
          ) : null}

          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-auto"
            onClick={addEvent}
          >
            등록
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-5">
        <h2 className="text-base font-semibold text-[rgba(0,0,0,0.87)]">
          등록된 디데이 ({events.length})
        </h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-text-soft">
            아직 없어요. 위에서 추가해 보세요.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.06]">
            {[...events]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[rgba(0,0,0,0.87)]">
                      {e.title}
                    </p>
                    <p className="text-xs text-text-soft">{eventSubtitle(e)}</p>
                    <p className="mt-1 text-sm text-starbucks-green">
                      {linesById.get(e.id) ?? '—'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="darkOutlined"
                    className="!border-danger !text-danger shrink-0"
                    onClick={() => remove(e.id)}
                  >
                    삭제
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </main>
  )
}
