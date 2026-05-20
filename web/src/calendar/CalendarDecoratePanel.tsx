import { Button } from '../components/ui/Button'
import {
  calendarDecorationLayerStyle,
  calendarDecorationMixedBgRgb,
} from './calendarDecorationStyles'
import {
  CALENDAR_DECO_BACKGROUND_PRESETS,
  CALENDAR_DECO_PATTERN_PRESETS,
  type CalendarDecoKind,
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

  const previewStyle = calendarDecorationLayerStyle({
    ...decoration,
    kind: decoration.kind === 'none' ? 'dots' : decoration.kind,
    opacity: decoration.kind === 'none' ? 0.35 : decoration.opacity,
  })

  const active = decoration.kind !== 'none'
  const mixedBgRgb = calendarDecorationMixedBgRgb(
    decoration.backgroundRgb,
    decoration.backgroundDensity,
  )

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-text-soft">
        배경·패턴 색은 같은 원색 팔레트예요. 요일은 Sun·Mon만 보여요.
      </p>

      <div
        className="relative h-16 overflow-hidden rounded-lg border border-border-subtle bg-ceramic"
        style={
            active
              ? {
                  backgroundColor: `rgba(${mixedBgRgb}, ${decoration.backgroundPageAlpha})`,
                }
              : undefined
        }
        aria-hidden
      >
        {previewStyle ? (
          <div className="absolute inset-0" style={previewStyle} />
        ) : null}
        <div className="absolute inset-0 grid grid-cols-4 gap-px p-2 opacity-40">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="rounded bg-surface-raised/60" />
          ))}
        </div>
      </div>

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

      {decoration.kind !== 'none' ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-text-soft">배경색</p>
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
            {CALENDAR_DECO_BACKGROUND_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                onClick={() => patch({ backgroundRgb: p.rgb })}
                className={`size-7 rounded-full border-2 transition-transform hover:scale-105 ${
                  decoration.backgroundRgb === p.rgb
                    ? 'border-starbucks-green ring-2 ring-green-accent/35'
                    : 'border-white/80'
                }`}
                style={{ backgroundColor: `rgb(${p.rgb})` }}
              />
            ))}
          </div>
          <label className="block text-[11px] font-semibold text-text-soft">
            배경 농도 ({Math.round(decoration.backgroundDensity * 100)}%)
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(decoration.backgroundDensity * 100)}
              onChange={(e) =>
                patch({ backgroundDensity: Number(e.target.value) / 100 })
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
      ) : null}

      {decoration.kind !== 'none' && decoration.kind !== 'photo' ? (
        <div className="space-y-2">
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
        </div>
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
  return deco.kind !== 'none'
}
