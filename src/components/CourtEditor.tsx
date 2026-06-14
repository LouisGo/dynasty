import type { PointerEvent as ReactPointerEvent } from 'react'
import { COURT_SLOTS, SIXTH_SLOT, type CourtSlotId, type Position } from '../game/types'
import { useGameStore } from '../stores/gameStore'
import { useDragAndDrop } from '../hooks/useDragAndDrop'
import { formatSlotLabel, getSlotRole } from '../utils/format'
import { getRosterCard } from '../utils/pool'
import { PlayerCardTile } from './PlayerCardTile'
import type { PlayerCard } from '../game/types'

export function CourtEditor() {
  useDragAndDrop()

  const gameState = useGameStore((s) => s.gameState)
  const selectedSlot = useGameStore((s) => s.selectedSlot)
  const draggingSlot = useGameStore((s) => s.draggingSlot)
  const revealingSlot = useGameStore((s) => s.revealingSlot)
  const openPlayerDetail = useGameStore((s) => s.openPlayerDetail)

  const rosterCards = gameState.roster.map((owned) => getRosterCard(owned))
  const rosterCardMap = new Map(rosterCards.map((card) => [card.id, card]))

  function handleSlotClick(slot: CourtSlotId) {
    const { suppressNextSlotClick } = useGameStore.getState()
    if (suppressNextSlotClick) {
      useGameStore.setState({ suppressNextSlotClick: false })
      return
    }

    const current = useGameStore.getState()
    if (!current.gameState.lineupArrangement[slot]) {
      if (current.selectedSlot) {
        current.swapSlots(current.selectedSlot, slot)
      }
      return
    }

    if (current.selectedSlot === slot) {
      useGameStore.setState({ selectedSlot: null })
      return
    }

    if (current.selectedSlot) {
      current.swapSlots(current.selectedSlot, slot)
      return
    }

    useGameStore.setState({ selectedSlot: slot })
  }

  function handleSlotPointerDown(
    slot: CourtSlotId,
    event: ReactPointerEvent<HTMLButtonElement>,
    card: PlayerCard & { pricePaid: number },
  ) {
    const chip = event.currentTarget.querySelector<HTMLElement>('.court-player-chip')
    const slotRect = event.currentTarget.getBoundingClientRect()
    const chipRect = chip?.getBoundingClientRect() ?? slotRect

    useGameStore.getState().beginDraggingSlot(
      slot,
      chipRect,
      slotRect,
      event.clientX,
      event.clientY,
      card,
    )
  }

  return (
    <section className="court-editor">
      <div
        className="court-surface"
        onPointerCancel={() => useGameStore.getState().clearDraggingSlot()}
      >
        {COURT_SLOTS.map((slot) => {
          const playerId = gameState.lineupArrangement[slot]
          const card = playerId ? rosterCardMap.get(playerId) : null
          const isStarterSlot = slot !== SIXTH_SLOT
          const isInvalid = Boolean(
            card && isStarterSlot && !card.positions.includes(slot as Position),
          )
          const isSelected = selectedSlot === slot
          const isDragging = draggingSlot === slot
          const isRevealingSlot = Boolean(card && revealingSlot === slot)

          return (
            <button
              key={slot}
              type="button"
              data-court-slot={slot}
              className={[
                'court-slot',
                `slot-${slot.toLowerCase()}`,
                card ? 'is-filled' : 'is-empty',
                isInvalid ? 'is-invalid' : '',
                isSelected ? 'is-selected' : '',
                isDragging ? 'is-dragging' : '',
                isRevealingSlot ? 'is-revealing' : '',
                getSlotRole(slot),
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSlotClick(slot)}
              onPointerDown={(event) => {
                if (card) {
                  handleSlotPointerDown(slot, event, card)
                }
              }}
            >
              <span className="court-slot-label">{formatSlotLabel(slot)}</span>
              {card ? (
                <span
                  className={[
                    'court-player-chip',
                    isRevealingSlot ? 'is-revealing' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <PlayerCardTile
                    card={card}
                    price={card.pricePaid}
                    size="mini"
                    statusLabel="可签约"
                    onLongPressOpen={openPlayerDetail}
                  />
                </span>
              ) : (
                <span className="court-slot-empty-dot" />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
