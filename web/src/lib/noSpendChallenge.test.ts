import { describe, expect, it } from 'vitest'
import type { DayRollup } from './dayTotals'
import {
  ledgerStartIso,
  monthNoSpendStats,
} from './noSpendChallenge'

describe('ledgerStartIso', () => {
  it('returns earliest transaction date', () => {
    expect(
      ledgerStartIso([
        { date: '2026-05-10' },
        { date: '2026-05-01' },
        { date: '2026-05-05' },
      ]),
    ).toBe('2026-05-01')
  })

  it('returns null when there are no transactions', () => {
    expect(ledgerStartIso([])).toBeNull()
  })
})

describe('monthNoSpendStats', () => {
  const rollups = new Map<string, DayRollup>([
    ['2026-05-05', { income: 0, expense: 0, count: 1, memoLines: [] }],
  ])

  it('does not mark pre-ledger months as no-spend', () => {
    const stats = monthNoSpendStats(
      2026,
      3,
      rollups,
      '2026-05-19',
      '2026-05-01',
    )
    expect(stats.noSpendDays.size).toBe(0)
    expect(stats.eligibleDayCount).toBe(0)
  })

  it('counts no-spend days from ledger start onward in the same month', () => {
    const stats = monthNoSpendStats(
      2026,
      4,
      rollups,
      '2026-05-19',
      '2026-05-01',
    )
    expect(stats.noSpendDays.has('2026-05-05')).toBe(true)
    expect(stats.noSpendDays.has('2026-04-30')).toBe(false)
    expect(stats.eligibleDayCount).toBeGreaterThan(0)
  })
})
