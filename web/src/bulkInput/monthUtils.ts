export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function monthLabel(monthIndex: number): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long' }).format(
    new Date(2000, monthIndex),
  )
}
