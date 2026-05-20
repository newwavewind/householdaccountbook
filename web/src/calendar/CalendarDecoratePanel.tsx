import { Button } from '../components/ui/Button'
import { calendarDecorationLayerStyle } from './calendarDecorationStyles'
import {
  hasCalendarPhoto,
  type CalendarDecoration,
  type CalendarPhotoFit,
  type CalendarPhotoScope,
} from './calendarDecorationStorage'

const PHOTO_MAX_BYTES = 5 * 1024 * 1024

const SCOPE_OPTIONS: { value: CalendarPhotoScope; label: string }[] = [
  { value: 'page', label: '페이지 전체' },
  { value: 'calendar', label: '달력만' },
]

const FIT_OPTIONS: { value: CalendarPhotoFit; label: string }[] = [
  { value: 'full', label: '꽉 채우기' },
  { value: 'contain', label: '가운데 축소' },
]

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

  const onPhotoFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr('이미지 파일만 선택할 수 있어요.')
      return
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setErr('배경 사진은 5MB 이하로 올려 주세요.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (!url.startsWith('data:image/')) {
        setErr('사진을 불러오지 못했습니다.')
        return
      }
      patch({ imageUrl: url })
    }
    reader.onerror = () => setErr('사진을 불러오지 못했습니다.')
    reader.readAsDataURL(file)
  }

  const previewStyle = decoration.imageUrl
    ? calendarDecorationLayerStyle(decoration, 1)
    : undefined

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-text-soft">
        달력 배경에 사진을 넣을 수 있어요.
      </p>

      <div
        className="relative h-16 overflow-hidden rounded-lg border border-border-subtle bg-ceramic"
        aria-hidden
      >
        {previewStyle ? (
          <div className="absolute inset-0" style={previewStyle} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-ceramic to-well" />
        )}
      </div>

      <label className="block text-[11px] font-semibold text-text-soft">
        배경 사진
        <input
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-[11px] text-text-secondary"
          onChange={(e) => onPhotoFile(e.target.files?.[0])}
        />
      </label>

      {decoration.imageUrl ? (
        <>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-text-soft">표시 위치</p>
            <div className="flex flex-wrap gap-1">
              {SCOPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => patch({ photoScope: o.value })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    decoration.photoScope === o.value
                      ? 'border-green-accent bg-green-light/60 text-starbucks-green'
                      : 'border-border-subtle bg-ceramic text-text-soft'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-text-soft">맞춤</p>
            <div className="flex flex-wrap gap-1">
              {FIT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => patch({ photoFit: o.value })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    decoration.photoFit === o.value
                      ? 'border-green-accent bg-green-light/60 text-starbucks-green'
                      : 'border-border-subtle bg-ceramic text-text-soft'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-[11px] font-semibold text-text-soft">
            사진 농도 ({Math.round(decoration.opacity * 100)}%)
            <input
              type="range"
              min={12}
              max={90}
              value={Math.round(decoration.opacity * 100)}
              onChange={(e) =>
                patch({ opacity: Number(e.target.value) / 100 })
              }
              className="mt-1 w-full accent-green-accent"
            />
          </label>
          <Button
            type="button"
            variant="outlined"
            className="w-full !text-xs"
            onClick={() => patch({ imageUrl: undefined })}
          >
            사진 제거
          </Button>
        </>
      ) : null}

      {err ? <p className="text-xs text-danger">{err}</p> : null}

      <Button
        type="button"
        variant="outlined"
        className="w-full !text-xs"
        onClick={onReset}
      >
        기본값
      </Button>
    </div>
  )
}

export function isCalendarDecorateActive(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco)
}
