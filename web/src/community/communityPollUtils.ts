import type { CommunityPollData, CommunityPollSettings } from './communityPollTypes'

export type PollStatus = 'active' | 'ended'

export function getPollStatus(settings: CommunityPollSettings, now = Date.now()): PollStatus {
  if (!settings.endsAt) return 'active'
  const end = Date.parse(settings.endsAt)
  if (Number.isNaN(end)) return 'active'
  return now >= end ? 'ended' : 'active'
}

export function isPollEnded(settings: CommunityPollSettings, now = Date.now()): boolean {
  return getPollStatus(settings, now) === 'ended'
}

export function canSeePollResults(
  settings: CommunityPollSettings,
  hasVoted: boolean,
  now = Date.now(),
): boolean {
  const ended = isPollEnded(settings, now)
  switch (settings.resultsVisibility) {
    case 'always':
      return true
    case 'after_vote':
      return hasVoted || ended
    case 'after_end':
      return ended
    default:
      return true
  }
}

export function canVoteOnPoll(
  settings: CommunityPollSettings,
  hasVoted: boolean,
  now = Date.now(),
): boolean {
  if (isPollEnded(settings, now)) return false
  if (!hasVoted) return true
  return settings.allowRevote || settings.allowMultiple
}

export function formatPollEndsAt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatPollRemaining(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null
  const end = Date.parse(iso)
  if (Number.isNaN(end)) return null
  const ms = end - now
  if (ms <= 0) return null
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}\uBD84 \ub0a8\uc74c`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}\uC2DC\uAC04 \ub0a8\uc74c`
  const days = Math.floor(hours / 24)
  return `${days}\uC77C \ub0a8\uc74c`
}

export function resultsVisibilityLabel(v: CommunityPollSettings['resultsVisibility']): string {
  switch (v) {
    case 'always':
      return '\uC989\uC2DC \uACF5\uAC1C'
    case 'after_vote':
      return '\uD22C\uD45C \uD6C4 \uACF5\uAC1C'
    case 'after_end':
      return '\uB9C8\uAC10 \uD6C4 \uACF5\uAC1C'
    default:
      return ''
  }
}

export function pollSettingsSummary(poll: CommunityPollData): string[] {
  const s = poll.settings
  const lines: string[] = []
  if (s.endsAt) {
    lines.push(`\uB9C8\uAC10: ${formatPollEndsAt(s.endsAt)}`)
  } else {
    lines.push('\uAE30\uD55C \uC5C6\uC74C')
  }
  lines.push(resultsVisibilityLabel(s.resultsVisibility))
  if (s.hideVoters) lines.push('\uCC38\uC5EC\uC790 \uBE44\uACF5\uAC1C')
  else if (s.showVoterChoices) lines.push('\uACF5\uAC1C \uD22C\uD45C')
  else lines.push('\uBE44\uBC00 \uD22C\uD45C')
  if (s.allowMultiple) lines.push(`\uBCF5\uC218 \uC120\uD0DD (\uCD5C\uB300 ${s.maxSelections}\uAC1C)`)
  if (!s.allowRevote && !s.allowMultiple) lines.push('\uC7AC\uD22C\uD45C \uBD88\uAC00')
  return lines
}

/** \ub9c8\uac10 \uc2dc\uac04 \uc81c\uc678 (\uba54\ud0c0 \uc904\uc5d0\uc11c \ubcc4\ub3c4 \ud45c\uc2dc) */
export function pollSettingBadges(poll: CommunityPollData): string[] {
  return pollSettingsSummary(poll).filter(
    (line) => !line.startsWith('\uB9C8\uAC10:') && line !== '\uAE30\uD55C \uC5C6\uC74C',
  )
}
