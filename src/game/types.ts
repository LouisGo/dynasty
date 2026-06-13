export const STARTING_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const
export const STARTING_BUDGET = 100
export const STAR_BONUS = 4
export const ROSTER_TARGET = 6
export const SKIP_TOKENS = 2
export const OFFER_COUNT = 4
export const SIXTH_SLOT = 'SIX' as const
export const COURT_SLOTS = [...STARTING_POSITIONS, SIXTH_SLOT] as const

export type Position = (typeof STARTING_POSITIONS)[number]
export type CourtSlotId = (typeof COURT_SLOTS)[number]
export type Tier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4'
export type OfferState = 'enabled' | 'too-expensive' | 'reserve-blocked' | 'maxed-out'

export interface PlayerCard {
  id: string
  name: string
  positions: Position[]
  sourceRating: number
  tier: Tier
  contractCost: number
  rarityWeight: number
  tagline: string
  source: string
  sourceStatus: string
}

export interface OwnedCard {
  playerId: string
  stars: number
  totalCost: number
}

export interface OfferCard extends PlayerCard {
  offerState: OfferState
  offerKind: 'new' | 'upgrade'
  price: number
  starTarget: number
}

export interface LineupSlot {
  slot: Position
  playerId: string | null
  stars: number
  power: number
}

export interface StarterAssignment {
  slot: Position
  playerId: string
  stars: number
  power: number
}

export interface ResultTitle {
  label: string
  subtitle: string
}

export interface ResultSummary {
  starters: StarterAssignment[]
  sixthMan: StarterAssignment
  totalPower: number
  teamRating: number
  efficiencyScore: number
  title: ResultTitle
  budgetSpent: number
  budgetRemaining: number
  totalStars: number
}

export interface PartialLineup {
  assignments: LineupSlot[]
  filledCount: number
  totalPower: number
  missingPositions: Position[]
}

export type LineupArrangement = Record<CourtSlotId, null | string>

export interface GameState {
  budgetRemaining: number
  offerCount: number
  skipsRemaining: number
  roster: OwnedCard[]
  currentOffers: OfferCard[]
  lineupArrangement: LineupArrangement
  lastAction: string
  result: ResultSummary | null
}
