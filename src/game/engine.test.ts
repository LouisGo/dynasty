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
    roster: [],
    currentOffers: [],
    seenOfferIds: [],
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
  it('prices cards from OVR with tier-specific random factors', () => {
    const jordan = pool.find((card) => card.id === 'michael-jordan')
    const thomas = pool.find((card) => card.id === 'isiah-thomas')
    const rotation = pool.find((card) => card.id === 'john-wall')
    if (!jordan || !thomas || !rotation) {
      throw new Error('Price test fixtures missing.')
    }

    expect(calculateOfferPrice(jordan, () => 0)).toBe(23)
    expect(calculateOfferPrice(jordan, () => 0.999999)).toBe(29)

    expect(calculateOfferPrice(thomas, () => 0)).toBe(17)
    expect(calculateOfferPrice(thomas, () => 0.999999)).toBe(23)

    expect(calculateOfferPrice(rotation, () => 0)).toBe(8)
    expect(calculateOfferPrice(rotation, () => 0.999999)).toBe(12)
  })

  it('uses card rarity weight as the appearance weight within each offer slot', () => {
    const jordan = pool.find((card) => card.id === 'michael-jordan')
    const rotation = pool.find((card) => card.sourceRating <= 85)
    if (!jordan || !rotation) {
      throw new Error('Weight test fixtures missing.')
    }

    expect(getPlayerWeight(jordan)).toBe(jordan.rarityWeight)
    expect(getPlayerWeight(rotation)).toBe(rotation.rarityWeight)
    expect(getPlayerWeight(rotation)).toBeGreaterThan(getPlayerWeight(jordan))
  })

  it('keeps the draft pool expanded with recognizable modern-era and current stars', () => {
    const ids = new Set(pool.map((card) => card.id))

    expect(pool).toHaveLength(150)
    expect(ids.has('bill-russell')).toBe(true)
    expect(ids.has('wilt-chamberlain')).toBe(true)
    expect(ids.has('shai-gilgeous-alexander')).toBe(true)
    expect(ids.has('victor-wembanyama')).toBe(true)
    expect(ids.has('jalen-brunson')).toBe(true)
    expect(ids.has('anthony-edwards')).toBe(true)
    expect(ids.has('domantas-sabonis')).toBe(true)
    expect(ids.has('jalen-duren')).toBe(true)
    expect(ids.has('bob-cousy')).toBe(false)
    expect(ids.has('george-mikan')).toBe(false)
    expect(ids.has('oscar-robertson')).toBe(false)
    expect(ids.has('jerry-west')).toBe(false)
  })

  it('keeps current stars below established all-time peak tiers unless their resume supports it', () => {
    const byId = new Map(pool.map((card) => [card.id, card]))

    expect(byId.get('dwyane-wade')?.sourceRating).toBeGreaterThan(
      byId.get('jaylen-brown')?.sourceRating ?? 0,
    )
    expect(byId.get('shai-gilgeous-alexander')?.sourceRating).toBeGreaterThanOrEqual(
      byId.get('jalen-brunson')?.sourceRating ?? 0,
    )
    expect(byId.get('victor-wembanyama')?.sourceRating).toBeLessThan(
      byId.get('tim-duncan')?.sourceRating ?? 0,
    )
  })

  it('attaches sourced multidimensional ratings when 2K attribute snapshots exist', () => {
    const byId = new Map(pool.map((card) => [card.id, card]))

    expect(byId.get('michael-jordan')?.ratingModelVersion).toBe('2k-attributes-v1')
    expect(byId.get('michael-jordan')?.attributeSourceStatus).toBe('verified-2k-snapshot')
    expect(byId.get('michael-jordan')?.ratings).toEqual({
      offense: 91,
      defense: 90,
      physical: 94,
      mentality: 96,
    })
    expect(byId.get('dennis-rodman')?.ratings).toEqual({
      offense: 45,
      defense: 94,
      physical: 86,
      mentality: 69,
    })
  })

  it('fills estimated multidimensional ratings for players without verified snapshots', () => {
    const carter = pool.find((card) => card.id === 'vince-carter')

    expect(carter?.ratings).toEqual({
      offense: 89,
      defense: 88,
      physical: 90,
      mentality: 90,
    })
    expect(carter?.sourceAttributes).not.toBeNull()
    expect(carter?.attributeSourceUrl).toBeNull()
    expect(carter?.attributeSourceStatus).toBe('estimated-archetype-v1')
  })

  it('keeps every player covered by either verified or estimated multidimensional ratings', () => {
    expect(pool.every((card) => card.ratings !== null)).toBe(true)
    expect(pool.filter((card) => card.attributeSourceStatus === 'verified-2k-snapshot')).toHaveLength(
      8,
    )
    expect(pool.filter((card) => card.attributeSourceStatus === 'estimated-archetype-v1')).toHaveLength(
      142,
    )
  })

  it('generates four offers and keeps one signable when any legal player is affordable', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = createInitialState(pool, createSeededRng(seed))
      expect(state.currentOffers).toHaveLength(4)
      expect(state.currentOffers.some((offer) => offer.offerState === 'enabled')).toBe(true)
    }
  })

  it('uses structured offer slots for star, starter, starter, and rotation cards', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = createInitialState(pool, createSeededRng(seed))
      const [star, starterA, starterB, rotation] = state.currentOffers

      expect(['T0', 'T1', 'T2']).toContain(star.tier)
      expect(['T2', 'T3']).toContain(starterA.tier)
      expect(['T2', 'T3']).toContain(starterB.tier)
      expect(['T3', 'T4']).toContain(rotation.tier)
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

  it('spends free skips without charging budget', () => {
    const initial = createInitialState(pool, createSeededRng(15))
    const afterFree = skipOfferGroup(initial, pool, createSeededRng(16))

    expect(afterFree.freeSkipsRemaining).toBe(FREE_SKIP_COUNT - 1)
    expect(afterFree.budgetRemaining).toBe(STARTING_BUDGET)
    expect(afterFree.round).toBe(2)
  })

  it('does not allow skipping after free skips are exhausted', () => {
    const state = buildState({
      freeSkipsRemaining: 0,
      currentOffers: generateOffers([], STARTING_BUDGET, buildState({}).lineupArrangement, pool),
    })

    expect(() => skipOfferGroup(state, pool, createSeededRng(17))).toThrow(
      'No free skips remaining.',
    )
  })

  it('removes previously offered cards from future offer groups', () => {
    const initial = createInitialState(pool, createSeededRng(15))
    const firstOfferIds = new Set(initial.currentOffers.map((offer) => offer.id))
    const afterSkip = skipOfferGroup(initial, pool, createSeededRng(16))

    expect(afterSkip.currentOffers.every((offer) => !firstOfferIds.has(offer.id))).toBe(true)
    expect(afterSkip.seenOfferIds).toHaveLength(8)
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

    expect(finished.result?.dynastyScore).toBeGreaterThanOrEqual(85)
    expect(finished.result?.strengthScore).toBeGreaterThan(50)
    expect(finished.result?.superstarScore).toBeGreaterThan(18)
    expect(finished.result?.budgetScore).toBe(5)
    expect(finished.result?.offenseScore).toBeGreaterThan(80)
    expect(finished.result?.defenseScore).toBeGreaterThan(80)
    expect(finished.result?.projectedWins).toBe(
      Math.round(35 + (finished.result?.dynastyScore ?? 0) * 0.45),
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
