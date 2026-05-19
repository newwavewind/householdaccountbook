import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useMemoDefaults } from '../memo/MemoDefaultsContext'
import {
  CALENDAR_FONT_SIZES,
  CALENDAR_RICH_FONTS,
} from '../calendar/calendarRichTextFonts'
import { DEFAULT_MEMO_DEFAULTS } from '../memo/memoDefaultsStorage'

export default function SettingsPage() {
  const { defaults, patchDefaults, setDefaults } = useMemoDefaults()

  const previewStyle: CSSProperties = {
    fontFamily: defaults.fontFamily || undefined,
    fontSize: defaults.fontSize || '0.875rem',
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-starbucks-green md:text-2xl">
            환경 설정
          </h1>
          <p className="mt-1 text-sm text-text-soft">
            메모·일정 입력 시 기본으로 쓰일 글꼴과 글자 크기입니다.
          </p>
        </div>
        <Link
          to="/calendar"
          className="text-sm font-semibold text-starbucks-green underline-offset-2 hover:underline"
        >
          ← 돌아가기
        </Link>
      </div>

      <Card className="space-y-6 p-4 md:p-6">
        <section aria-labelledby="memo-font-heading">
          <h2
            id="memo-font-heading"
            className="text-base font-semibold text-text-primary"
          >
            메모 글꼴
          </h2>
          <p className="mt-1 text-sm text-text-soft">
            달력 일정·스티커 메모에서 선택할 수 있는 글꼴과 동일합니다.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {CALENDAR_RICH_FONTS.map((f) => {
              const selected = defaults.fontFamily === f.value
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => patchDefaults({ fontFamily: f.value })}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    selected
                      ? 'border-green-accent bg-green-light/50 ring-2 ring-green-accent/35'
                      : 'border-border-subtle bg-surface-raised hover:border-green-accent/40 hover:bg-green-light/25'
                  }`}
                  style={{ fontFamily: f.value || undefined }}
                >
                  <span className="font-semibold text-text-primary">{f.label}</span>
                  <span className="mt-0.5 block text-xs text-text-soft">
                    가나다 ABC 123
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="memo-size-heading">
          <h2
            id="memo-size-heading"
            className="text-base font-semibold text-text-primary"
          >
            메모 글자 크기
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CALENDAR_FONT_SIZES.map((s) => {
              const selected = defaults.fontSize === s.value
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => patchDefaults({ fontSize: s.value })}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? 'border-green-accent bg-green-accent text-on-accent'
                      : 'border-border-subtle bg-surface-raised text-text-secondary hover:bg-green-light/30'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </section>

        <section
          aria-labelledby="memo-preview-heading"
          className="rounded-lg border border-border-subtle bg-ceramic/60 p-4"
        >
          <h2
            id="memo-preview-heading"
            className="text-sm font-semibold text-text-soft"
          >
            미리보기
          </h2>
          <p className="mt-2 leading-relaxed text-text-primary" style={previewStyle}>
            오늘 일정과 메모를 이렇게 적어 보세요.
            <br />
            새 메모를 열면 위 설정이 자동으로 적용됩니다.
          </p>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-border-muted pt-4">
          <Button
            type="button"
            variant="outlined"
            onClick={() => setDefaults({ ...DEFAULT_MEMO_DEFAULTS })}
          >
            기본값으로 초기화
          </Button>
        </div>
      </Card>
    </main>
  )
}
