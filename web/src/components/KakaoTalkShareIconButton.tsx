import { useState } from 'react'

type Props = {
  /** 공유할 본문(순수 텍스트) */
  text: string
  /** 맨 앞에 붙는 한 줄(제목) */
  titlePrefix?: string
  /** 헤더 버튼 스타일 등 */
  className?: string
  disabled?: boolean
}

export function KakaoTalkShareIconButton({
  text,
  titlePrefix,
  className,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false)

  const fullText = titlePrefix?.trim()
    ? `${titlePrefix.trim()}\n\n${text.trim()}`
    : text.trim()

  return (
    <button
      type="button"
      className={className}
      aria-label="카카오톡으로 공유"
      title="카카오톡으로 공유"
      disabled={disabled || busy}
      onClick={async () => {
        if (!fullText.trim()) {
          window.alert('공유할 내용이 없습니다.')
          return
        }
        setBusy(true)
        try {
          const { shareTextToKakaoOrFallback } = await import('../lib/kakaoShare')
          await shareTextToKakaoOrFallback(fullText)
        } catch (e) {
          console.error(e)
          window.alert(
            '공유에 실패했습니다. 카카오 콘솔에 이 사이트 도메인이 등록돼 있는지 확인해 주세요.',
          )
        } finally {
          setBusy(false)
        }
      }}
    >
      <span
        className="inline-flex min-w-[1.35rem] items-center justify-center rounded bg-[#FEE500] px-1 py-px text-[0.6rem] font-extrabold leading-none text-[#191919] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
        aria-hidden
      >
        톡
      </span>
    </button>
  )
}
