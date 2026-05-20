import {
  hasCalendarPhoto,
  type CalendarDecoration,
} from './calendarDecorationStorage'

const PHOTO_MAX_BYTES = 5 * 1024 * 1024

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
  err,
  setErr,
}: Props) {
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
      onChange({ ...decoration, imageUrl: url })
    }
    reader.onerror = () => setErr('사진을 불러오지 못했습니다.')
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold text-text-soft">
        사진선택
        <input
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-[11px] text-text-secondary"
          onChange={(e) => onPhotoFile(e.target.files?.[0])}
        />
      </label>
      {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}
    </div>
  )
}

export function isCalendarDecorateActive(deco: CalendarDecoration): boolean {
  return hasCalendarPhoto(deco)
}
