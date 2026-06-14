import type { CSSProperties } from 'react'
import { useGameStore } from '../stores/gameStore'
import { PlayerCardTile } from './PlayerCardTile'

export function DragPreview() {
  const dragPreview = useGameStore((s) => s.dragPreview)

  if (!dragPreview) return null

  return (
    <div
      className="drag-preview"
      style={
        {
          '--drag-x': `${dragPreview.x}px`,
          '--drag-y': `${dragPreview.y}px`,
          '--drag-w': `${dragPreview.width}px`,
          '--drag-h': `${dragPreview.height}px`,
        } as CSSProperties &
        Record<'--drag-x' | '--drag-y' | '--drag-w' | '--drag-h', string>
      }
    >
      <PlayerCardTile
        card={dragPreview.card}
        price={dragPreview.price}
        size="mini"
        statusLabel="可签约"
      />
    </div>
  )
}
