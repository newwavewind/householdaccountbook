import { useEffect, useRef, useState, type ReactNode } from 'react'

const DRAG_THRESHOLD_PX = 6

type Props = {
  x: number
  y: number
  zIndex: number
  dragEnabled: boolean
  onMove: (x: number, y: number) => void
  onTap: () => void
  children: ReactNode
}

export function StickyNoteDraggable({
  x,
  y,
  zIndex,
  dragEnabled,
  onMove,
  onTap,
  children,
}: Props) {
  const [pos, setPos] = useState({ x, y })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  })

  useEffect(() => {
    if (!dragging) setPos({ x, y })
  }, [x, y, dragging])

  const canStartDrag = (target: EventTarget | null) => {
    if (!dragEnabled) return false
    const el = target as HTMLElement | null
    if (!el) return false
    if (el.closest('[data-sticky-resize]')) return false
    if (el.closest('button, a, input, select, textarea, [contenteditable="true"]')) {
      return false
    }
    if (el.closest('[data-sticky-no-drag]')) return false
    if (el.closest('[data-sticky-expanded]')) {
      return !!el.closest('[data-sticky-drag-handle]')
    }
    return true
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (!canStartDrag(e.target)) return

    e.preventDefault()
    const node = e.currentTarget
    node.setPointerCapture(e.pointerId)

    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (
      !dragRef.current.moved &&
      Math.hypot(dx, dy) < DRAG_THRESHOLD_PX
    ) {
      return
    }
    dragRef.current.moved = true
    setPos({
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    })
  }

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const node = e.currentTarget
    if (node.hasPointerCapture(e.pointerId)) {
      node.releasePointerCapture(e.pointerId)
    }

    const { moved, originX, originY } = dragRef.current
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const nextX = originX + dx
    const nextY = originY + dy

    dragRef.current.active = false
    setDragging(false)

    if (moved) {
      onMove(nextX, nextY)
      setPos({ x: nextX, y: nextY })
    } else {
      onTap()
    }
  }

  return (
    <div
      className={[
        'absolute left-0 top-0 touch-none select-none',
        dragEnabled ? 'cursor-grab' : '',
        dragging ? 'cursor-grabbing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: dragging ? 60 : zIndex,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
    >
      {children}
    </div>
  )
}
