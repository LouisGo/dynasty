import { useEffect } from 'react'
import type { CourtSlotId } from '../game/types'
import { useGameStore } from '../stores/gameStore'

export function useDragAndDrop() {
  useEffect(() => {
    function moveDragAt(clientX: number, clientY: number) {
      const { dragPreview } = useGameStore.getState()
      if (!dragPreview) return

      useGameStore.setState({
        dragPreview: {
          ...dragPreview,
          x: clientX - dragPreview.offsetX,
          y: clientY - dragPreview.offsetY,
        },
        suppressNextSlotClick: true,
      })
    }

    function finishDragAt(clientX: number, clientY: number) {
      const { draggingSlot } = useGameStore.getState()
      if (!draggingSlot) return

      const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null
      const slotElement = target?.closest<HTMLElement>('[data-court-slot]')
      const targetSlot = (slotElement?.dataset.courtSlot as CourtSlotId) ?? null

      if (targetSlot && targetSlot !== draggingSlot) {
        useGameStore.getState().swapSlots(draggingSlot, targetSlot)
      } else {
        useGameStore.getState().clearDraggingSlot()
      }
    }

    function clearDrag() {
      useGameStore.getState().clearDraggingSlot()
    }

    function handleWindowPointerMove(event: PointerEvent) {
      moveDragAt(event.clientX, event.clientY)
    }

    function handleWindowPointerUp(event: PointerEvent) {
      finishDragAt(event.clientX, event.clientY)
    }

    function handleWindowMouseUp(event: MouseEvent) {
      finishDragAt(event.clientX, event.clientY)
    }

    function handleWindowTouchEnd(event: TouchEvent) {
      const touch = event.changedTouches[0]
      if (touch) {
        finishDragAt(touch.clientX, touch.clientY)
      } else {
        clearDrag()
      }
    }

    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointercancel', clearDrag)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('touchend', handleWindowTouchEnd)
    window.addEventListener('touchcancel', clearDrag)

    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointercancel', clearDrag)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      window.removeEventListener('touchend', handleWindowTouchEnd)
      window.removeEventListener('touchcancel', clearDrag)
    }
  }, [])
}
