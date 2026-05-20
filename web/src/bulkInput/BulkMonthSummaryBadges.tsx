type Props = {
  income: number
  expense: number
}

function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 연·월 선택 pill과 동일 높이·스타일 */
export function BulkMonthSummaryBadges({ income, expense }: Props) {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0 rounded-xl border border-border-subtle bg-neutral-cool/30 p-1 shadow-sm"
      aria-label="선택한 달 수입·지출 합계"
    >
      <div className="inline-flex h-9 items-center gap-1.5 px-3">
        <span className="font-sans text-xs font-medium text-text-primary/55">
          수입
        </span>
        <span className="font-sans text-sm font-semibold tabular-nums text-text-primary/80">
          {won(income)}
        </span>
      </div>
      <span
        className="mx-0.5 h-6 w-px shrink-0 bg-border-muted/80"
        aria-hidden
      />
      <div className="inline-flex h-9 items-center gap-1.5 px-3">
        <span className="font-sans text-xs font-medium text-text-primary/55">
          지출
        </span>
        <span className="font-sans text-sm font-semibold tabular-nums text-text-primary/80">
          {won(expense)}
        </span>
      </div>
    </div>
  )
}
