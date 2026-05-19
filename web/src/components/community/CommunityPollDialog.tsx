import { useState } from 'react'
import { Button } from '../ui/Button'
import {
  createPollOption,
  DEFAULT_POLL_SETTINGS,
  endsAtFromHours,
  POLL_DURATION_PRESETS,
  type CommunityPollData,
  type CommunityPollSettings,
  type PollOption,
  type PollResultsVisibility,
} from '../../community/communityPollTypes'

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (data: CommunityPollData) => void
}

type DurationMode = 'none' | 'preset' | 'custom'

export function CommunityPollDialog({ open, onClose, onInsert }: Props) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<PollOption[]>([
    createPollOption(''),
    createPollOption(''),
  ])
  const [durationMode, setDurationMode] = useState<DurationMode>('none')
  const [presetHours, setPresetHours] = useState(24)
  const [customEnd, setCustomEnd] = useState('')
  const [resultsVisibility, setResultsVisibility] =
    useState<PollResultsVisibility>('always')
  const [hideVoters, setHideVoters] = useState(false)
  const [showVoterChoices, setShowVoterChoices] = useState(false)
  const [allowRevote, setAllowRevote] = useState(true)
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [maxSelections, setMaxSelections] = useState(2)

  if (!open) return null

  const valid =
    question.trim().length > 0 &&
    options.filter((o) => o.label.trim()).length >= 2

  const buildSettings = (): CommunityPollSettings => {
    let endsAt: string | null = null
    if (durationMode === 'preset') {
      endsAt = endsAtFromHours(presetHours)
    } else if (durationMode === 'custom' && customEnd.trim()) {
      endsAt = new Date(customEnd).toISOString()
    }
    return {
      ...DEFAULT_POLL_SETTINGS,
      endsAt,
      hideVoters,
      showVoterChoices: hideVoters ? false : showVoterChoices,
      resultsVisibility,
      allowRevote: allowMultiple ? true : allowRevote,
      allowMultiple,
      maxSelections: allowMultiple ? Math.max(2, Math.min(10, maxSelections)) : 1,
    }
  }

  const reset = () => {
    setQuestion('')
    setOptions([createPollOption(''), createPollOption('')])
    setDurationMode('none')
    setPresetHours(24)
    setCustomEnd('')
    setResultsVisibility('always')
    setHideVoters(false)
    setShowVoterChoices(false)
    setAllowRevote(true)
    setAllowMultiple(false)
    setMaxSelections(2)
  }

  const submit = () => {
    if (!valid) return
    const trimmed = options
      .map((o) => ({ ...o, label: o.label.trim() }))
      .filter((o) => o.label)
    onInsert({
      pollId: crypto.randomUUID(),
      question: question.trim(),
      options: trimmed,
      settings: buildSettings(),
    })
    reset()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="poll-dialog-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-border-subtle bg-surface-raised shadow-xl">
        <div className="border-b border-border-muted p-4">
          <h2 id="poll-dialog-title" className="text-lg font-semibold text-starbucks-green">
            {'\ud22c\ud45c \ub9cc\ub4e4\uae30'}
          </h2>
          <p className="mt-1 text-xs text-text-soft">
            {'\uc9c8\ubb38, \ud56d\ubaa9, \ub9c8\uac10 \ubc0f \uacf5\uac1c \uc124\uc815'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <label className="block text-sm font-medium text-text-primary">
            {'\uc9c8\ubb38'}
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1 w-full rounded border border-border-subtle bg-surface-raised px-3 py-2 text-sm outline-none focus:border-green-accent/60"
              placeholder={'\uc5b4\ub5a4 \uba54\ub274\uac00 \uc88b\uc744\uae4c\uc694?'}
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">{'\ud56d\ubaa9'}</p>
            {options.map((o, i) => (
              <div key={o.id} className="flex gap-2">
                <input
                  type="text"
                  value={o.label}
                  onChange={(e) => {
                    const next = [...options]
                    next[i] = { ...o, label: e.target.value }
                    setOptions(next)
                  }}
                  className="min-w-0 flex-1 rounded border border-border-subtle px-3 py-1.5 text-sm outline-none focus:border-green-accent/60"
                  placeholder={`\ud56d\ubaa9 ${i + 1}`}
                />
                {options.length > 2 ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-text-soft hover:text-danger"
                    onClick={() => setOptions(options.filter((x) => x.id !== o.id))}
                  >
                    {'\uc0ad\uc81c'}
                  </button>
                ) : null}
              </div>
            ))}
            {options.length < 8 ? (
              <button
                type="button"
                className="text-xs font-semibold text-green-accent hover:underline"
                onClick={() => setOptions([...options, createPollOption('')])}
              >
                {'+ \ud56d\ubaa9 \ucd94\uac00'}
              </button>
            ) : null}
          </div>

          <fieldset className="space-y-2 rounded-lg border border-border-muted p-3">
            <legend className="px-1 text-sm font-medium text-text-primary">
              {'\ud22c\ud45c \uae30\uac04'}
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="duration"
                checked={durationMode === 'none'}
                onChange={() => setDurationMode('none')}
              />
              {'\uae30\uac04 \uc5c6\uc74c'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="duration"
                checked={durationMode === 'preset'}
                onChange={() => setDurationMode('preset')}
              />
              {'\uc804\uc6a9 \uae30\uac04'}
              {durationMode === 'preset' ? (
                <select
                  value={presetHours}
                  onChange={(e) => setPresetHours(Number(e.target.value))}
                  className="rounded border border-border-subtle px-2 py-0.5 text-xs"
                >
                  {POLL_DURATION_PRESETS.map((p) => (
                    <option key={p.hours} value={p.hours}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </label>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <input
                type="radio"
                name="duration"
                checked={durationMode === 'custom'}
                onChange={() => setDurationMode('custom')}
              />
              {'\uc9c1\uc811 \uc9c0\uc815'}
              {durationMode === 'custom' ? (
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded border border-border-subtle px-2 py-0.5 text-xs"
                />
              ) : null}
            </label>
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border border-border-muted p-3">
            <legend className="px-1 text-sm font-medium text-text-primary">
              {'\uacb0\uacfc \uacf5\uac1c'}
            </legend>
            {(
              [
                ['always', '\ud56d\uc0c1 \uacf5\uac1c'],
                ['after_vote', '\ud22c\ud45c \ud6c4 \uacf5\uac1c'],
                ['after_end', '\ub9c8\uac10 \ud6c4 \uacf5\uac1c'],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="resultsVis"
                  checked={resultsVisibility === v}
                  onChange={() => setResultsVisibility(v)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border border-border-muted p-3">
            <legend className="px-1 text-sm font-medium text-text-primary">
              {'\uae30\ud0c0 \uc124\uc815'}
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hideVoters}
                onChange={(e) => {
                  setHideVoters(e.target.checked)
                  if (e.target.checked) setShowVoterChoices(false)
                }}
              />
              {'\ucc38\uc5ec\uc790 \ube44\uacf5\uac1c (\uc775\uba85 \ud22c\ud45c)'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showVoterChoices}
                disabled={hideVoters}
                onChange={(e) => setShowVoterChoices(e.target.checked)}
              />
              {'\ud56d\ubaa9\ubcc4 \ud22c\ud45c\uc790 \uacf5\uac1c (\uacf5\uac1c \ud22c\ud45c)'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
              />
              {'\ubcf5\uc218 \uc120\ud0dd \ud5c8\uc6a9'}
              {allowMultiple ? (
                <select
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(Number(e.target.value))}
                  className="rounded border border-border-subtle px-2 py-0.5 text-xs"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {'\ucd5c\ub300 '}
                      {n}
                      {'\uac1c'}
                    </option>
                  ))}
                </select>
              ) : null}
            </label>
            {!allowMultiple ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowRevote}
                  onChange={(e) => setAllowRevote(e.target.checked)}
                />
                {'\ud22c\ud45c \ud6c4 \uc120\ud0dd \ubcc0\uacbd \ud5c8\uc6a9'}
              </label>
            ) : null}
          </fieldset>
        </div>

        <div className="border-t border-border-muted p-4 flex justify-end gap-2">
          <Button type="button" variant="outlined" className="!text-xs" onClick={onClose}>
            {'\ucde8\uc18c'}
          </Button>
          <Button type="button" variant="primary" className="!text-xs" disabled={!valid} onClick={submit}>
            {'\uc0bd\uc785'}
          </Button>
        </div>
      </div>
    </div>
  )
}


