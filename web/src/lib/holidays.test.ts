import { describe, expect, it } from 'vitest'
import { getCalendarDayLabels } from './holidays'

describe('getCalendarDayLabels', () => {
  it('shows 어린이날 as public holiday', () => {
    const l = getCalendarDayLabels('2026-05-05')
    expect(l?.text).toContain('어린이날')
    expect(l?.primaryKind).toBe('public')
  })

  it('shows substitute holiday when Buddha birthday is Sunday (2026-05-25)', () => {
    const l = getCalendarDayLabels('2026-05-25')
    expect(l?.text).toContain('대체공휴일')
    expect(l?.text).toContain('부처님')
    expect(l?.primaryKind).toBe('substitute')
  })

  it('shows 어버이날 as observance', () => {
    const l = getCalendarDayLabels('2026-05-08')
    expect(l?.text).toContain('어버이날')
    expect(l?.primaryKind).toBe('observance')
  })

  it('shows 노동절 and 근로자의 날 on 2026-05-01', () => {
    const l = getCalendarDayLabels('2026-05-01')
    expect(l?.text).toContain('노동절')
    expect(l?.text).toContain('근로자의 날')
  })

  it('shows 입춘 as solar term', () => {
    const l = getCalendarDayLabels('2026-02-04')
    expect(l?.text).toContain('입춘')
    expect(l?.primaryKind).toBe('solar')
  })

  it('shows 단오 on 2026-06-19 (lunar 5/5)', () => {
    const l = getCalendarDayLabels('2026-06-19')
    expect(l?.text).toContain('단오')
    expect(l?.primaryKind).toBe('observance')
  })

  it('shows 2026 local election from official gazette data', () => {
    const l = getCalendarDayLabels('2026-06-03')
    expect(l?.text).toContain('전국동시지방선거')
    expect(l?.primaryKind).toBe('election')
  })

  it('returns undefined for invalid date', () => {
    expect(getCalendarDayLabels('not-a-date')).toBeUndefined()
  })

  it('shows 추석 연휴 three days in 2026 (official dates)', () => {
    expect(getCalendarDayLabels('2026-09-24')?.text).toContain('추석')
    expect(getCalendarDayLabels('2026-09-25')?.text).toContain('추석')
    expect(getCalendarDayLabels('2026-09-26')?.text).toContain('추석')
    expect(getCalendarDayLabels('2026-09-23')?.text ?? '').not.toContain('추석')
  })

  it('shows 삼복 (초복·중복·말복) in 2026', () => {
    expect(getCalendarDayLabels('2026-07-15')?.text).toContain('초복')
    expect(getCalendarDayLabels('2026-07-25')?.text).toContain('중복')
    const mal = getCalendarDayLabels('2026-08-14')
    expect(mal?.text).toContain('말복')
    expect(mal?.primaryKind).toBe('observance')
  })

  it('shows 2027 public holidays from provisional map until gazette JSON ships', () => {
    const l = getCalendarDayLabels('2027-02-09')
    expect(l?.text).toContain('대체공휴일')
    expect(l?.primaryKind).toBe('substitute')
    expect(getCalendarDayLabels('2027-09-15')?.text).toContain('추석')
  })

  it('shows 설날 연휴 three days in 2026', () => {
    for (const iso of ['2026-02-16', '2026-02-17', '2026-02-18']) {
      const l = getCalendarDayLabels(iso)
      expect(l?.text).toContain('설날')
      expect(l?.primaryKind).toBe('public')
    }
    expect(getCalendarDayLabels('2026-02-19')?.text ?? '').not.toContain('설날')
  })
})
