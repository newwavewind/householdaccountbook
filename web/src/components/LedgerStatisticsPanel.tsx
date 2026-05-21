import { useMemo } from 'react'
import { CategoryLabel } from './CategoryLabel'
import {
  buildLedgerMonthStats,
  segmentPercents,
  type CardBrandStatRow,
  type LedgerStatSegment,
} from '../lib/ledgerStatistics'
import type { Transaction } from '../types/transaction'

const DONUT_R = 38
const DONUT_STROKE = 14
const DONUT_C = 2 * Math.PI * DONUT_R

/** 막대 높이(px). % height는 flex 자식에서 0으로 붕괴되어 픽셀 사용 */
const DAILY_CHART_H_PX = 128
const WEEKDAY_CHART_H_PX = 96

function barHeightPx(
  amount: number,
  max: number,
  chartHeight: number,
  emptyPx = 3,
): number {
  if (amount <= 0) return emptyPx
  return Math.max(6, Math.round((amount / max) * chartHeight))
}

function DonutChart({
  segments,
  centerLabel,
  centerSub,
  size = 168,
}: {
  segments: LedgerStatSegment[]
  centerLabel?: string
  centerSub?: string
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-ceramic/30 text-sm text-text-soft"
        style={{ width: size, height: size }}
      >
        데이터 없음
      </div>
    )
  }

  let offset = 0
  const arcs = segments.map((seg) => {
    const pct = seg.value / total
    const dash = pct * DONUT_C
    const gap = DONUT_C - dash
    const el = (
      <circle
        key={seg.id}
        cx="50"
        cy="50"
        r={DONUT_R}
        fill="none"
        stroke={seg.color}
        strokeWidth={DONUT_STROKE}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        transform="rotate(-90 50 50)"
        className="transition-all duration-500"
      />
    )
    offset += dash
    return el
  })

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        role="img"
        aria-hidden={!centerLabel}
      >
        <circle
          cx="50"
          cy="50"
          r={DONUT_R}
          fill="none"
          stroke="currentColor"
          strokeWidth={DONUT_STROKE}
          className="text-ceramic"
        />
        {arcs}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel ? (
            <span className="max-w-[5.5rem] truncate text-[0.65rem] font-semibold leading-tight text-text-primary">
              {centerLabel}
            </span>
          ) : null}
          {centerSub ? (
            <span className="mt-0.5 text-[0.55rem] text-text-soft">{centerSub}</span>
          ) : null}
        </div>
      )}
    </div>
  )
}

function SegmentLegend({
  rows,
  fmtKrw,
}: {
  rows: { segment: LedgerStatSegment; pct: number }[]
  fmtKrw: Intl.NumberFormat
}) {
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-2">
      {rows.map(({ segment, pct }) => (
        <li key={segment.id} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: segment.color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-text-primary">
                {segment.label}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-text-soft">
                {pct}%
              </span>
            </div>
            <p className="text-xs tabular-nums text-text-soft">
              {fmtKrw.format(segment.value)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function DailyExpenseBars({
  dailyExpense,
  daysInMonth,
  peakDay,
  fmtKrw,
}: {
  dailyExpense: number[]
  daysInMonth: number
  peakDay: { day: number; amount: number } | null
  fmtKrw: Intl.NumberFormat
}) {
  const max = Math.max(...dailyExpense, 1)
  const hasAny = dailyExpense.some((v) => v > 0)
  if (!hasAny) {
    return (
      <p className="py-8 text-center text-sm text-text-soft">
        이번 달 지출이 없어 일별 추이를 표시할 수 없습니다.
      </p>
    )
  }

  return (
    <div>
      <div
        className="flex items-end gap-px sm:gap-0.5"
        style={{ height: DAILY_CHART_H_PX }}
        role="img"
        aria-label="일별 지출 막대 그래프"
      >
        {dailyExpense.map((amt, i) => {
          const day = i + 1
          const barPx = barHeightPx(amt, max, DAILY_CHART_H_PX)
          const isPeak = peakDay?.day === day && amt > 0
          return (
            <div
              key={day}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
              title={
                amt > 0
                  ? `${day}일 ${fmtKrw.format(amt)}`
                  : `${day}일`
              }
            >
              <div
                className={`mx-auto w-full min-w-[2px] max-w-[10px] rounded-t transition-all duration-300 sm:max-w-none ${
                  amt > 0
                    ? isPeak
                      ? 'bg-rose-600'
                      : 'bg-rose-400/85 group-hover:bg-rose-500'
                    : 'bg-border-subtle/60'
                }`}
                style={{ height: barPx }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6rem] font-medium text-text-soft tabular-nums">
        <span>1일</span>
        <span>{daysInMonth}일</span>
      </div>
      {peakDay ? (
        <p className="mt-2 text-center text-xs text-text-soft">
          최다 지출{' '}
          <span className="font-semibold text-semantic-expense">
            {peakDay.day}일
          </span>{' '}
          <span className="tabular-nums">{fmtKrw.format(peakDay.amount)}</span>
        </p>
      ) : null}
    </div>
  )
}

function WeekdayBars({
  amounts,
  labels,
  fmtKrw,
  chartHeight = WEEKDAY_CHART_H_PX,
}: {
  amounts: number[]
  labels: string[]
  fmtKrw: Intl.NumberFormat
  chartHeight?: number
}) {
  const max = Math.max(...amounts, 1)
  const hasAny = amounts.some((v) => v > 0)
  if (!hasAny) {
    return (
      <p className="py-6 text-center text-sm text-text-soft">요일별 데이터 없음</p>
    )
  }

  return (
    <div
      className="grid grid-cols-7 gap-1.5"
      role="img"
      aria-label="요일별 지출"
    >
      {amounts.map((amt, i) => {
        const barPx = barHeightPx(amt, max, chartHeight, 4)
        const isSun = i === 0
        return (
          <div key={labels[i]} className="flex flex-col items-center gap-1">
            <div
              className="flex w-full items-end justify-center"
              style={{ height: chartHeight }}
            >
              <div
                className={`w-full max-w-[2rem] rounded-t transition-all ${
                  amt > 0
                    ? isSun
                      ? 'bg-rose-500/90'
                      : 'bg-starbucks-green/75'
                    : 'bg-ceramic'
                }`}
                style={{ height: barPx }}
                title={amt > 0 ? `${labels[i]} ${fmtKrw.format(amt)}` : labels[i]}
              />
            </div>
            <span
              className={`text-[0.65rem] font-semibold ${
                isSun ? 'text-rose-700/80' : 'text-text-soft'
              }`}
            >
              {labels[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CardBrandBreakdown({
  rows,
  cardTotal,
  fmtKrw,
}: {
  rows: CardBrandStatRow[]
  cardTotal: number
  fmtKrw: Intl.NumberFormat
}) {
  if (rows.length === 0) return null

  const max = rows[0]?.amount ?? 1

  return (
    <div className="space-y-3">
      <div
        className="flex h-3 overflow-hidden rounded-full bg-ceramic"
        role="img"
        aria-label="카드사별 지출 비율 막대"
      >
        {rows.map((row) => (
          <div
            key={row.id}
            className="h-full min-w-[2px] transition-all duration-500"
            style={{
              width: `${row.pct}%`,
              backgroundColor: row.color,
            }}
            title={`${row.label} ${row.pct}%`}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const w = (row.amount / max) * 100
          return (
            <li key={row.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium text-text-primary">
                    {row.label}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-text-soft">
                  {row.pct}%
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ceramic">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${w}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-semantic-expense">
                  {fmtKrw.format(row.amount)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-center text-[0.65rem] text-text-soft">
        카드 지출 합계{' '}
        <span className="font-semibold tabular-nums text-text-secondary">
          {fmtKrw.format(cardTotal)}
        </span>
      </p>
    </div>
  )
}

function NetGauge({ net, income, expense }: { net: number; income: number; expense: number }) {
  const scale = Math.max(income, expense, 1)
  const incomeW = (income / scale) * 100
  const expenseW = (expense / scale) * 100
  const positive = net >= 0

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-ceramic">
        <div
          className="h-full bg-semantic-income/80 transition-all duration-500"
          style={{ width: `${incomeW}%` }}
        />
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-ceramic">
        <div
          className="h-full bg-semantic-expense/75 transition-all duration-500"
          style={{ width: `${expenseW}%` }}
        />
      </div>
      <p
        className={`text-center text-lg font-bold tabular-nums ${
          positive ? 'text-semantic-income' : 'text-semantic-expense'
        }`}
      >
        {positive ? '+' : '−'}
        {Math.abs(net).toLocaleString('ko-KR')}원
        <span className="ml-1.5 text-xs font-medium text-text-soft">순액</span>
      </p>
    </div>
  )
}

export interface LedgerStatisticsPanelProps {
  transactions: Transaction[]
  year: number
  monthIndex: number
  fmtKrw: Intl.NumberFormat
}

export function LedgerStatisticsPanel({
  transactions,
  year,
  monthIndex,
  fmtKrw,
}: LedgerStatisticsPanelProps) {
  const stats = useMemo(
    () => buildLedgerMonthStats(transactions, year, monthIndex),
    [transactions, year, monthIndex],
  )

  const flowLegend = useMemo(
    () => segmentPercents(stats.flowSegments),
    [stats.flowSegments],
  )
  const emptyMonth =
    stats.incomeCount === 0 && stats.expenseCount === 0

  if (emptyMonth) {
    return (
      <p className="mt-6 py-12 text-center text-sm text-text-soft">
        {stats.monthLabel} 거래 기록이 없습니다. 통계는 거래가 있을 때 표시됩니다.
      </p>
    )
  }

  return (
    <div className="mt-5 space-y-6">
      <p className="text-xs font-medium uppercase tracking-wider text-text-soft">
        {stats.monthLabel} 통계
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-label="수입과 지출 비율"
          className="rounded-2xl border border-border-subtle/80 bg-surface-raised p-4 shadow-[var(--shadow-frap-base)]"
        >
          <h3 className="text-sm font-semibold text-text-primary">수입 · 지출 비율</h3>
          {stats.flowSegments.length === 0 ? (
            <p className="mt-4 text-sm text-text-soft">표시할 흐름이 없습니다.</p>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <DonutChart
                segments={stats.flowSegments}
                centerLabel={
                  stats.netTotal >= 0 ? '흑자' : '적자'
                }
                centerSub={stats.monthLabel}
              />
              <SegmentLegend rows={flowLegend} fmtKrw={fmtKrw} />
            </div>
          )}
          <div className="mt-4 border-t border-border-subtle/70 pt-4">
            <NetGauge
              net={stats.netTotal}
              income={stats.incomeTotal}
              expense={stats.expenseTotal}
            />
          </div>
        </section>

        <section
          aria-label="결제 수단별 지출"
          className="rounded-2xl border border-border-subtle/80 bg-surface-raised p-4 shadow-[var(--shadow-frap-base)]"
        >
          <h3 className="text-sm font-semibold text-text-primary">결제 수단</h3>
          {stats.cardBrandRows.length > 0 ? (
            <>
              <p className="mt-1 text-xs text-text-soft">
                카드사별 사용량 · 신용·체크카드 결제만 집계
              </p>
              <div className="mt-4">
                <CardBrandBreakdown
                  rows={stats.cardBrandRows}
                  cardTotal={stats.cardExpenseTotal}
                  fmtKrw={fmtKrw}
                />
              </div>
            </>
          ) : stats.paymentSegments.length === 0 ? (
            <p className="mt-4 text-sm text-text-soft">지출 결제 수단 정보가 없습니다.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {segmentPercents(stats.paymentSegments).map(({ segment, pct }) => (
                <li
                  key={segment.id}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="font-medium text-text-primary">
                    {segment.label}
                  </span>
                  <span className="tabular-nums text-text-soft">
                    {pct}% · {fmtKrw.format(segment.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        aria-label="일별 지출 추이"
        className="rounded-2xl border border-border-subtle/80 bg-gradient-to-b from-rose-50/30 to-surface-raised p-4"
      >
        <h3 className="text-sm font-semibold text-text-primary">일별 지출 추이</h3>
        <p className="mt-0.5 text-xs text-text-soft">막대가 높을수록 그날 지출이 큽니다</p>
        <div className="mt-4">
          <DailyExpenseBars
            dailyExpense={stats.dailyExpense}
            daysInMonth={stats.daysInMonth}
            peakDay={stats.peakExpenseDay}
            fmtKrw={fmtKrw}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-label="지출 패턴"
          className="rounded-2xl border border-starbucks-green/15 bg-house-green/[0.04] p-4"
        >
          <h3 className="text-sm font-semibold text-text-primary">지출 패턴</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-starbucks-green/30 bg-gradient-to-br from-house-green/[0.12] via-green-light/50 to-surface-raised px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-starbucks-green/10">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-starbucks-green">
              하루 평균 지출
            </p>
            <p className="mt-1 text-2xl font-bold leading-none tabular-nums tracking-tight text-starbucks-green sm:text-3xl">
              {fmtKrw.format(stats.avgExpensePerDay)}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-starbucks-green/10 px-2 py-0.5 text-[0.65rem] font-semibold text-house-green">
              지출이 있는 날만 나눈 평균
            </p>
          </div>
          {stats.peakExpenseDay ? (
            <p className="mt-1 text-xs text-text-soft">
              이번 달 최다 지출{' '}
              <span className="font-semibold text-semantic-expense">
                {stats.peakExpenseDay.day}일
              </span>{' '}
              <span className="tabular-nums">
                {fmtKrw.format(stats.peakExpenseDay.amount)}
              </span>
            </p>
          ) : null}
          <p className="mt-3 text-xs text-text-soft">요일별 지출</p>
          <div className="mt-2">
            <WeekdayBars
              amounts={stats.weekdayExpense}
              labels={stats.weekdayLabels}
              fmtKrw={fmtKrw}
            />
          </div>
        </section>

        <section
          aria-label="분류 상위 5"
          className="rounded-2xl border border-border-subtle/80 bg-surface-raised p-4"
        >
          <h3 className="text-sm font-semibold text-text-primary">지출 분류 TOP 5</h3>
          {stats.topCategories.length === 0 ? (
            <p className="mt-4 text-sm text-text-soft">분류별 지출이 없습니다.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {stats.topCategories.map((row, i) => {
                const max = stats.topCategories[0]?.amount ?? 1
                const w = (row.amount / max) * 100
                return (
                  <li key={row.name}>
                    <div className="flex items-baseline justify-between gap-2">
                      <CategoryLabel
                        name={row.name}
                        textClassName="text-sm font-medium text-text-primary"
                      />
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-text-soft">
                        {row.pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ceramic">
                        <div
                          className="h-full rounded-full bg-starbucks-green transition-all duration-500"
                          style={{
                            width: `${w}%`,
                            opacity: 1 - i * 0.12,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-semantic-expense">
                        {fmtKrw.format(row.amount)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {stats.memberRows.length > 1 ? (
        <section
          aria-label="구성원별 수입·지출"
          className="rounded-2xl border border-border-subtle/80 bg-surface-raised p-4"
        >
          <h3 className="text-sm font-semibold text-text-primary">구성원별</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {stats.memberRows.map((row) => {
              const max = Math.max(
                ...stats.memberRows.map((r) => r.expense + r.income),
                1,
              )
              const total = row.expense + row.income
              const w = (total / max) * 100
              const expenseShare =
                total > 0 ? Math.round((row.expense / total) * 100) : 0
              return (
                <li key={row.name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {row.name}
                    </span>
                    <span className="text-xs text-text-soft">
                      지출 {fmtKrw.format(row.expense)}
                      {row.income > 0
                        ? ` · 수입 ${fmtKrw.format(row.income)}`
                        : ''}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ceramic">
                    <div
                      className="flex h-full transition-all duration-500"
                      style={{ width: `${w}%` }}
                    >
                      {row.expense > 0 ? (
                        <div
                          className="h-full bg-semantic-expense/80"
                          style={{ width: `${expenseShare}%` }}
                        />
                      ) : null}
                      {row.income > 0 ? (
                        <div
                          className="h-full flex-1 bg-semantic-income/75"
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
