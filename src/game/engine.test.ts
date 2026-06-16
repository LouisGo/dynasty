import { describe, expect, it } from 'vitest'
import legendPool from '../data/legend-pool.json'
import { buildPlayerPool } from './test-utils'
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
  PAID_SKIP_STEP_COST,
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
    seenOfferIds: [],
    lineupArrangement: { PG: null, SG: null, SF: null, PF: null, C: null, SIX: null },
    lastAction: '',
    result: null,
    freeDiscountCounter: 0,
    halfPriceDiscountCounter: 0,
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

function finishLineup(
  lineup: GameState['lineupArrangement'],
  sixthPlayerId: string,
  budgetRemaining = 20,
) {
  const sixth = pool.find((card) => card.id === sixthPlayerId)
  if (!sixth) {
    throw new Error(`${sixthPlayerId} test fixture missing.`)
  }

  const roster = (['PG', 'SG', 'SF', 'PF', 'C'] as const).map((slot) => {
    const playerId = lineup[slot]
    if (!playerId) {
      throw new Error(`${slot} fixture missing.`)
    }

    return { playerId, pricePaid: 0, assignedSlot: slot }
  })

  return signOffer(
    buildState({
      round: 6,
      budgetRemaining,
      roster,
      lineupArrangement: { ...lineup, SIX: null },
      currentOffers: [{ ...sixth, price: 0, originalPrice: 0, offerState: 'enabled' }],
    }),
    sixthPlayerId,
    pool,
    createSeededRng(99),
  )
}

function expectPeakValue(byId: Map<string, PlayerCard>, playerId: string, expected: number) {
  const player = byId.get(playerId)
  if (!player) {
    throw new Error(`${playerId} peak test fixture missing.`)
  }

  expect(player.peakImpact.peakValue).toBe(expected)
}

describe('price and supply model', () => {
  it('prices cards from OVR with fixed pricing', () => {
    const jordan = pool.find((card) => card.id === 'michael-jordan')
    const thomas = pool.find((card) => card.id === 'isiah-thomas')
    const rotation = pool.find((card) => card.id === 'demar-derozan')
    if (!jordan || !thomas || !rotation) {
      throw new Error('Price test fixtures missing.')
    }

    // Fixed prices: OVR - 74
    expect(calculateOfferPrice(jordan)).toBe(25)
    expect(calculateOfferPrice(thomas)).toBe(20)
    expect(calculateOfferPrice(rotation)).toBe(11)
  })

  it('can turn generated offers into free signable cards with rng=0', () => {
    const result = generateOffers(
      [],
      0,
      buildState({}).lineupArrangement,
      pool,
      () => 0,
    )

    expect(result.offers).toHaveLength(4)
    expect(result.offers.every((offer) => offer.discountType === 'free')).toBe(true)
    expect(result.offers.every((offer) => offer.price === 0)).toBe(true)
    expect(result.offers.some((offer) => offer.offerState === 'enabled')).toBe(true)
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

  it('curates the draft pool to dynasty-level players while filling historical gaps', () => {
    const ids = new Set(pool.map((card) => card.id))

    expect(pool).toHaveLength(120)
    expect(ids.has('bill-russell')).toBe(true)
    expect(ids.has('wilt-chamberlain')).toBe(true)
    expect(ids.has('shai-gilgeous-alexander')).toBe(true)
    expect(ids.has('victor-wembanyama')).toBe(true)
    expect(ids.has('jalen-brunson')).toBe(true)
    expect(ids.has('anthony-edwards')).toBe(true)
    expect(ids.has('domantas-sabonis')).toBe(true)
    expect(ids.has('oscar-robertson')).toBe(true)
    expect(ids.has('jerry-west')).toBe(true)
    expect(ids.has('elgin-baylor')).toBe(true)
    expect(ids.has('john-wall')).toBe(false)
    expect(ids.has('kristaps-porzingis')).toBe(false)
    expect(ids.has('jalen-duren')).toBe(false)
    expect(ids.has('bob-cousy')).toBe(false)
    expect(ids.has('george-mikan')).toBe(false)
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

  it('attaches sourced 2K attributes when snapshots exist without exposing stale core ratings', () => {
    const byId = new Map(pool.map((card) => [card.id, card]))
    const jordan = byId.get('michael-jordan') as PlayerCard
    const rodman = byId.get('dennis-rodman') as PlayerCard

    expect(jordan.ratingModelVersion).toBe('2k-attributes-v1')
    expect(jordan.attributeSourceStatus).toBe('verified-2k-snapshot')
    expect(jordan.sourceAttributes?.groups.outsideScoring).toBe(95)
    expect(jordan.sourceAttributes?.groups.defense).toBe(94)
    expect(rodman.sourceAttributes?.groups.defense).toBe(92)
    expect('ratings' in jordan).toBe(false)
  })

  it('fills estimated source attributes for players without verified snapshots', () => {
    const barkley = pool.find((card) => card.id === 'charles-barkley')

    expect(barkley?.sourceAttributes).not.toBeNull()
    expect(barkley?.sourceAttributes?.groups.rebounding).toBeGreaterThanOrEqual(90)
    expect(barkley?.attributeSourceUrl).toBeNull()
    expect(barkley?.attributeSourceStatus).toBe('estimated-archetype-v1')
  })

  it('keeps every player covered by either verified or estimated source attributes and peak impact', () => {
    expect(pool.every((card) => card.sourceAttributes !== null)).toBe(true)
    expect(pool.every((card) => card.peakImpact !== null)).toBe(true)
    expect(pool.every((card) => !('ratings' in card))).toBe(true)
    expect(pool.filter((card) => card.attributeSourceStatus === 'verified-2k-snapshot')).toHaveLength(
      114,
    )
    expect(pool.filter((card) => card.attributeSourceStatus === 'estimated-archetype-v1')).toHaveLength(
      6,
    )
  })

  it('calibrates representative peak impact overrides for specialists and missing-license stars', () => {
    const byId = new Map(pool.map((card) => [card.id, card]))

    expect(byId.get('stephen-curry')?.peakImpact.peakValue).toBe(97)
    expect(byId.get('stephen-curry')?.peakImpact.gravity).toBe(99)
    expect(byId.get('dwyane-wade')?.peakImpact.peakValue).toBe(96)
    expect(byId.get('chris-paul')?.peakImpact.peakValue).toBe(94)
    expect(byId.get('kawhi-leonard')?.peakImpact.peakValue).toBe(96)
    expect(byId.get('allen-iverson')?.peakImpact.peakValue).toBe(94)
    expect(byId.get('scottie-pippen')?.peakImpact.wingValue).toBeGreaterThanOrEqual(94)
    expect(byId.get('charles-barkley')?.peakImpact.defensiveAnchor).toBeLessThan(80)
    expect(byId.get('charles-barkley')?.peakImpact.rebounding).toBeGreaterThanOrEqual(96)
    expect(byId.get('dennis-rodman')?.peakImpact.rebounding).toBe(99)
    expect(byId.get('dennis-rodman')?.peakImpact.primaryEngine).toBeLessThan(60)
  })

  it('uses dynasty-pool peak calibration instead of forcing peak value above current 2K OVR', () => {
    const byId = new Map(pool.map((card) => [card.id, card]))
    const shaq = byId.get('shaquille-oneal')
    if (!shaq) {
      throw new Error('Shaquille O’Neal peak test fixture missing.')
    }

    expect(shaq.peakImpact.peakValue).toBe(99)
    expect(shaq.peakImpact.primaryEngine).toBeGreaterThanOrEqual(98)
    expect(shaq.peakImpact.gravity).toBeGreaterThanOrEqual(97)

    expectPeakValue(byId, 'shai-gilgeous-alexander', 92)
    expectPeakValue(byId, 'jalen-williams', 87)
    expectPeakValue(byId, 'ja-morant', 87)
    expectPeakValue(byId, 'domantas-sabonis', 86)
    expectPeakValue(byId, 'devin-booker', 90)
    expectPeakValue(byId, 'tyrese-maxey', 87)
    expectPeakValue(byId, 'evan-mobley', 88)
    expectPeakValue(byId, 'james-harden', 94)
    expectPeakValue(byId, 'zion-williamson', 85)
    expectPeakValue(byId, 'luka-doncic', 94)

    expectPeakValue(byId, 'jalen-brunson', 93)
    expectPeakValue(byId, 'russell-westbrook', 93)
    expectPeakValue(byId, 'jimmy-butler', 92)
    expectPeakValue(byId, 'kyrie-irving', 92)
    expectPeakValue(byId, 'joel-embiid', 94)
    expectPeakValue(byId, 'carmelo-anthony', 92)
    expectPeakValue(byId, 'gilbert-arenas', 90)

    expect(byId.get('shai-gilgeous-alexander')?.peakImpact.peakValue).toBeLessThan(
      byId.get('shai-gilgeous-alexander')?.sourceRating ?? 0,
    )
    expect(byId.get('luka-doncic')?.peakImpact.peakValue).toBeLessThan(
      byId.get('luka-doncic')?.sourceRating ?? 0,
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
      currentOffers: [{ ...player, price: 16, originalPrice: 16, offerState: 'enabled' }],
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

  it('starts charging budget after free skips are exhausted', () => {
    const state = buildState({
      freeSkipsRemaining: 0,
      paidSkipsUsed: 0,
      currentOffers: generateOffers([], STARTING_BUDGET, buildState({}).lineupArrangement, pool).offers,
    })
    const next = skipOfferGroup(state, pool, createSeededRng(17))

    expect(next.paidSkipsUsed).toBe(1)
    expect(next.budgetRemaining).toBe(STARTING_BUDGET - PAID_SKIP_STEP_COST)
    expect(next.round).toBe(2)
  })

  it('increases the paid skip cost each time after free skips are exhausted', () => {
    const state = buildState({
      freeSkipsRemaining: 0,
      paidSkipsUsed: 1,
      budgetRemaining: 20,
      currentOffers: generateOffers([], 20, buildState({}).lineupArrangement, pool).offers,
    })
    const next = skipOfferGroup(state, pool, createSeededRng(18))

    expect(next.paidSkipsUsed).toBe(2)
    expect(next.budgetRemaining).toBe(16)
  })

  it('does not allow paid skipping when the budget cannot cover the current skip cost', () => {
    const state = buildState({
      freeSkipsRemaining: 0,
      paidSkipsUsed: 2,
      budgetRemaining: 5,
      currentOffers: generateOffers([], 5, buildState({}).lineupArrangement, pool).offers,
    })

    expect(() => skipOfferGroup(state, pool, createSeededRng(19))).toThrow(
      'Not enough budget to skip. Need 6.',
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
    const { offers } = generateOffers(
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

  it('uses lineup construction, not raw peak impact, for score, record, and championship odds math', () => {
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
          originalPrice: 10,
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
            originalPrice: 17,
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
    expect(finished.result?.peakImpactScore).toBeGreaterThan(finished.result?.dynastyScore ?? 0)
    expect(finished.result?.offenseImpactScore).toBeGreaterThan(80)
    expect(finished.result?.defenseImpactScore).toBeGreaterThan(80)
    expect(finished.result?.ceilingScore).toBeGreaterThan(80)
    expect(finished.result?.synergyFitScore).toBeGreaterThan(70)
    expect(finished.result?.budgetScore).toBe(5)
    expect(finished.result?.projectedWins).toBe(79)
    expect(finished.result?.championshipOdds).toBe(87)
  })

  it('does not rate a high-OVR but overlapping random lineup as a 70-win favorite', () => {
    const randomHighOvrLineup = finishLineup(
      {
        PG: 'donovan-mitchell',
        SG: 'allen-iverson',
        SF: 'anthony-edwards',
        PF: 'zion-williamson',
        C: 'moses-malone',
        SIX: null,
      },
      'cade-cunningham',
      1,
    )

    expect(randomHighOvrLineup.result?.peakImpactScore).toBeGreaterThan(80)
    expect(randomHighOvrLineup.result?.synergyFitScore).toBeLessThanOrEqual(52)
    expect(randomHighOvrLineup.result?.dynastyScore).toBeLessThanOrEqual(73)
    expect(randomHighOvrLineup.result?.projectedWins).toBeLessThanOrEqual(56)
    expect(randomHighOvrLineup.result?.championshipOdds).toBeLessThanOrEqual(10)
  })

  it('projects a real all-time superteam into the mid-70-win range', () => {
    const allTimeSuperteam = finishLineup(
      {
        PG: 'allen-iverson',
        SG: 'michael-jordan',
        SF: 'tracy-mcgrady',
        PF: 'elgin-baylor',
        C: 'moses-malone',
        SIX: null,
      },
      'anthony-edwards',
      5,
    )

    expect(allTimeSuperteam.result?.peakImpactScore).toBeGreaterThanOrEqual(86)
    expect(allTimeSuperteam.result?.synergyFitScore).toBeGreaterThanOrEqual(70)
    expect(allTimeSuperteam.result?.defenseImpactScore).toBeGreaterThanOrEqual(82)
    expect(allTimeSuperteam.result?.projectedWins).toBeGreaterThanOrEqual(76)
    expect(allTimeSuperteam.result?.championshipOdds).toBeGreaterThanOrEqual(70)
  })

  it('keeps a mid-tier lineup below dynasty contention', () => {
    const midTierLineup = finishLineup(
      {
        PG: 'chauncey-billups',
        SG: 'joe-dumars',
        SF: 'chris-mullin',
        PF: 'pascal-siakam',
        C: 'marc-gasol',
        SIX: null,
      },
      'jrue-holiday',
      12,
    )

    expect(midTierLineup.result?.ceilingScore).toBeLessThan(90)
    expect(midTierLineup.result?.dynastyScore).toBeLessThan(72)
    expect(midTierLineup.result?.projectedWins).toBeLessThanOrEqual(55)
    expect(midTierLineup.result?.championshipOdds).toBeLessThanOrEqual(10)
  })

  it('does not let budget directly change dynasty score for the same lineup', () => {
    const lineup = {
      PG: 'stephen-curry',
      SG: 'michael-jordan',
      SF: 'lebron-james',
      PF: 'tim-duncan',
      C: 'shaquille-oneal',
      SIX: null,
    }
    const lowBudget = finishLineup(lineup, 'kobe-bryant', 0)
    const highBudget = finishLineup(lineup, 'kobe-bryant', 30)

    expect(lowBudget.result?.dynastyScore).toBe(highBudget.result?.dynastyScore)
    expect(lowBudget.result?.budgetScore).not.toBe(highBudget.result?.budgetScore)
  })

  it('rewards Curry gravity and expert specialists over merely balanced modern scoring', () => {
    const currySpecialistLineup = finishLineup(
      {
        PG: 'stephen-curry',
        SG: 'klay-thompson',
        SF: 'scottie-pippen',
        PF: 'dennis-rodman',
        C: 'tim-duncan',
        SIX: null,
      },
      'reggie-miller',
    )
    const balancedModernLineup = finishLineup(
      {
        PG: 'donovan-mitchell',
        SG: 'anthony-edwards',
        SF: 'jayson-tatum',
        PF: 'bam-adebayo',
        C: 'karl-anthony-towns',
        SIX: null,
      },
      'jaylen-brown',
    )

    expect(currySpecialistLineup.result?.dynastyScore).toBeGreaterThan(
      balancedModernLineup.result?.dynastyScore ?? 0,
    )
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

describe('Faker-based property tests', () => {
  it('signOffer never produces negative budget with random pools', () => {
    for (let i = 0; i < 20; i++) {
      const fakerPool = buildPlayerPool(50)
      const state = createInitialState(fakerPool, createSeededRng(i * 100 + 1))

      // Try signing offers for multiple rounds
      let current = state
      for (let round = 0; round < 5; round++) {
        const signable = current.currentOffers.find(
          (o) => o.offerState === 'enabled' && o.price <= current.budgetRemaining,
        )
        if (signable) {
          const next = signOffer(current, signable.id, fakerPool, createSeededRng(i * 100 + round))
          expect(next.budgetRemaining).toBeGreaterThanOrEqual(0)
          current = next
          if (current.result) break
        } else {
          current = skipOfferGroup(current, fakerPool, createSeededRng(i * 200 + round))
          if (current.result) break
        }
      }
    }
  })

  it('createInitialState always produces valid state', () => {
    for (let i = 0; i < 10; i++) {
      const fakerPool = buildPlayerPool(30)
      const state = createInitialState(fakerPool, createSeededRng(i * 42))

      expect(state.budgetRemaining).toBe(STARTING_BUDGET)
      expect(state.round).toBe(1)
      expect(state.freeSkipsRemaining).toBe(FREE_SKIP_COUNT)
      expect(state.paidSkipsUsed).toBe(0)
      expect(state.roster).toHaveLength(0)
      expect(state.currentOffers).toHaveLength(4)
      expect(state.result).toBeNull()

      // At least one offer should be signable
      const signableCount = state.currentOffers.filter(
        (o) => o.offerState === 'enabled' && o.price <= state.budgetRemaining,
      ).length
      expect(signableCount).toBeGreaterThanOrEqual(1)
    }
  })

  it('full draft run with faker pool never crashes', () => {
    for (let i = 0; i < 5; i++) {
      const fakerPool = buildPlayerPool(40)
      let state = createInitialState(fakerPool, createSeededRng(i * 77))

      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (state.result) break

        const signable = state.currentOffers.find(
          (o) => o.offerState === 'enabled' && o.price <= state.budgetRemaining,
        )
        if (signable) {
          state = signOffer(state, signable.id, fakerPool, createSeededRng(i * 300 + round))
        } else {
          state = skipOfferGroup(state, fakerPool, createSeededRng(i * 400 + round))
        }

        // Invariants
        expect(state.budgetRemaining).toBeGreaterThanOrEqual(0)
        expect(state.roster.length).toBeLessThanOrEqual(ROSTER_TARGET)
      }
    }
  })
})
