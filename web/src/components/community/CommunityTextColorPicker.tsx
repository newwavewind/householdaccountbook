import type { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import {
  COMMUNITY_TEXT_HUES,
  colorFromHueGradient,
  gradientCssForHue,
  type TextHueId,
} from '../../community/communityTextColors'

type Props = {
  editor: Editor
  disabled?: boolean
}

export function CommunityTextColorPicker({ editor, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [hueId, setHueId] = useState<TextHueId>('red')
  const wrapRef = useRef<HTMLDivElement>(null)

  const hueOpt = COMMUNITY_TEXT_HUES.find((h) => h.id === hueId) ?? COMMUNITY_TEXT_HUES[0]
  const currentColor = (editor.getAttributes('textStyle').color as string | undefined) ?? ''

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const applyColor = (hex: string) => {
    editor.chain().focus().setColor(hex).run()
  }

  const pickGradient = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hueOpt.hue == null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const t = (e.clientX - rect.left) / rect.width
    applyColor(colorFromHueGradient(hueOpt.hue, t))
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="글자색"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-1 rounded border border-border-subtle bg-surface-raised px-2 text-[10px] font-semibold text-text-secondary hover:bg-green-light/25 disabled:opacity-40"
      >
        <span
          className="h-3.5 w-3.5 rounded-full border border-black/15 shadow-inner"
          style={{ backgroundColor: currentColor || '#111111' }}
          aria-hidden
        />
        색
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="글자색 선택"
          className="absolute left-0 top-full z-[70] mt-1 w-[min(100vw-2rem,14rem)] rounded-lg border border-border-subtle bg-surface-raised p-2 shadow-lg"
        >
          <p className="mb-1.5 text-[10px] font-medium text-text-soft">색상</p>
          <div className="grid grid-cols-4 gap-1">
            {COMMUNITY_TEXT_HUES.map((h) => (
              <button
                key={h.id}
                type="button"
                title={h.label}
                aria-label={h.label}
                aria-pressed={hueId === h.id}
                onClick={() => {
                  setHueId(h.id)
                  if (h.solid) applyColor(h.solid)
                }}
                className={`flex flex-col items-center gap-0.5 rounded border px-1 py-1 text-[9px] font-semibold transition-colors ${
                  hueId === h.id
                    ? 'border-green-accent bg-green-light/40'
                    : 'border-border-muted hover:border-green-accent/40'
                }`}
              >
                <span
                  className="h-5 w-5 rounded-full border border-black/12"
                  style={{
                    backgroundColor:
                      h.solid ?? (h.hue != null ? `hsl(${h.hue} 85% 48%)` : '#888'),
                  }}
                />
                {h.label}
              </button>
            ))}
          </div>
          {hueOpt.hue != null ? (
            <>
              <p className="mb-1 mt-2 text-[10px] font-medium text-text-soft">
                농도 (연함 ← → 진함)
              </p>
              <div
                role="slider"
                aria-label="색 농도"
                tabIndex={0}
                className="h-7 cursor-crosshair rounded border border-border-muted"
                style={{ background: gradientCssForHue(hueOpt.hue) }}
                onClick={pickGradient}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                  e.preventDefault()
                  const step = e.key === 'ArrowRight' ? 0.05 : -0.05
                  const base = 0.5
                  applyColor(colorFromHueGradient(hueOpt.hue!, base + step))
                }}
              />
            </>
          ) : null}
          <button
            type="button"
            className="mt-2 w-full rounded border border-border-muted py-1 text-[10px] text-text-soft hover:bg-well"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            글자색 해제
          </button>
        </div>
      ) : null}
    </div>
  )
}
