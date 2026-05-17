import { useEffect, useMemo, useRef, useState } from 'react'
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

const basisBtn = (active: boolean) =>
  [
    'min-h-[3.25rem] flex-1 rounded-xl border-2 px-3 py-2.5 text-left text-sm transition-colors md:min-h-0 md:py-3',
    active
      ? 'border-green-accent bg-green-light/40 text-starbucks-green shadow-sm'
      : 'border-black/[0.1] bg-white text-[rgba(0,0,0,0.75)] hover:border-green-accent/50',
  ].join(' ')

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
  /** 가족 생일·기념일 — 음력 (예: 5월 27일) */
  const [annualLunarMonth, setAnnualLunarMonth] = useState(5)
  const [annualLunarDay, setAnnualLunarDay] = useState(27)
  const [annualLunarLeap, setAnnualLunarLeap] = useState(false)

  const [babyBasis, setBabyBasis] = useState<'solar' | 'lunar'>('solar')
  const [birthLunarYear, setBirthLunarYear] = useState(2020)
  const [babyLunarMonth, setBabyLunarMonth] = useState(1)
  const [babyLunarDay, setBabyLunarDay] = useState(1)
  const [babyLunarLeap, setBabyLunarLeap] = useState(false)

  const prevKindRef = useRef<DdayKind>(kind)
  useEffect(() => {
    const prev = prevKindRef.current
    const wasAnnual = prev === 'birthday' || prev === 'couple'
    const isAnnual = kind === 'birthday' || kind === 'couple'
    if (isAnnual && !wasAnnual) {
      setAnnualBasis('solar')
    }
    const wasBaby = prev === 'baby'
    const isBaby = kind === 'baby'
    if (isBaby && !wasBaby) {
      setBabyBasis('solar')
    }
    prevKindRef.current = kind
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
          lunarMonth: annualLunarMonth,
          lunarDay: annualLunarDay,
          lunarLeap: annualLunarLeap,
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
          babyLunarMonth,
          babyLunarDay,
          babyLunarLeap,
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
          lunarMonth: babyLunarMonth,
          lunarDay: babyLunarDay,
          lunarLeap: babyLunarLeap,
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
  const showAnnualLunarFields = showAnnualControls && annualBasis === 'lunar'
  const showBabyLunarFields = showBabyControls && babyBasis === 'lunar'
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
          ? '아래에서 음력 출생 연도·월·일을 입력하세요'
          : '출생일 (양력)'
        : annualBasis === 'lunar'
          ? '아래에서 음력 월·일을 입력하세요'
          : '기념일 (양력 달력)'

  const eventSubtitle = (e: DdayEvent): string => {
    const base = DDAY_KIND_LABEL[e.kind]
    if (e.kind === 'birthday' || e.kind === 'couple') {
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
        <div className="mt-4 space-y-4">
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

          <label className="block text-sm font-medium text-text-soft">
            이름
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 아버지, 엄마, 결혼기념일"
              maxLength={80}
            />
          </label>

          {showAnnualControls ? (
            <fieldset className="space-y-2 rounded-xl border border-black/[0.08] bg-ceramic/50 p-3 md:p-4">
              <legend className="px-1 text-sm font-semibold text-[rgba(0,0,0,0.87)]">
                기념일 · 생일 — 양력 vs 음력
              </legend>
              <p className="text-xs leading-relaxed text-text-soft md:text-sm">
                부모 <strong className="text-[rgba(0,0,0,0.78)]">음력 생신</strong>
                이면 반드시{' '}
                <strong className="text-starbucks-green">음력</strong>을 누른 뒤 음력
                월·일을 넣으세요. 양력이면 달력에서 날짜만 고르면 됩니다.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className={basisBtn(annualBasis === 'solar')}
                  onClick={() => setAnnualBasis('solar')}
                >
                  <span className="block font-semibold">양력</span>
                  <span className="mt-0.5 block text-xs font-normal text-text-soft">
                    매년 같은 양력 날짜 (아래 달력)
                  </span>
                </button>
                <button
                  type="button"
                  className={basisBtn(annualBasis === 'lunar')}
                  onClick={() => setAnnualBasis('lunar')}
                >
                  <span className="block font-semibold">음력</span>
                  <span className="mt-0.5 block text-xs font-normal text-text-soft">
                    매년 음력 생신·음력 기념일 (월·일 직접 입력)
                  </span>
                </button>
              </div>
            </fieldset>
          ) : null}

          {showBabyControls ? (
            <fieldset className="space-y-2 rounded-xl border border-black/[0.08] bg-ceramic/50 p-3 md:p-4">
              <legend className="px-1 text-sm font-semibold text-[rgba(0,0,0,0.87)]">
                출생일 — 양력 vs 음력
              </legend>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className={basisBtn(babyBasis === 'solar')}
                  onClick={() => setBabyBasis('solar')}
                >
                  <span className="block font-semibold">양력 출생</span>
                  <span className="mt-0.5 block text-xs font-normal text-text-soft">
                    출생증·닥터가 알려준 양력 날짜
                  </span>
                </button>
                <button
                  type="button"
                  className={basisBtn(babyBasis === 'lunar')}
                  onClick={() => setBabyBasis('lunar')}
                >
                  <span className="block font-semibold">음력 출생</span>
                  <span className="mt-0.5 block text-xs font-normal text-text-soft">
                    출생 연도 + 음력 월·일
                  </span>
                </button>
              </div>
            </fieldset>
          ) : null}

          {showAnnualLunarFields ? (
            <div className="rounded-xl border border-dashed border-green-accent/40 bg-green-light/20 p-3 md:p-4">
              <p className="text-sm font-medium text-starbucks-green">
                음력 기념일 입력
              </p>
              <p className="mt-1 text-xs text-text-soft">
                예: 아버지 생신 음력 5월 27일 → 월 <strong>5</strong>, 일{' '}
                <strong>27</strong>, 윤달이면 체크
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-sm font-medium text-text-soft">
                  음력 월
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="mt-1 block w-24 rounded-lg border border-black/[0.12] bg-white px-2 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
                    value={annualLunarMonth}
                    onChange={(e) => setAnnualLunarMonth(Number(e.target.value))}
                  />
                </label>
                <label className="text-sm font-medium text-text-soft">
                  음력 일
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="mt-1 block w-24 rounded-lg border border-black/[0.12] bg-white px-2 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
                    value={annualLunarDay}
                    onChange={(e) => setAnnualLunarDay(Number(e.target.value))}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-text-soft">
                  <input
                    type="checkbox"
                    checked={annualLunarLeap}
                    onChange={(e) => setAnnualLunarLeap(e.target.checked)}
                  />
                  윤달
                </label>
              </div>
            </div>
          ) : null}

          {showBabyLunarFields ? (
            <>
              <label className="block text-sm font-medium text-text-soft">
                음력 출생 연도 (천간·달 기준 해)
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  className="mt-1 w-full max-w-[12rem] rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
                  value={birthLunarYear}
                  onChange={(e) => setBirthLunarYear(Number(e.target.value))}
                />
              </label>
              <div className="rounded-xl border border-dashed border-green-accent/40 bg-green-light/20 p-3 md:p-4">
                <p className="text-sm font-medium text-starbucks-green">
                  음력 생일
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-sm font-medium text-text-soft">
                    월
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="mt-1 block w-24 rounded-lg border border-black/[0.12] bg-white px-2 py-2 text-base"
                      value={babyLunarMonth}
                      onChange={(e) => setBabyLunarMonth(Number(e.target.value))}
                    />
                  </label>
                  <label className="text-sm font-medium text-text-soft">
                    일
                    <input
                      type="number"
                      min={1}
                      max={30}
                      className="mt-1 block w-24 rounded-lg border border-black/[0.12] bg-white px-2 py-2 text-base"
                      value={babyLunarDay}
                      onChange={(e) => setBabyLunarDay(Number(e.target.value))}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-text-soft">
                    <input
                      type="checkbox"
                      checked={babyLunarLeap}
                      onChange={(e) => setBabyLunarLeap(e.target.checked)}
                    />
                    윤달
                  </label>
                </div>
              </div>
            </>
          ) : null}

          {showSolarDateOnly ? (
            <label className="block text-sm font-medium text-text-soft">
              {dateLabel}
              <input
                type="date"
                className="mt-1 w-full max-w-[14rem] rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-base text-[rgba(0,0,0,0.87)] outline-none ring-green-accent/30 focus:ring-2"
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
