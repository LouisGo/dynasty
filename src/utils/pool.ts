import legendPoolData from '../data/legend-pool.json'
import { PAID_SKIP_STEP_COST, type DraftedPlayer, type PlayerCard } from '../game/types'

export const pool = legendPoolData as PlayerCard[]
export const poolIndex = new Map(pool.map((card) => [card.id, card]))

export const getPaidSkipCost = (paidSkipsUsed: number) => (paidSkipsUsed + 1) * PAID_SKIP_STEP_COST

export function getRosterCard(owned: DraftedPlayer) {
  const card = poolIndex.get(owned.playerId)
  if (!card) {
    throw new Error(`Missing player ${owned.playerId}`)
  }

  return {
    ...card,
    pricePaid: owned.pricePaid,
    assignedSlot: owned.assignedSlot,
  }
}

export function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000)
}
