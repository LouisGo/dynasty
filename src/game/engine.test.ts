import { describe, expect, it } from 'vitest'
import legendPool from '../data/legend-pool.json'
import {
  calculateOfferPrice,
  createInitialState,
  createSeededRng,
  generateOffers,
  getPlayerWeight,
  skipOfferGroup,
  signOffer,
} from './engine'
import {
  FREE_SKIP_COUNT,
  MAX_ROUNDS,
  PAID_SKIP_COST,
  ROSTER_TARGET,
  STARTING_BUDGET,
  type GameState,
  type PlayerCard,
} from './types'

const pool = legendPool as PlayerCard[]

function buildState(overrides: Partial<GameState>): GameState {
  return {
    budgetRemaining: STARTING_BUDGET,
    round: 1,
    freeSkipsRemaining: FREE_SKIP_COUNT,
    paidSkipsUsed: 0,
    roster: [],
    currentOffers: [],
    lineupArrangement: { PG: null, SG: null, SF: null, PF: null, C: null, SIX: null },
    lastAction: '',
    result: null,
    ...overrides,
  }
}

function playGreedyRun(seed: number) {
  let state = createInitialState(pool, createSeededRng(seed))

  while (!state.result) {
    const enabled = state.currentOffers
      .filter((offer) => offer.offerState === 'enabled')
      .sort((left, right) => {
        const leftValue = left.sourceRating / left.price
        const rightValue = right.sourceRating / right.price
        if (rightValue !== leftValue) {
          return rightValue - leftValue
        }

        return right.sourceRating - left.sourceRating
      })

    state = enabled[0]
      ? signOffer(state, enabled[0].id, pool, createSeededRng(seed + state.round * 17))
      : skipOfferGroup(state, pool, createSeededRng(seed + state.round * 31))
  }

  return state
}

describe('price and supply model', () => {
  it('prices every card from OVR with a 0.7 to 1.3 random factor', () => {
    const jordan = pool.find((card) => card.id === 'michael-jordan')
    if (!jordan) {
      throw new Error('Michael Jordan test fixture missing.')
    }

    const low = calculateOfferPrice(jordan, () => 0)
    const high = calculateOfferPrice(jordan, () => 0.999999)

    expect(low).toBe(18)
    expect(high).toBe(32)
  })

  it('uses 100 - OVR as the appearance weight', () => {
    const jordan = pool.find((card) => card.id === 'michael-jordan')
    const rotation = pool.find((card) => card.sourceRating <= 85)
    if (!jordan || !rotation) {
      throw new Error('Weight test fixtures missing.')
    }

    expect(getPlayerWeight(jordan)).toBe(1)
    expect(getPlayerWeight(rotation)).toBe(100 - rotation.sourceRating)
    expect(getPlayerWeight(rotation)).toBeGreaterThan(getPlayerWeight(jordan))
  })

  it('keeps the draft pool focused on recognizable modern-era players', () => {
    const ids = new Set(pool.map((card) => card.id))

    expect(pool.length).toBeLessThanOrEqual(100)
    expect(ids.has('bill-russell')).toBe(true)
    expect(ids.has('wilt-chamberlain')).toBe(true)
    expect(ids.has('bob-cousy')).toBe(false)
    expect(ids.has('george-mikan')).toBe(false)
    expect(ids.has('oscar-robertson')).toBe(false)
    expect(ids.has('jerry-west')).toBe(false)
  })

  it('generates four offers and keeps one signable when any legal player is affordable', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = createInitialState(pool, createSeededRng(seed))
      expect(state.currentOffers).toHaveLength(4)
      expect(state.currentOffers.some((offer) => offer.offerState === 'enabled')).toBe(true)
    }
  })
})

describe('draft loop', () => {
  it('signs one unique player, spends the dynamic price, and advances the round', () => {
    const player = pool.find((card) => card.id === 'stephen-curry')
    if (!player) {
      throw new Error('Stephen Curry test fixture missing.')
    }

    const state = buildState({
      currentOffers: [{ ...player, price: 16, offerState: 'enabled' }],
    })
    const next = signOffer(state, player.id, pool, createSeededRng(8))

    expect(next.roster).toEqual([
      {
        playerId: player.id,
        pricePaid: 16,
        assignedSlot: 'PG',
      },
    ])
    expect(next.budgetRemaining).toBe(84)
    expect(next.round).toBe(2)
  })

  it('spends free skips first, then paid skips', () => {
    const initial = createInitialState(pool, createSeededRng(15))
    const afterFree = skipOfferGroup(initial, pool, createSeededRng(16))

    expect(afterFree.freeSkipsRemaining).toBe(FREE_SKIP_COUNT - 1)
    expect(afterFree.budgetRemaining).toBe(STARTING_BUDGET)
    expect(afterFree.round).toBe(2)

    const paidState = buildState({
      round: 4,
      freeSkipsRemaining: 0,
      budgetRemaining: 44,
      currentOffers: generateOffers([], 44, buildState({}).lineupArrangement, pool, createSeededRng(4)),
    })
    const afterPaid = skipOfferGroup(paidState, pool, createSeededRng(17))

    expect(afterPaid.paidSkipsUsed).toBe(1)
    expect(afterPaid.budgetRemaining).toBe(44 - PAID_SKIP_COST)
    expect(afterPaid.round).toBe(5)
  })

  it('prevents duplicate players from being signed again', () => {
    const player = pool.find((card) => card.id === 'stephen-curry')
    if (!player) {
      throw new Error('Stephen Curry test fixture missing.')
    }

    const arrangement = { PG: player.id, SG: null, SF: null, PF: null, C: null, SIX: null }
    const offers = generateOffers(
      [{ playerId: player.id, pricePaid: 16, assignedSlot: 'PG' }],
      84,
      arrangement,
      [player],
      createSeededRng(20),
    )

    expect(offers[0].offerState).toBe('duplicate')
  })
})

describe('run completion and scoring', () => {
  it('ends immediately when six lineup slots are filled', () => {
    const resultState = playGreedyRun(101)

    expect(resultState.result).not.toBeNull()
    expect(resultState.roster.length).toBeLessThanOrEqual(ROSTER_TARGET)
    expect(resultState.result?.gameOverReason).toBe('lineup-complete')
    expect(resultState.result?.starters.length).toBe(5)
    expect(resultState.result?.sixthMan?.playerId).toBeTruthy()
    expect(resultState.result?.dynastyScore).toBeGreaterThan(0)
  })

  it('uses the documented score, record, and championship odds math', () => {
    const state = buildState({
      round: 6,
      budgetRemaining: 1,
      roster: [
        { playerId: 'stephen-curry', pricePaid: 16, assignedSlot: 'PG' },
        { playerId: 'michael-jordan', pricePaid: 29, assignedSlot: 'SG' },
        { playerId: 'lebron-james', pricePaid: 30, assignedSlot: 'SF' },
        { playerId: 'tim-duncan', pricePaid: 18, assignedSlot: 'PF' },
        { playerId: 'shaquille-oneal', pricePaid: 20, assignedSlot: 'C' },
        { playerId: 'kobe-bryant', pricePaid: 17, assignedSlot: 'SIX' },
      ],
      lineupArrangement: {
        PG: 'stephen-curry',
        SG: 'michael-jordan',
        SF: 'lebron-james',
        PF: 'tim-duncan',
        C: 'shaquille-oneal',
        SIX: 'kobe-bryant',
      },
      currentOffers: [
        {
          ...(pool.find((card) => card.id === 'dennis-rodman') as PlayerCard),
          price: 10,
          offerState: 'enabled',
        },
      ],
    })
    const finished = signOffer(
      {
        ...state,
        roster: state.roster.slice(0, 5),
        lineupArrangement: { ...state.lineupArrangement, SIX: null },
        currentOffers: [
          {
            ...(pool.find((card) => card.id === 'kobe-bryant') as PlayerCard),
            price: 17,
            offerState: 'enabled',
          },
        ],
        budgetRemaining: 18,
      },
      'kobe-bryant',
      pool,
      createSeededRng(99),
    )

    expect(finished.result?.dynastyScore).toBeGreaterThanOrEqual(90)
    expect(finished.result?.projectedWins).toBe(
      Math.round(15 + (finished.result?.dynastyScore ?? 0) * 0.67),
    )
    expect(finished.result?.championshipOdds).toBeLessThan(100)
  })

  it('can end at the 20 round limit without a full lineup', () => {
    const state = createInitialState(pool, createSeededRng(7))
    const roundTwenty = {
      ...state,
      round: MAX_ROUNDS,
    }
    const finished = skipOfferGroup(roundTwenty, pool, createSeededRng(8))

    expect(finished.result?.gameOverReason).toBe('round-limit')
  })
})
