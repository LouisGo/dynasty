import { COURT_SLOTS, SIXTH_SLOT, type GameOverReason, type GameState, type OfferCard, type ResultSummary } from '../game/types'
import { poolIndex } from './pool'

export function getResultReason(reason: GameOverReason) {
  if (reason === 'lineup-complete') {
    return '六人阵容完成'
  }

  if (reason === 'budget-exhausted') {
    return '预算不足'
  }

  return '20 回合结束'
}

export function getMetricTone(value: number, excellent: number, good: number) {
  if (value >= excellent) {
    return 'metric-excellent'
  }

  if (value >= good) {
    return 'metric-good'
  }

  return 'metric-normal'
}

export function getResultLineup(result: ResultSummary) {
  return COURT_SLOTS.map((slot) => {
    if (slot === SIXTH_SLOT) {
      const card = result.sixthMan ? poolIndex.get(result.sixthMan.playerId) : null
      return {
        slot,
        card,
        pricePaid: result.sixthMan?.pricePaid ?? 0,
      }
    }

    const starter = result.starters.find((item) => item.slot === slot)
    const card = starter ? poolIndex.get(starter.playerId) : null
    return {
      slot,
      card,
      pricePaid: starter?.pricePaid ?? 0,
    }
  })
}

export function getOfferStateText(offer: OfferCard) {
  if (offer.isFreeOffer && offer.offerState === 'enabled') {
    return '免费签约'
  }

  if (offer.offerState === 'too-expensive') {
    return '预算不足'
  }

  if (offer.offerState === 'duplicate') {
    return '已拥有'
  }

  if (offer.offerState === 'slot-blocked') {
    return '无可用位置'
  }

  return '可签约'
}

export function getTargetSlotForOffer(offer: OfferCard, arrangement: GameState['lineupArrangement']) {
  const starterSlot = offer.positions.find((position) => arrangement[position] === null)
  return starterSlot ?? SIXTH_SLOT
}
