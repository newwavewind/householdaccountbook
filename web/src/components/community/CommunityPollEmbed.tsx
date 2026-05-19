import { useCallback, useEffect, useMemo, useState } from 'react'
import { castPollVote, fetchPollVotes, type PollVoter } from '../../community/communityPollVotes'
import type { CommunityPollData } from '../../community/communityPollTypes'
import {
  canSeePollResults,
  canVoteOnPoll,
  formatPollEndsAt,
  formatPollRemaining,
  getPollStatus,
  pollSettingBadges,
} from '../../community/communityPollUtils'

type Props = {
  postId: string
  poll: CommunityPollData
  voterId: string
  userDisplayName: string | null
}

function PollIconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-70">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PollIconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-70">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function OptionIndicator({
  multiple,
  selected,
  disabled,
}: {
  multiple: boolean
  selected: boolean
  disabled: boolean
}) {
  return (
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors ${
        multiple ? 'rounded-md' : 'rounded-full'
      } ${
        selected
          ? 'border-green-accent bg-green-accent text-on-accent'
          : disabled
            ? 'border-border-muted bg-neutral-warm/80'
            : 'border-border-subtle bg-surface-raised group-hover:border-green-accent/50'
      }`}
      aria-hidden
    >
      {selected ? (
        multiple ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="h-2 w-2 rounded-full bg-on-accent" />
        )
      ) : null}
    </span>
  )
}

export function CommunityPollEmbed({ postId, poll, voterId, userDisplayName }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [myOptionIds, setMyOptionIds] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [voters, setVoters] = useState<PollVoter[]>([])
  const [busy, setBusy] = useState(false)
  const [showVoters, setShowVoters] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const settings = poll.settings
  const optionIds = poll.options.map((o) => o.id)
  const hasVoted = myOptionIds.length > 0
  const ended = getPollStatus(settings, now) === 'ended'
  const showResults = canSeePollResults(settings, hasVoted, now)
  const canVote = canVoteOnPoll(settings, hasVoted, now)
  const remaining = formatPollRemaining(settings.endsAt, now)
  const badges = pollSettingBadges(poll)

  const totalVotes = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  )

  const leadingPct = useMemo(() => {
    if (!showResults || totalVotes === 0) return 0
    return Math.max(...poll.options.map((o) => counts[o.id] ?? 0)) / totalVotes * 100
  }, [showResults, totalVotes, poll.options, counts])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const reload = useCallback(async () => {
    const result = await fetchPollVotes(postId, poll.pollId, optionIds, voterId)
    setCounts(result.counts)
    setMyOptionIds(result.myOptionIds)
    setTotal(result.total)
    setVoters(result.voters)
  }, [postId, poll.pollId, optionIds, voterId])

  useEffect(() => {
    void reload()
  }, [reload])

  const votersByOption = useMemo(() => {
    const map: Record<string, PollVoter[]> = {}
    for (const opt of poll.options) map[opt.id] = []
    for (const v of voters) {
      if (map[v.optionId]) map[v.optionId].push(v)
    }
    return map
  }, [poll.options, voters])

  const vote = async (optionId: string) => {
    if (!userDisplayName?.trim() || busy) return
    if (!canVoteOnPoll(settings, hasVoted, now) && !settings.allowMultiple) return
    if (ended) return
    setBusy(true)
    try {
      await castPollVote(postId, poll.pollId, optionId, voterId, userDisplayName.trim(), settings)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : '\ud22c\ud45c\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.')
    } finally {
      setBusy(false)
    }
  }

  const optionDisabled = (optionId: string) => {
    if (!userDisplayName?.trim() || busy || ended) return true
    if (settings.allowMultiple) {
      if (myOptionIds.includes(optionId)) return false
      if (myOptionIds.length >= settings.maxSelections) return true
      return false
    }
    if (hasVoted && !settings.allowRevote) return true
    return false
  }

  return (
    <article
      className="community-poll-card my-5 overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
      role="group"
      aria-label={'\ud22c\ud45c'}
    >
      <header className="border-b border-border-muted/50 bg-gradient-to-br from-green-light/35 via-surface-raised to-surface-raised px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-accent/12 text-base"
            aria-hidden
          >
            {'\ud83d\udcca'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold leading-snug text-text-primary">
                {poll.question}
              </h3>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                  ended
                    ? 'bg-neutral-warm text-text-soft'
                    : 'bg-green-accent/15 text-green-accent'
                }`}
              >
                {ended ? '\ub9c8\uac10' : '\uc9c4\ud589 \uc911'}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-soft">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <PollIconUsers />
                <span className="tabular-nums text-text-primary">{total}</span>
                {'\uba85 \ucc38\uc5ec'}
              </span>
              {settings.endsAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <PollIconClock />
                  {ended ? (
                    <span>{formatPollEndsAt(settings.endsAt)}</span>
                  ) : (
                    <span>
                      {remaining ? (
                        <>
                          <span className="font-medium text-green-accent">{remaining}</span>
                          <span className="mx-1 text-border-muted">|</span>
                        </>
                      ) : null}
                      <span>{formatPollEndsAt(settings.endsAt)}</span>
                    </span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <PollIconClock />
                  {'\uae30\uac04 \uc5c6\uc74c'}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 sm:px-5">
        {badges.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {badges.map((line) => (
              <li
                key={line}
                className="rounded-full border border-border-muted/80 bg-neutral-warm/50 px-2.5 py-0.5 text-[11px] font-medium text-text-soft"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : null}

        {!showResults ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-green-accent/25 bg-green-light/20 px-3.5 py-2.5 text-xs leading-relaxed text-text-soft">
            <span className="text-base" aria-hidden>
              {'\ud83d\udd12'}
            </span>
            {settings.resultsVisibility === 'after_end'
              ? '\ub9c8\uac10 \uc774\ud6c4 \uacb0\uacfc\uac00 \uacf5\uac1c\ub429\ub2c8\ub2e4.'
              : '\ud22c\ud45c\ud558\uba74 \uacb0\uacfc\ub97c \ubcfc \uc218 \uc788\uc2b5\ub2c8\ub2e4.'}
          </p>
        ) : null}

        <ul className={`space-y-2.5 ${badges.length > 0 || !showResults ? 'mt-4' : 'mt-0'}`}>
          {poll.options.map((opt) => {
            const n = counts[opt.id] ?? 0
            const pct = totalVotes > 0 ? Math.round((n / totalVotes) * 100) : 0
            const rawPct = totalVotes > 0 ? (n / totalVotes) * 100 : 0
            const selected = myOptionIds.includes(opt.id)
            const disabled = optionDisabled(opt.id)
            const isLeading = showResults && rawPct > 0 && rawPct >= leadingPct - 0.01

            return (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled={disabled || !canVote}
                  onClick={() => void vote(opt.id)}
                  className={`poll-option group w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-200 ${
                    isLeading ? 'is-leading' : ''
                  } ${
                    selected
                      ? 'border-green-accent/60 bg-green-light/25 shadow-[inset_0_0_0_1px_rgba(var(--color-green-accent-rgb,34,139,34),0.15)]'
                      : 'border-border-subtle bg-neutral-warm/30 hover:border-green-accent/35 hover:bg-surface-raised'
                  } disabled:cursor-default disabled:opacity-60`}
                >
                  <div className="flex gap-3">
                    <OptionIndicator
                      multiple={settings.allowMultiple}
                      selected={selected}
                      disabled={disabled || !canVote}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`text-sm leading-snug ${
                            selected ? 'font-semibold text-text-primary' : 'font-medium text-text-primary'
                          }`}
                        >
                          {opt.label}
                        </span>
                        {showResults ? (
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-bold tabular-nums text-green-accent">
                              {pct}%
                            </span>
                            <span className="block text-[10px] tabular-nums text-text-soft">
                              {n}
                              {'\ud45c'}
                            </span>
                          </span>
                        ) : selected ? (
                          <span className="shrink-0 rounded-full bg-green-accent/15 px-2 py-0.5 text-[10px] font-semibold text-green-accent">
                            {'\uc120\ud0dd'}
                          </span>
                        ) : null}
                      </div>
                      {showResults ? (
                        <div className="poll-bar-track mt-2.5">
                          <div
                            className="poll-bar-fill"
                            style={{ width: `${Math.max(pct, n > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
                {showResults && settings.showVoterChoices && !settings.hideVoters ? (
                  <ul className="mt-1.5 flex flex-wrap gap-1 pl-8">
                    {(votersByOption[opt.id] ?? []).map((v) => (
                      <li
                        key={`${v.userId}-${v.optionId}`}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-text-soft shadow-sm ring-1 ring-border-muted/60"
                      >
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-accent/15 text-[9px] font-bold text-green-accent">
                          {v.displayName.slice(0, 1)}
                        </span>
                        {v.displayName}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>

        {!userDisplayName?.trim() ? (
          <p className="mt-4 text-center text-xs text-text-soft">
            {'\ub2c9\ub124\uc784\uc744 \uc785\ub825\ud558\uba74 \ud22c\ud45c\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.'}
          </p>
        ) : null}
        {ended ? (
          <p className="mt-4 text-center text-xs text-text-soft">
            {'\ud22c\ud45c\uac00 \ub9c4\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4.'}
          </p>
        ) : null}
        {!ended && hasVoted && !settings.allowRevote && !settings.allowMultiple ? (
          <p className="mt-4 text-center text-xs text-text-soft">
            {'\uc774\ubbf8 \ud22c\ud45c\ud588\uc2b5\ub2c8\ub2e4. \uc120\ud0dd\uc744 \ubc14\uafc0 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.'}
          </p>
        ) : null}

        {!settings.hideVoters && voters.length > 0 ? (
          <div className="mt-5 border-t border-border-muted/60 pt-4">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-semibold text-text-primary transition-colors hover:text-green-accent"
              onClick={() => setShowVoters((v) => !v)}
            >
              <span>
                {'\ucc38\uc5ec\uc790 '}
                <span className="tabular-nums text-green-accent">{total}</span>
                {'\uba85'}
              </span>
              <span className="text-text-soft">{showVoters ? '\u25b2' : '\u25bc'}</span>
            </button>
            {showVoters ? (
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {settings.showVoterChoices
                  ? voters.map((v) => {
                      const label = poll.options.find((o) => o.id === v.optionId)?.label ?? ''
                      return (
                        <li
                          key={`${v.userId}-${v.optionId}-${v.votedAt}`}
                          className="flex items-center gap-2 rounded-lg border border-border-subtle bg-neutral-warm/40 px-2.5 py-2 text-xs"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-accent/15 text-[11px] font-bold text-green-accent">
                            {v.displayName.slice(0, 1)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-text-primary">
                              {v.displayName}
                            </span>
                            <span className="block truncate text-[10px] text-text-soft">{label}</span>
                          </span>
                        </li>
                      )
                    })
                  : Array.from(new Map(voters.map((v) => [v.userId, v.displayName])).entries()).map(
                      ([uid, name]) => (
                        <li
                          key={uid}
                          className="flex items-center gap-2 rounded-lg border border-border-subtle bg-neutral-warm/40 px-2.5 py-2 text-xs"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-accent/15 text-[11px] font-bold text-green-accent">
                            {name.slice(0, 1)}
                          </span>
                          <span className="truncate font-medium text-text-primary">{name}</span>
                        </li>
                      ),
                    )}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

