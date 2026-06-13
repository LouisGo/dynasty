export const STARTING_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const
export const STARTING_BUDGET = 100
export const ROSTER_TARGET = 6
export const FREE_SKIP_COUNT = 3
export const PAID_SKIP_COST = 3
export const OFFER_COUNT = 4
export const MAX_ROUNDS = 20
export const SIXTH_SLOT = 'SIX' as const
export const COURT_SLOTS = [...STARTING_POSITIONS, SIXTH_SLOT] as const

export type Position = (typeof STARTING_POSITIONS)[number]
export type CourtSlotId = (typeof COURT_SLOTS)[number]
export type Tier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4'
export type OfferState = 'enabled' | 'too-expensive' | 'duplicate' | 'slot-blocked'
export type GameOverReason = 'lineup-complete' | 'budget-exhausted' | 'round-limit'

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

export interface DraftedPlayer {
  playerId: string
  pricePaid: number
  assignedSlot: CourtSlotId
}

export interface OfferCard extends PlayerCard {
  offerState: OfferState
  price: number
}

export type LineupArrangement = Record<CourtSlotId, null | string>

export interface StarterAssignment {
  slot: Position
  playerId: string
  ovr: number
  pricePaid: number
}

export interface SixthManAssignment {
  slot: typeof SIXTH_SLOT
  playerId: string
  ovr: number
  pricePaid: number
}

export interface ResultSummary {
  starters: StarterAssignment[]
  sixthMan: SixthManAssignment | null
  dynastyScore: number
  projectedWins: number
  projectedLosses: number
  championshipOdds: number
  strengthScore: number
  balanceScore: number
  superstarScore: number
  budgetSpent: number
  budgetRemaining: number
  roundReached: number
  gameOverReason: GameOverReason
}

export interface GameState {
  budgetRemaining: number
  round: number
  freeSkipsRemaining: number
  paidSkipsUsed: number
  roster: DraftedPlayer[]
  currentOffers: OfferCard[]
  lineupArrangement: LineupArrangement
  lastAction: string
  result: ResultSummary | null
}
