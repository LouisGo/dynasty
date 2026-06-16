import { faker } from '@faker-js/faker'
import type { PlayerCard, GameState, Position } from './types'
import { createInitialState, createSeededRng } from './engine'
import { STARTING_POSITIONS } from './types'

/**
 * Build a random PlayerCard for testing.
 * Uses Faker to generate realistic-looking player data.
 */
export function buildPlayerCard(overrides?: Partial<PlayerCard>): PlayerCard {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const id = `${firstName}-${lastName}`.toLowerCase().replace(/\s+/g, '-')

  const sourceRating = faker.number.int({ min: 75, max: 99 })
  let tier: PlayerCard['tier']
  if (sourceRating >= 97) tier = 'T0'
  else if (sourceRating >= 93) tier = 'T1'
  else if (sourceRating >= 88) tier = 'T2'
  else if (sourceRating >= 83) tier = 'T3'
  else tier = 'T4'

  return {
    id,
    name: `${firstName} ${lastName}`,
    chineseName: faker.helpers.maybe(
      () => `${faker.person.lastName()}·${faker.person.firstName()}`,
      { probability: 0.5 },
    ) ?? '',
    positions: faker.helpers.arrayElements(
      [...STARTING_POSITIONS],
      { min: 1, max: 2 },
    ) as Position[],
    sourceRating,
    tier,
    contractCost: faker.number.int({ min: 5, max: 30 }),
    rarityWeight: faker.number.float({ min: 0.5, max: 3, fractionDigits: 2 }),
    tagline: faker.lorem.sentence({ min: 3, max: 8 }),
    source: 'test-fixture',
    sourceStatus: 'test',
    ratingModelVersion: '2k-attributes-v1',
    sourceAttributes: null,
    peakImpact: {
      peakSeasonLabel: 'test peak',
      sourceType: 'estimated-peak',
      confidence: 'low',
      manualCorrectionNote: null,
      peakValue: sourceRating,
      primaryEngine: faker.number.int({ min: 50, max: 99 }),
      gravity: faker.number.int({ min: 50, max: 99 }),
      defensiveAnchor: faker.number.int({ min: 50, max: 99 }),
      wingValue: faker.number.int({ min: 50, max: 99 }),
      rebounding: faker.number.int({ min: 50, max: 99 }),
      availability: faker.number.int({ min: 50, max: 99 }),
    },
    attributeSourceUrl: null,
    attributeSourceStatus: faker.helpers.arrayElement([
      'verified-2k-snapshot',
      'estimated-archetype-v1',
    ]),
    ...overrides,
  }
}

/**
 * Build a pool of random PlayerCards.
 */
export function buildPlayerPool(count: number): PlayerCard[] {
  return Array.from({ length: count }, () => buildPlayerCard())
}

/**
 * Build a GameState with a fresh initial state from a random pool.
 */
export function buildGameState(poolSize = 50, seed?: number): GameState {
  const pool = buildPlayerPool(poolSize)
  const rngSeed = seed ?? faker.number.int({ min: 1, max: 1_000_000_000 })
  return createInitialState(pool, createSeededRng(rngSeed))
}
