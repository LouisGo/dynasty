import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'

interface UseLongPressOptions {
  duration?: number
  moveThreshold?: number
  onLongPress: () => void
}

export function useLongPress({
  duration = 520,
  moveThreshold = 10,
  onLongPress,
}: UseLongPressOptions) {
  const pressTimerRef = useRef<number | null>(null)
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTriggeredRef = useRef(false)
  const [isPressing, setIsPressing] = useState(false)

  useEffect(
    () => () => {
      if (pressTimerRef.current !== null) {
        window.clearTimeout(pressTimerRef.current)
      }
    },
    [],
  )

  function clearPressState() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartRef.current = null
    setIsPressing(false)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Only respond to touch/pen, or primary mouse button
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    pressStartRef.current = { x: event.clientX, y: event.clientY }
    setIsPressing(true)
    pressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      pressTimerRef.current = null
      pressStartRef.current = null
      setIsPressing(false)
      onLongPress()
    }, duration)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pressStartRef.current
    if (!start) {
      return
    }

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (distance > moveThreshold) {
      clearPressState()
    }
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!longPressTriggeredRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    longPressTriggeredRef.current = false
  }

  return {
    isPressing,
    longPressHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: clearPressState,
      onPointerCancel: clearPressState,
      onPointerLeave: clearPressState,
      onClickCapture: handleClickCapture,
      onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => event.preventDefault(),
    },
  }
}
