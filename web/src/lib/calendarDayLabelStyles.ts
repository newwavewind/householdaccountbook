import type { CalendarLabelKind } from './calendarLabelTypes'

/** 달력 칸·모달용 라벨 텍스트 색 */
export function calendarLabelTextClass(kind: CalendarLabelKind): string {
  switch (kind) {
    case 'public':
    case 'substitute':
      return 'text-red-500'
    case 'election':
      return 'text-blue-700'
    case 'observance':
      return 'text-amber-800'
    case 'solar':
      return 'text-text-soft'
    default:
      return 'text-text-primary'
  }
}

/** 모달·툴팁 등 보조 문구 */
export function calendarLabelMutedClass(kind: CalendarLabelKind): string {
  switch (kind) {
    case 'public':
    case 'substitute':
      return 'font-medium text-red-500'
    case 'election':
      return 'font-medium text-blue-700'
    case 'observance':
      return 'font-medium text-amber-800'
    case 'solar':
      return 'text-text-soft'
    default:
      return 'text-text-soft'
  }
}
