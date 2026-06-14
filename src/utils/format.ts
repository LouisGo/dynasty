import { SIXTH_SLOT, type CourtSlotId, type PlayerCard, type Position, type Tier } from '../game/types'

export function formatPositions(positions: Position[]) {
  return positions.join(' / ')
}

export function getDisplayName(card: Pick<PlayerCard, 'name' | 'chineseName'>) {
  return card.chineseName || card.name
}

export function tierClassName(tier: Tier) {
  return `tier-${tier.toLowerCase()}`
}

export function formatSlotLabel(slot: CourtSlotId) {
  return slot === SIXTH_SLOT ? '第六人' : slot
}

export function getSlotRole(slot: CourtSlotId) {
  return slot === SIXTH_SLOT ? 'bench' : 'starter'
}

export function formatPriceLabel(price: number) {
  return price === 0 ? '免' : `${price}`
}

export function formatRatingValue(value: number | null | undefined) {
  return typeof value === 'number' ? Math.round(value) : null
}
