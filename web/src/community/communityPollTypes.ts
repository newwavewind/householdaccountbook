export type PollOption = {
  id: string
  label: string
}

/** 결과 공개 시점 */
export type PollResultsVisibility = 'always' | 'after_vote' | 'after_end'

export type CommunityPollSettings = {
  /** ISO datetime, null = 기한 없음 */
  endsAt: string | null
  /** 참여자 목록 숨김 (익명 투표) */
  hideVoters: boolean
  /** 항목별 누가 투표했는지 공개 (비밀투표면 false) */
  showVoterChoices: boolean
  resultsVisibility: PollResultsVisibility
  /** 투표 후 선택 변경 허용 */
  allowRevote: boolean
  /** 복수 선택 허용 */
  allowMultiple: boolean
  /** 복수 선택 시 최대 개수 (1 이상) */
  maxSelections: number
}

export type CommunityPollData = {
  pollId: string
  question: string
  options: PollOption[]
  settings: CommunityPollSettings
}

export const DEFAULT_POLL_SETTINGS: CommunityPollSettings = {
  endsAt: null,
  hideVoters: false,
  showVoterChoices: false,
  resultsVisibility: 'always',
  allowRevote: true,
  allowMultiple: false,
  maxSelections: 1,
}

export function createPollOption(label: string): PollOption {
  return { id: crypto.randomUUID(), label: label.trim() }
}

function normalizeSettings(raw: Partial<CommunityPollSettings> | undefined): CommunityPollSettings {
  const s = { ...DEFAULT_POLL_SETTINGS, ...raw }
  const max = Math.max(1, Math.min(10, Number(s.maxSelections) || 1))
  return {
    endsAt: s.endsAt && String(s.endsAt).trim() ? String(s.endsAt) : null,
    hideVoters: Boolean(s.hideVoters),
    showVoterChoices: Boolean(s.showVoterChoices),
    resultsVisibility:
      s.resultsVisibility === 'after_vote' ||
      s.resultsVisibility === 'after_end' ||
      s.resultsVisibility === 'always'
        ? s.resultsVisibility
        : 'always',
    allowRevote: s.allowRevote !== false,
    allowMultiple: Boolean(s.allowMultiple),
    maxSelections: s.allowMultiple ? max : 1,
  }
}

export function parsePollData(raw: string | null | undefined): CommunityPollData | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as CommunityPollData & { settings?: Partial<CommunityPollSettings> }
    if (!p.pollId || !p.question || !Array.isArray(p.options) || p.options.length < 2) {
      return null
    }
    return {
      pollId: p.pollId,
      question: p.question,
      options: p.options,
      settings: normalizeSettings(p.settings),
    }
  } catch {
    return null
  }
}

export function serializePollData(data: CommunityPollData): string {
  return JSON.stringify({
    ...data,
    settings: normalizeSettings(data.settings),
  })
}

/** 마감 시각 프리셋 (시간) */
export const POLL_DURATION_PRESETS = [
  { label: '1\uC2DC\uAC04', hours: 1 },
  { label: '6\uC2DC\uAC04', hours: 6 },
  { label: '1\uC77C', hours: 24 },
  { label: '3\uC77C', hours: 72 },
  { label: '7\uC77C', hours: 168 },
] as const

export function endsAtFromHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}
