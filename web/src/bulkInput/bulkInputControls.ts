/** 입력 칸 공통 컨트롤 높이·스타일 */
export const BULK_INPUT_CONTROL =
  'h-9 min-h-9 rounded-lg border border-input-border bg-surface-raised text-sm outline-none focus:border-green-accent'

export const BULK_INPUT_CONTROL_SM =
  `${BULK_INPUT_CONTROL} w-full min-w-0 px-2 text-center font-sans text-[0.8125rem]`

const BULK_SELECT_CHEVRON =
  "bg-[image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%23006241%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m3%205%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')]"

/** 네이티브 select — 선택값·옵션 가운데 정렬 */
export const BULK_SELECT =
  `${BULK_INPUT_CONTROL_SM} appearance-none bg-[length:0.5rem] bg-[position:right_0.4rem_center] bg-no-repeat pr-7 [text-align-last:center] ${BULK_SELECT_CHEVRON}`

/** 연·월 선택 바 — 표 입력 칸과 동일 높이 */
export const BULK_PERIOD_SELECT =
  `${BULK_INPUT_CONTROL} min-w-[5.25rem] shrink-0 appearance-none bg-[length:0.5rem] bg-[position:right_0.5rem_center] bg-no-repeat pl-3 pr-8 text-center font-sans text-sm font-semibold text-starbucks-green [text-align-last:center] ${BULK_SELECT_CHEVRON}`

export const BULK_CELL_CENTER = 'text-center'

/** 입력·저장 액션 — 가로 텍스트, 테마 그린 아웃라인 */
export const BULK_ACTION_BTN =
  'inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-green-accent/55 bg-green-light/70 px-4 text-xs font-medium text-starbucks-green outline-none transition-colors hover:border-green-accent hover:bg-green-light focus-visible:ring-2 focus-visible:ring-green-accent/35'

export const BULK_ACTION_BTN_PRIMARY =
  'inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-green-accent bg-green-accent px-4 text-xs font-medium text-on-accent outline-none transition-colors hover:bg-starbucks-green focus-visible:ring-2 focus-visible:ring-green-accent/35'

export const BULK_PICKER_TRIGGER =
  'h-9 min-h-9 w-full truncate rounded-lg border border-input-border bg-surface-raised text-left text-sm outline-none focus:border-green-accent'
