/** 하단 탭 아이콘+라벨 행 (카카오톡 탭 높이에 맞춤) */
export const MOBILE_TAB_ROW_REM = 3.5
/** 탭 행 위 여백 */
export const MOBILE_TAB_PAD_TOP_REM = 0.375
/** 홈 인디케이터 위 추가 여백 (터치하기 쉽게) */
export const MOBILE_TAB_PAD_BOTTOM_MIN_REM = 0.75

/** 본문·FAB이 탭에 가리지 않도록 하는 하단 패딩 */
export const MOBILE_TAB_BAR_BOTTOM_OFFSET = `calc(${MOBILE_TAB_ROW_REM}rem + ${MOBILE_TAB_PAD_TOP_REM}rem + max(${MOBILE_TAB_PAD_BOTTOM_MIN_REM}rem, env(safe-area-inset-bottom, 0px)))`

export const MOBILE_FAB_BOTTOM_OFFSET = `calc(${MOBILE_TAB_ROW_REM}rem + ${MOBILE_TAB_PAD_TOP_REM}rem + max(${MOBILE_TAB_PAD_BOTTOM_MIN_REM}rem, env(safe-area-inset-bottom, 0px)) + 1rem)`
