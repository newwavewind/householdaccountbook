/** 하단 탭 바 콘텐츠 높이 (safe-area 제외) */
export const MOBILE_TAB_BAR_HEIGHT_REM = 3.25

export const MOBILE_TAB_BAR_BOTTOM_OFFSET = `calc(${MOBILE_TAB_BAR_HEIGHT_REM}rem + env(safe-area-inset-bottom, 0px))`

export const MOBILE_FAB_BOTTOM = `calc(${MOBILE_TAB_BAR_HEIGHT_REM}rem + 1rem + env(safe-area-inset-bottom, 0px))`
