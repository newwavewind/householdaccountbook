import { describe, expect, it } from 'vitest'
import { getCalendarDayLabels } from './holidays'

describe('getCalendarDayLabels', () => {
  it('shows 어린이날 as public holiday', () => {
    const l = getCalendarDayLabels('2026-05-05')
    expect(l?.text).toContain('어린이날')
    expect(l?.primaryKind).toBe('public')
  })

  it('shows 어버이날 as observance', () => {
    const l = getCalendarDayLabels('2026-05-08')
    expect(l?.text).toContain('어버이날')
    expect(l?.primaryKind).toBe('observance')
  })

  it('shows 근로자의 날', () => {
    const l = getCalendarDayLabels('2026-05-01')
    expect(l?.text).toContain('근로자의 날')
    expect(l?.primaryKind).toBe('observance')
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

  it('shows 2026 local election', () => {
    const l = getCalendarDayLabels('2026-06-03')
    expect(l?.text).toContain('지방선거')
    expect(l?.primaryKind).toBe('election')
  })

  it('returns undefined for invalid date', () => {
    expect(getCalendarDayLabels('not-a-date')).toBeUndefined()
  })
})
