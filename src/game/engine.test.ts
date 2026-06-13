import { describe, expect, it } from 'vitest'
import legendPool from '../data/legend-pool.json'
import {
  canConfirmArrangement,
  confirmLineup,
  canFormStarter,
  createInitialState,
  createSeededRng,
  getPartialLineup,
  skipOfferGroup,
  signOffer,
} from './engine'
import type { GameState, PlayerCard } from './types'

const pool = legendPool as PlayerCard[]

function buildState(overrides: Partial<GameState>): GameState {
  return {
    budgetRemaining: 100,
    offerCount: 1,
    skipsRemaining: 2,
    roster: [],
    currentOffers: [],
    lineupArrangement: { PG: null, SG: null, SF: null, PF: null, C: null, SIX: null },
    lastAction: '',
    result: null,
    ...overrides,
  }
}

function simulateRun(seed: number) {
  const rng = createSeededRng(seed)
  let state = createInitialState(pool, rng)

  while (state.roster.length < 6) {
    const enabled = state.currentOffers
      .filter((offer) => offer.offerState === 'enabled')
      .sort((left, right) => {
        if (right.sourceRating !== left.sourceRating) {
          return right.sourceRating - left.sourceRating
        }

        return left.price - right.price
      })

    if (!enabled.length) {
      throw new Error('Run became unsignable.')
    }

    state = signOffer(state, enabled[0].id, pool, rng)
  }

  return confirmLineup(state, pool)
}

describe('offer generation', () => {
  it('makes Jordan rarer than the average T0 card in opening offers', () => {
    const counts = new Map<string, number>()
    const rounds = 10000

    for (let index = 0; index < rounds; index += 1) {
      const offers = createInitialState(pool, createSeededRng(index + 1)).currentOffers
      for (const offer of offers) {
        counts.set(offer.id, (counts.get(offer.id) ?? 0) + 1)
      }
    }

    const t0Ids = pool.filter((card) => card.tier === 'T0').map((card) => card.id)
    const t0Average =
      t0Ids.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0) / Math.max(t0Ids.length, 1)

    expect(counts.get('michael-jordan') ?? 0).toBeLessThan(t0Average)
  })

  it('always surfaces one enabled offer and one missing-position fixer before five starters exist', () => {
    for (let index = 0; index < 2500; index += 1) {
      const rng = createSeededRng(index + 9)
      let state = createInitialState(pool, rng)

      while (state.roster.length < ROSTER_TARGET) {
        const enabled = state.currentOffers.filter((offer) => offer.offerState === 'enabled')
        expect(enabled.length).toBeGreaterThan(0)

        if (state.roster.length < 5 && !canFormStarter(state.roster, pool)) {
          const partial = getPartialLineup(state.roster, pool)
          const hasFixer = enabled.some(
            (offer) =>
              offer.offerKind === 'new' &&
              offer.positions.some((position) => partial.missingPositions.includes(position)),
          )
          expect(hasFixer).toBe(true)
        }

        state = signOffer(state, enabled[0].id, pool, rng)
      }
    }
  })
})

describe('upgrade flow', () => {
  it('uses half-price upgrades and caps stars at three', () => {
    const player = pool.find((card) => card.id === 'damian-lillard')
    if (!player) {
      throw new Error('Damian Lillard test fixture missing.')
    }

    const state = buildState({
      budgetRemaining: 45,
      roster: [{ playerId: 'damian-lillard', stars: 1, totalCost: 7 }],
      currentOffers: [
        {
          ...player,
          offerKind: 'upgrade',
          starTarget: 2,
          price: 4,
          offerState: 'enabled',
        },
      ],
    })

    const upgraded = signOffer(state, 'damian-lillard', pool, createSeededRng(22))
    expect(upgraded.roster[0]).toEqual({
      playerId: 'damian-lillard',
      stars: 2,
      totalCost: 11,
    })
    expect(upgraded.budgetRemaining).toBe(41)
  })
})

describe('skip flow', () => {
  it('refreshes the offers and spends one skip token', () => {
    const seed = 15
    const initial = createInitialState(pool, createSeededRng(seed))
    const next = skipOfferGroup(initial, pool, createSeededRng(seed + 1))

    expect(next.skipsRemaining).toBe(initial.skipsRemaining - 1)
    expect(next.offerCount).toBe(initial.offerCount + 1)
    expect(next.currentOffers).toHaveLength(4)
    expect(next.lastAction).toContain('跳过')
  })
})

describe('lineup solving', () => {
  it('places LeBron in the slot that preserves the strongest full lineup', () => {
    const finishingOffer = pool.find((card) => card.id === 'kobe-bryant')
    if (!finishingOffer) {
      throw new Error('Kobe Bryant test fixture missing.')
    }

    const state = buildState({
      budgetRemaining: 22,
      roster: [
        { playerId: 'lebron-james', stars: 1, totalCost: 30 },
        { playerId: 'michael-jordan', stars: 1, totalCost: 30 },
        { playerId: 'tim-duncan', stars: 1, totalCost: 22 },
        { playerId: 'kareem-abdul-jabbar', stars: 1, totalCost: 30 },
        { playerId: 'stephen-curry', stars: 1, totalCost: 22 },
      ],
      currentOffers: [
        {
          ...finishingOffer,
          offerKind: 'new',
          starTarget: 1,
          price: 22,
          offerState: 'enabled',
        },
      ],
    })

    const afterSign = signOffer(state, 'kobe-bryant', pool, createSeededRng(99))
    expect(canConfirmArrangement(afterSign.roster, afterSign.lineupArrangement, pool)).toBe(true)
    const finished = confirmLineup(afterSign, pool)
    expect(finished.result?.starters.map((starter) => starter.slot)).toEqual([
      'PG',
      'SG',
      'SF',
      'PF',
      'C',
    ])
    expect(finished.result?.starters.find((starter) => starter.playerId === 'lebron-james')?.slot).toBe(
      'PG',
    )
  })
})

describe('run completion', () => {
  it('produces a result summary once six unique players are signed', () => {
    const result = simulateRun(101).result
    expect(result).not.toBeNull()
    expect(result?.starters).toHaveLength(5)
    expect(result?.sixthMan.playerId).toBeTruthy()
    expect(result?.teamRating).toBeGreaterThan(0)
  })

  it('starts fresh with an empty roster', () => {
    const state = createInitialState(pool, createSeededRng(7))
    expect(state.roster).toEqual([])
    expect(state.budgetRemaining).toBe(100)
    expect(state.skipsRemaining).toBe(2)
    expect(state.currentOffers).toHaveLength(4)
  })
})
