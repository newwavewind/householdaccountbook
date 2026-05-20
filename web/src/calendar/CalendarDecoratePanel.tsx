import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { Button } from '../components/ui/Button'
import { zonePhotoLayerStyle } from './calendarDecorationStyles'
import {
  CALENDAR_PHOTO_ZONES,
  DEFAULT_CALENDAR_DECORATION,
  hasCalendarPhoto,
  zoneHasPhoto,
  type CalendarDecoration,
  type CalendarPhotoFit,
  type CalendarPhotoZone,
  type CalendarZonePhoto,
} from './calendarDecorationStorage'

const PHOTO_MAX_BYTES = 5 * 1024 * 1024

type Props = {
  decoration: CalendarDecoration
  onPreview: (next: CalendarDecoration) => void
  onSave: () => void
  onReset: () => void
  err: string | null
  setErr: (msg: string | null) => void
}

function patchZone(
  deco: CalendarDecoration,
  zoneId: CalendarPhotoZone,
  patch: Partial<CalendarZonePhoto>,
): CalendarDecoration {
  return {
    zones: {
      ...deco.zones,
      [zoneId]: { ...deco.zones[zoneId], ...patch },
    },
  }
}

function PhotoPositionPreview({
  zone,
  onPosition,
}: {
  zone: CalendarZonePhoto
  onPosition: (x: number, y: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const style = zonePhotoLayerStyle(zone, 1)

  const pickPosition = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
      onPosition(x, y)
    },
    [onPosition],
  )

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!zone.imageUrl) return
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    pickPosition(e.clientX, e.clientY)
    const onMove = (ev: globalThis.PointerEvent) => pickPosition(ev.clientX, ev.clientY)
    const onUp = () => {
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  if (!zone.imageUrl) {
    return (
      <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-border-muted bg-well/40 text-[11px] text-text-soft">
        사진을 선택하면 미리보기가 표시됩니다
      </div>
    )
  }

  return (
    <div
      ref={ref}
      role="presentation"
      className="relative h-28 cursor-crosshair overflow-hidden rounded-md border border-border-muted bg-well/30"
      onPointerDown={onPointerDown}
      title="드래그하여 사진 위치 조정"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={style}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      <p className="absolute bottom-1 left-2 text-[10px] font-medium text-white drop-shadow">
        미리보기 · 드래그로 위치 조정
      </p>
    </div>
  )
}

export function CalendarDecoratePanel({
  decoration,
  onPreview,
  onSave,
  onReset,
  err,
  setErr,
}: Props) {
  const [activeZone, setActiveZone] = useState<CalendarPhotoZone>('dday')
  const zone = decoration.zones[activeZone]
  const zoneLabel =
    CALENDAR_PHOTO_ZONES.find((z) => z.id === activeZone)?.label ?? activeZone

  const updateZone = (patch: Partial<CalendarZonePhoto>) => {
    onPreview(patchZone(decoration, activeZone, patch))
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
      setErr(null)
      updateZone({ imageUrl: url })
    }
    reader.onerror = () => setErr('사진을 불러오지 못했습니다.')
    reader.readAsDataURL(file)
  }

  const opacityPct = Math.round(zone.opacity * 100)

  return (
    <div className="space-y-3">
      <p className="text-[10px] leading-snug text-text-soft">
        D-Day·스티커·달력·일정 상세 영역마다 다른 사진을 쓸 수 있어요. 변경 후{' '}
        <span className="font-semibold text-text-primary">저장</span>을 눌러야
        적용됩니다.
      </p>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-soft">
          표시 위치
        </p>
        <div className="flex flex-wrap gap-1">
          {CALENDAR_PHOTO_ZONES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                activeZone === id
                  ? 'border-green-accent bg-green-light/50 text-starbucks-green'
                  : 'border-charcoal-border bg-surface-raised text-text-secondary hover:bg-well'
              }`}
              onClick={() => setActiveZone(id)}
            >
              {label}
              {zoneHasPhoto(decoration.zones[id]) ? (
                <span className="ml-1 text-green-accent" aria-hidden>
                  ●
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <PhotoPositionPreview
        zone={zone}
        onPosition={(positionX, positionY) => updateZone({ positionX, positionY })}
      />

      <label className="block text-[11px] font-semibold text-text-soft">
        사진선택 ({zoneLabel})
        <input
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-[11px] text-text-secondary"
          onChange={(e) => onPhotoFile(e.target.files?.[0])}
        />
      </label>

      <div>
        <p className="mb-1 text-[10px] font-semibold text-text-soft">맞춤</p>
        <div className="flex gap-1">
          {(
            [
              ['full', '가득 채우기'],
              ['contain', '맞춤'],
            ] as const
          ).map(([fit, label]) => (
            <button
              key={fit}
              type="button"
              className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                zone.photoFit === fit
                  ? 'border-green-accent bg-green-light/45 text-starbucks-green'
                  : 'border-charcoal-border text-text-secondary hover:bg-well'
              }`}
              onClick={() => updateZone({ photoFit: fit as CalendarPhotoFit })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-[11px] font-semibold text-text-soft">
        사진 농도 {opacityPct}%
        <input
          type="range"
          min={12}
          max={100}
          value={opacityPct}
          className="mt-1 w-full accent-green-accent"
          onChange={(e) =>
            updateZone({ opacity: Number(e.target.value) / 100 })
          }
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-semibold text-text-soft">
          가로 {Math.round(zone.positionX)}%
          <input
            type="range"
            min={0}
            max={100}
            value={zone.positionX}
            className="mt-0.5 w-full accent-green-accent"
            onChange={(e) =>
              updateZone({ positionX: Number(e.target.value) })
            }
          />
        </label>
        <label className="text-[10px] font-semibold text-text-soft">
          세로 {Math.round(zone.positionY)}%
          <input
            type="range"
            min={0}
            max={100}
            value={zone.positionY}
            className="mt-0.5 w-full accent-green-accent"
            onChange={(e) =>
              updateZone({ positionY: Number(e.target.value) })
            }
          />
        </label>
      </div>

      {zoneHasPhoto(zone) ? (
        <button
          type="button"
          className="w-full rounded-md border border-charcoal-border py-1.5 text-[11px] font-semibold text-text-secondary hover:bg-well"
          onClick={() => updateZone({ imageUrl: undefined })}
        >
          사진 제거 ({zoneLabel})
        </button>
      ) : null}

      {err ? <p className="text-xs text-danger">{err}</p> : null}

      <div className="flex gap-2 border-t border-border-muted pt-3">
        <Button type="button" variant="primary" className="flex-1 !min-h-9" onClick={onSave}>
          저장
        </Button>
        <Button
          type="button"
          variant="outlined"
          className="flex-1 !min-h-9"
          onClick={onReset}
        >
          기본값
        </Button>
      </div>
    </div>
  )
}

export function isCalendarDecorateActive(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco)
}

export { DEFAULT_CALENDAR_DECORATION }
