/** 입력 탭 월별 요약 트윈 스트립 — 헤더 행과 각 월 줄이 같은 비율·정렬을 쓰도록 공통 클래스 */

export const BULK_MONTH_SUMMARY_TWIN_SHELL =
  'flex min-w-0 w-full overflow-hidden rounded-lg border border-black/[0.12] bg-[rgba(0,0,0,0.02)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]'

export const BULK_MONTH_SUMMARY_HALF =
  'flex min-w-0 flex-[1_1_0%] flex-col justify-center px-3 py-2 sm:px-4 sm:py-2.5'

export const BULK_MONTH_SUMMARY_GRID =
  'grid w-full min-w-0 grid-cols-2 gap-x-3 sm:gap-x-4'

export const BULK_MONTH_SUMMARY_LABEL =
  'min-w-0 text-center text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-text-soft tabular-nums leading-none'

export const BULK_MONTH_SUMMARY_AMT_L =
  'min-w-0 text-center text-[0.8125rem] font-semibold tabular-nums leading-tight text-[rgba(0,0,0,0.82)]'

export const BULK_MONTH_SUMMARY_AMT_R =
  'min-w-0 text-center text-[0.8125rem] font-semibold tabular-nums leading-tight text-[rgba(0,0,0,0.72)]'

export const BULK_MONTH_SUMMARY_AMT_R_MUTED =
  'min-w-0 text-center text-[0.8125rem] font-semibold tabular-nums leading-tight text-text-soft opacity-45'

/** 헤더 줄 좌우 맞춤용(폭만). 월 줄의 월 이름·펼치기 영역과 동일 */
export const BULK_MONTH_SUMMARY_GUTTER = 'hidden shrink-0 sm:block sm:w-14'

/** 월 요약 줄 왼쪽 "4월" 등 */
export const BULK_MONTH_SUMMARY_MONTH_TITLE =
  'shrink-0 font-semibold tabular-nums text-starbucks-green sm:flex sm:h-full sm:w-14 sm:items-center sm:justify-center sm:text-[0.9375rem]'

/** 월 요약 줄 오른쪽 "펼치기" */
export const BULK_MONTH_SUMMARY_EXPAND =
  'shrink-0 text-center text-xs font-normal text-text-soft group-open:hidden sm:flex sm:h-full sm:w-14 sm:items-center sm:justify-center'
