import { useEffect, useRef, useState } from 'react'

const SCROLL_DELTA = 6
const TOP_REVEAL_Y = 12

/** 스크롤을 내리면(콘텐츠가 위로) 숨기고, 올리면 다시 표시 */
export function useScrollHeaderVisibility(): boolean {
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    lastY.current = window.scrollY

    const update = () => {
      const y = window.scrollY
      const delta = y - lastY.current

      if (y <= TOP_REVEAL_Y) {
        setVisible(true)
      } else if (delta > SCROLL_DELTA) {
        setVisible(false)
      } else if (delta < -SCROLL_DELTA) {
        setVisible(true)
      }

      lastY.current = y
      ticking.current = false
    }

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return visible
}
