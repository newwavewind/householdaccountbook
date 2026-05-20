import { Button } from '../components/ui/Button'
import {
  calendarDecorationLayerStyle,
  hasCalendarPattern,
  isCalendarDecorated,
} from './calendarDecorationStyles'
import {
  CALENDAR_BACKGROUND_PRESETS,
  calendarBackgroundPickerSwatchStyle,
  calendarBackgroundSwatchStyle,
  getCalendarBackgroundPreset,
  type CalendarBackgroundPreset,
} from './calendarBackgroundPresets'
import {
  CALENDAR_DECO_PATTERN_PRESETS,
  type CalendarDecoKind,
  type CalendarBackgroundMode,
  type CalendarDecoration,
} from './calendarDecorationStorage'

const DECO_OPTIONS: { kind: CalendarDecoKind; label: string }[] = [
  { kind: 'none', label: '없음' },
  { kind: 'dots', label: '땡떙이' },
  { kind: 'stripes', label: '줄무늬' },
  { kind: 'grid', label: '격자' },
  { kind: 'waves', label: '물결' },
  { kind: 'bubbles', label: '방울' },
  { kind: 'honeycomb', label: '벌집' },
  { kind: 'star', label: '별' },
  { kind: 'speckle', label: '점박이' },
  { kind: 'checker', label: '체크' },
  { kind: 'photo', label: '사진' },
]

const PHOTO_MAX_BYTES = 2.5 * 1024 * 1024

type Props = {
  decoration: CalendarDecoration
  onChange: (next: CalendarDecoration) => void
  onReset: () => void
  err: string | null
  setErr: (msg: string | null) => void
}

function presetsForMode(mode: CalendarBackgroundMode): CalendarBackgroundPreset[] {
  return CALENDAR_BACKGROUND_PRESETS.filter((p) => p.mode === mode)
}

export function CalendarDecoratePanel({
  decoration,
  onChange,
  onReset,
  err,
  setErr,
}: Props) {
  const patch = (partial: Partial<CalendarDecoration>) => {
    onChange({ ...decoration, ...partial })
    setErr(null)
  }

  const onPickKind = (kind: CalendarDecoKind) => {
    if (kind !== 'photo') {
      patch({ kind, imageUrl: undefined })
      return
    }
    patch({ kind: 'photo' })
  }

  const onPhotoFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr('이미지 파일만 선택할 수 있어요.')
      return
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setErr('배경 사진은 2.5MB 이하로 올려 주세요.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (!url.startsWith('data:image/')) {
        setErr('사진을 불러오지 못했습니다.')
        return
      }
      patch({ kind: 'photo', imageUrl: url })
    }
    reader.onerror = () => setErr('사진을 불러오지 못했습니다.')
    reader.readAsDataURL(file)
  }

  const onPickBackground = (preset: CalendarBackgroundPreset) => {
    patch({
      useBackground: true,
      backgroundMode: preset.mode,
      backgroundPresetId: preset.id,
      backgroundRgb: preset.rgb,
    })
  }

  const patternActive = hasCalendarPattern(decoration)
  const previewPatternStyle = calendarDecorationLayerStyle(decoration, 1)

  const tonePresets = presetsForMode(decoration.backgroundMode).filter(
    (p) => p.group === 'tone',
  )
  const rainbowPresets = presetsForMode(decoration.backgroundMode).filter(
    (p) => p.group === 'rainbow',
  )

  const selectedBg = getCalendarBackgroundPreset(decoration.backgroundPresetId)
  const previewBg = calendarBackgroundSwatchStyle(
    selectedBg,
    decoration.backgroundDensity,
  )

  const switchBackgroundMode = (mode: CalendarBackgroundMode) => {
    const label = selectedBg.label
    const list = presetsForMode(mode)
    const next = list.find((p) => p.label === label) ?? list[0]!
    onPickBackground(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-text-soft">
        패턴은 없어도 배경만 바꿀 수 있어요. 단색·그라데이션, 무지개 색도
        골라 보세요.
      </p>

      <div
        className="relative h-16 overflow-hidden rounded-lg border border-border-subtle bg-ceramic"
        aria-hidden
      >
        {decoration.useBackground ? (
          <div
            className="absolute inset-0"
            style={{
              background: previewBg,
              opacity: decoration.backgroundPageAlpha,
            }}
          />
        ) : null}
        {patternActive && previewPatternStyle ? (
          <div className="absolute inset-0" style={previewPatternStyle} />
        ) : null}
        <div className="absolute inset-0 grid grid-cols-4 gap-px p-2 opacity-30">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="rounded bg-surface-raised/60" />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-text-soft">배경색</p>
        <div className="flex gap-1">
          {(['solid', 'gradient'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => switchBackgroundMode(mode)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                decoration.backgroundMode === mode
                  ? 'border-green-accent bg-green-light/60 text-starbucks-green'
                  : 'border-border-subtle bg-ceramic text-text-soft'
              }`}
            >
              {mode === 'solid' ? '단색' : '그라데이션'}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-text-soft">원색</p>
        <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
          {tonePresets.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.label}
              onClick={() => onPickBackground(p)}
              className={`size-7 rounded-full border-2 transition-transform hover:scale-105 ${
                decoration.backgroundPresetId === p.id
                  ? 'border-starbucks-green ring-2 ring-green-accent/35'
                  : 'border-white/80'
              }`}
              style={{
                background: calendarBackgroundPickerSwatchStyle(p),
              }}
            />
          ))}
        </div>

        <p className="text-[10px] text-text-soft">빨주노초파남보</p>
        <div className="flex max-h-16 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
          {rainbowPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.label}
              onClick={() => onPickBackground(p)}
              className={`size-7 rounded-full border-2 transition-transform hover:scale-105 ${
                decoration.backgroundPresetId === p.id
                  ? 'border-starbucks-green ring-2 ring-green-accent/35'
                  : 'border-white/80'
              }`}
              style={{
                background: calendarBackgroundPickerSwatchStyle(p),
              }}
            />
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2 px-0.5 text-[11px] font-medium text-text-primary">
          <input
            type="checkbox"
            checked={decoration.useBackground}
            onChange={(e) => patch({ useBackground: e.target.checked })}
            className="size-3.5 rounded border-black/25 text-green-accent"
          />
          배경 적용
        </label>

        <label className="block text-[11px] font-semibold text-text-soft">
          배경 농도 ({Math.round(decoration.backgroundDensity * 100)}%) — 달력에만
          적용
          <input
            type="range"
            min={1}
            max={100}
            value={Math.max(
              1,
              Math.round(decoration.backgroundDensity * 100),
            )}
            onChange={(e) =>
              patch({
                backgroundDensity: Math.max(
                  0.01,
                  Number(e.target.value) / 100,
                ),
              })
            }
            className="mt-1 w-full accent-green-accent"
          />
        </label>
        <label className="block text-[11px] font-semibold text-text-soft">
          배경 투명도 ({Math.round(decoration.backgroundPageAlpha * 100)}%)
          <input
            type="range"
            min={20}
            max={100}
            value={Math.round(decoration.backgroundPageAlpha * 100)}
            onChange={(e) =>
              patch({
                backgroundPageAlpha: Number(e.target.value) / 100,
              })
            }
            className="mt-1 w-full accent-green-accent"
          />
        </label>
        <label className="block text-[11px] font-semibold text-text-soft">
          칸 배경 진하기 ({Math.round(decoration.backgroundFill * 100)}%)
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(decoration.backgroundFill * 100)}
            onChange={(e) =>
              patch({ backgroundFill: Number(e.target.value) / 100 })
            }
            className="mt-1 w-full accent-green-accent"
          />
        </label>
      </div>

      <div className="space-y-2 border-t border-border-muted pt-3">
        <p className="text-[11px] font-semibold text-text-soft">패턴 (선택)</p>
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
          {DECO_OPTIONS.map((o) => {
            const selected = decoration.kind === o.kind
            return (
              <button
                key={o.kind}
                type="button"
                onClick={() => onPickKind(o.kind)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  selected
                    ? 'border-green-accent bg-green-light/60 text-starbucks-green'
                    : 'border-border-subtle bg-ceramic text-text-soft hover:border-green-accent/40'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>

        {decoration.kind !== 'none' && decoration.kind !== 'photo' ? (
          <>
            <p className="text-[11px] font-semibold text-text-soft">패턴 색</p>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
              {CALENDAR_DECO_PATTERN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => patch({ patternRgb: p.rgb })}
                  className={`size-7 rounded-full border-2 transition-transform hover:scale-105 ${
                    decoration.patternRgb === p.rgb
                      ? 'border-starbucks-green ring-2 ring-green-accent/35'
                      : 'border-white/80'
                  }`}
                  style={{ backgroundColor: `rgb(${p.rgb})` }}
                />
              ))}
            </div>
            <label className="block text-[11px] font-semibold text-text-soft">
              패턴 진하기 ({Math.round(decoration.opacity * 100)}%)
              <input
                type="range"
                min={8}
                max={50}
                value={Math.round(decoration.opacity * 100)}
                onChange={(e) =>
                  patch({ opacity: Number(e.target.value) / 100 })
                }
                className="mt-1 w-full accent-green-accent"
              />
            </label>
          </>
        ) : null}

        {decoration.kind === 'photo' ? (
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-text-soft">
              배경 사진
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-[11px] text-text-secondary"
                onChange={(e) => onPhotoFile(e.target.files?.[0])}
              />
            </label>
            <label className="block text-[11px] font-semibold text-text-soft">
              패턴 진하기 ({Math.round(decoration.opacity * 100)}%)
              <input
                type="range"
                min={12}
                max={55}
                value={Math.round(decoration.opacity * 100)}
                onChange={(e) =>
                  patch({ opacity: Number(e.target.value) / 100 })
                }
                className="mt-1 w-full accent-green-accent"
              />
            </label>
            {decoration.imageUrl ? (
              <Button
                type="button"
                variant="outlined"
                className="w-full !text-xs"
                onClick={() => patch({ imageUrl: undefined })}
              >
                사진 제거
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {err ? <p className="text-xs text-danger">{err}</p> : null}

      <Button
        type="button"
        variant="outlined"
        className="w-full !text-xs"
        onClick={onReset}
      >
        꾸미기 기본값
      </Button>
    </div>
  )
}

export function isCalendarDecorateActive(deco: CalendarDecoration): boolean {
  return isCalendarDecorated(deco)
}
