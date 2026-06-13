import {
  COURT_SLOTS,
  FREE_SKIP_COUNT,
  MAX_ROUNDS,
  OFFER_COUNT,
  PAID_SKIP_COST,
  ROSTER_TARGET,
  SIXTH_SLOT,
  STARTING_BUDGET,
  STARTING_POSITIONS,
  type CourtSlotId,
  type DraftedPlayer,
  type GameOverReason,
  type GameState,
  type LineupArrangement,
  type OfferCard,
  type OfferState,
  type PlayerCard,
  type Position,
  type ResultSummary,
  type StarterAssignment,
} from './types'

type Rng = () => number

interface PricedCandidate {
  card: PlayerCard
  price: number
  offerState: OfferState
}

function getPlayerIndex(pool: PlayerCard[]) {
  return new Map(pool.map((card) => [card.id, card]))
}

function createEmptyArrangement(): LineupArrangement {
  return {
    PG: null,
    SG: null,
    SF: null,
    PF: null,
    C: null,
    SIX: null,
  }
}

export function createSeededRng(seed: number): Rng {
  let value = seed >>> 0

  return () => {
    value += 0x6d2b79f5
    let next = Math.imul(value ^ (value >>> 15), 1 | value)
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

export function getPlayerWeight(card: PlayerCard) {
  return Math.max(1, 100 - card.sourceRating)
}

export function calculateOfferPrice(card: PlayerCard, rng: Rng = Math.random) {
  const randomFactor = 0.7 + rng() * 0.6
  return Math.max(1, Math.round((card.sourceRating - 74) * randomFactor))
}

function getMinimumPossiblePrice(card: PlayerCard) {
  return Math.max(1, Math.round((card.sourceRating - 74) * 0.7))
}

function weightedPick<T>(
  options: T[],
  rng: Rng,
  weightGetter: (item: T) => number,
  blocked = new Set<string>(),
  idGetter: (item: T) => string,
) {
  const filtered = options.filter((option) => !blocked.has(idGetter(option)))
  const total = filtered.reduce((sum, option) => sum + weightGetter(option), 0)

  if (!filtered.length || total <= 0) {
    return null
  }

  let cursor = rng() * total
  for (const option of filtered) {
    cursor -= weightGetter(option)
    if (cursor <= 0) {
      return option
    }
  }

  return filtered.at(-1) ?? null
}

function getOpenStarterSlots(arrangement: LineupArrangement, card: PlayerCard) {
  return STARTING_POSITIONS.filter(
    (slot) => arrangement[slot] === null && card.positions.includes(slot),
  )
}

function canFitOpenSlot(card: PlayerCard, arrangement: LineupArrangement) {
  return arrangement[SIXTH_SLOT] === null || getOpenStarterSlots(arrangement, card).length > 0
}

function chooseSlotForPlayer(card: PlayerCard, arrangement: LineupArrangement): CourtSlotId {
  const openStarterSlots = getOpenStarterSlots(arrangement, card)
  if (openStarterSlots[0]) {
    return openStarterSlots[0]
  }

  if (arrangement[SIXTH_SLOT] === null) {
    return SIXTH_SLOT
  }

  throw new Error(`${card.name} cannot fit the remaining lineup slots.`)
}

function getOfferState(
  card: PlayerCard,
  price: number,
  budgetRemaining: number,
  roster: DraftedPlayer[],
  arrangement: LineupArrangement,
): OfferState {
  if (roster.some((player) => player.playerId === card.id)) {
    return 'duplicate'
  }

  if (!canFitOpenSlot(card, arrangement)) {
    return 'slot-blocked'
  }

  if (price > budgetRemaining) {
    return 'too-expensive'
  }

  return 'enabled'
}

export function canAnyPlayerBeBought(
  roster: DraftedPlayer[],
  arrangement: LineupArrangement,
  budgetRemaining: number,
  pool: PlayerCard[],
) {
  return pool.some(
    (card) =>
      !roster.some((player) => player.playerId === card.id) &&
      canFitOpenSlot(card, arrangement) &&
      getMinimumPossiblePrice(card) <= budgetRemaining,
  )
}

export function generateOffers(
  roster: DraftedPlayer[],
  budgetRemaining: number,
  arrangement: LineupArrangement,
  pool: PlayerCard[],
  rng: Rng = Math.random,
): OfferCard[] {
  const candidates: PricedCandidate[] = pool.map((card) => {
    const price = calculateOfferPrice(card, rng)
    return {
      card,
      price,
      offerState: getOfferState(card, price, budgetRemaining, roster, arrangement),
    }
  })
  const blockedIds = new Set<string>()
  const offers: OfferCard[] = []

  while (offers.length < OFFER_COUNT) {
    const picked = weightedPick(
      candidates,
      rng,
      (candidate) => getPlayerWeight(candidate.card),
      blockedIds,
      (candidate) => candidate.card.id,
    )

    if (!picked) {
      break
    }

    blockedIds.add(picked.card.id)
    offers.push({
      ...picked.card,
      price: picked.price,
      offerState: picked.offerState,
    })
  }

  const enabledCandidates = candidates.filter(
    (candidate) => candidate.offerState === 'enabled' && !blockedIds.has(candidate.card.id),
  )
  if (!offers.some((offer) => offer.offerState === 'enabled') && enabledCandidates.length > 0) {
    const replacement = weightedPick(
      enabledCandidates,
      rng,
      (candidate) => getPlayerWeight(candidate.card),
      new Set<string>(),
      (candidate) => candidate.card.id,
    )

    if (replacement) {
      offers[offers.length - 1] = {
        ...replacement.card,
        price: replacement.price,
        offerState: replacement.offerState,
      }
    }
  }

  return offers
}

function createResultSummary(
  roster: DraftedPlayer[],
  budgetRemaining: number,
  arrangement: LineupArrangement,
  pool: PlayerCard[],
  roundReached: number,
  gameOverReason: GameOverReason,
): ResultSummary {
  const playerIndex = getPlayerIndex(pool)
  const rosterIndex = new Map(roster.map((player) => [player.playerId, player]))
  const starters: StarterAssignment[] = []

  for (const slot of STARTING_POSITIONS) {
    const playerId = arrangement[slot]
    const card = playerId ? playerIndex.get(playerId) : null
    const drafted = playerId ? rosterIndex.get(playerId) : null

    if (playerId && card && drafted) {
      starters.push({
        slot,
        playerId,
        ovr: card.sourceRating,
        pricePaid: drafted.pricePaid,
      })
    }
  }

  const sixthPlayerId = arrangement[SIXTH_SLOT]
  const sixthCard = sixthPlayerId ? playerIndex.get(sixthPlayerId) : null
  const sixthDrafted = sixthPlayerId ? rosterIndex.get(sixthPlayerId) : null
  const sixthMan =
    sixthPlayerId && sixthCard && sixthDrafted
      ? {
          slot: SIXTH_SLOT,
          playerId: sixthPlayerId,
          ovr: sixthCard.sourceRating,
          pricePaid: sixthDrafted.pricePaid,
        }
      : null

  const starterRatings = STARTING_POSITIONS.map((slot) => {
    const playerId = arrangement[slot]
    const card = playerId ? playerIndex.get(playerId) : null
    return card?.sourceRating ?? 0
  })
  const sixthRating = sixthMan?.ovr ?? 0
  const starterAverage =
    starterRatings.reduce((sum, rating) => sum + rating, 0) / STARTING_POSITIONS.length
  const strengthScore = starterAverage * 0.8 + sixthRating * 0.2
  const isComplete = roster.length >= ROSTER_TARGET && COURT_SLOTS.every((slot) => arrangement[slot])
  const nonZeroRatings = [...starterRatings, sixthRating].filter((rating) => rating > 0)
  const ratingSpread =
    nonZeroRatings.length > 0 ? Math.max(...nonZeroRatings) - Math.min(...nonZeroRatings) : 100
  const balanceScore = getBalanceScore(isComplete, ratingSpread)
  const superstarScore = getSuperstarScore(nonZeroRatings.filter((rating) => rating >= 95).length)
  const dynastyScore = Math.min(
    100,
    Number((strengthScore * 0.6 + balanceScore + superstarScore).toFixed(1)),
  )
  const projectedWins = Math.min(82, Math.max(0, Math.round(15 + dynastyScore * 0.67)))
  const championshipOdds = Math.round(
    (1 / (1 + Math.exp(-((dynastyScore - 78) / 5)))) * 100,
  )

  return {
    starters,
    sixthMan,
    dynastyScore,
    projectedWins,
    projectedLosses: 82 - projectedWins,
    championshipOdds,
    strengthScore: Number(strengthScore.toFixed(1)),
    balanceScore,
    superstarScore,
    budgetSpent: STARTING_BUDGET - budgetRemaining,
    budgetRemaining,
    roundReached,
    gameOverReason,
  }
}

function getBalanceScore(isComplete: boolean, ratingSpread: number) {
  if (!isComplete) {
    return 0
  }

  if (ratingSpread <= 5) {
    return 20
  }

  if (ratingSpread <= 10) {
    return 16
  }

  if (ratingSpread <= 15) {
    return 12
  }

  return 8
}

function getSuperstarScore(superstarCount: number) {
  if (superstarCount <= 0) {
    return 5
  }

  if (superstarCount === 1) {
    return 10
  }

  if (superstarCount === 2) {
    return 15
  }

  if (superstarCount === 3) {
    return 18
  }

  return 20
}

function finishRun(
  state: Omit<GameState, 'result'>,
  pool: PlayerCard[],
  gameOverReason: GameOverReason,
): GameState {
  return {
    ...state,
    currentOffers: [],
    result: createResultSummary(
      state.roster,
      state.budgetRemaining,
      state.lineupArrangement,
      pool,
      state.round,
      gameOverReason,
    ),
  }
}

function advanceOrFinish(
  state: Omit<GameState, 'result'>,
  pool: PlayerCard[],
  rng: Rng,
  lastAction: string,
): GameState {
  if (state.roster.length >= ROSTER_TARGET) {
    return finishRun(
      {
        ...state,
        lastAction: '六个位置全部填满，王朝实验进入结算。',
      },
      pool,
      'lineup-complete',
    )
  }

  if (state.round >= MAX_ROUNDS) {
    return finishRun(
      {
        ...state,
        lastAction: '20 回合已经用完，按当前阵容结算。',
      },
      pool,
      'round-limit',
    )
  }

  if (!canAnyPlayerBeBought(state.roster, state.lineupArrangement, state.budgetRemaining, pool)) {
    return finishRun(
      {
        ...state,
        lastAction: '剩余预算已经不足以购买任何可用球员。',
      },
      pool,
      'budget-exhausted',
    )
  }

  const nextRound = state.round + 1
  return {
    ...state,
    round: nextRound,
    currentOffers: generateOffers(
      state.roster,
      state.budgetRemaining,
      state.lineupArrangement,
      pool,
      rng,
    ),
    lastAction,
    result: null,
  }
}

export function createInitialState(pool: PlayerCard[], rng: Rng = Math.random): GameState {
  const lineupArrangement = createEmptyArrangement()

  return {
    budgetRemaining: STARTING_BUDGET,
    round: 1,
    freeSkipsRemaining: FREE_SKIP_COUNT,
    paidSkipsUsed: 0,
    roster: [],
    currentOffers: generateOffers([], STARTING_BUDGET, lineupArrangement, pool, rng),
    lineupArrangement,
    lastAction: '第一组历史报价已送达。预算 100，目标 6 人王朝。',
    result: null,
  }
}

export function signOffer(
  state: GameState,
  offerId: string,
  pool: PlayerCard[],
  rng: Rng = Math.random,
): GameState {
  if (state.result) {
    throw new Error('Cannot sign after the run is complete.')
  }

  const offer = state.currentOffers.find((candidate) => candidate.id === offerId)
  if (!offer) {
    throw new Error(`Offer ${offerId} not found.`)
  }

  if (offer.offerState !== 'enabled') {
    throw new Error(`Offer ${offerId} is not signable.`)
  }

  const slot = chooseSlotForPlayer(offer, state.lineupArrangement)
  const roster = [
    ...state.roster,
    {
      playerId: offer.id,
      pricePaid: offer.price,
      assignedSlot: slot,
    },
  ]
  const lineupArrangement = {
    ...state.lineupArrangement,
    [slot]: offer.id,
  }
  const nextState = {
    ...state,
    budgetRemaining: state.budgetRemaining - offer.price,
    roster,
    lineupArrangement,
    currentOffers: [],
    result: null,
  }
  const slotLabel = slot === SIXTH_SLOT ? '第六人' : slot

  return advanceOrFinish(
    nextState,
    pool,
    rng,
    `${offer.name} 以 ${offer.price} 预算加盟，落位 ${slotLabel}。`,
  )
}

export function skipOfferGroup(
  state: GameState,
  pool: PlayerCard[],
  rng: Rng = Math.random,
): GameState {
  if (state.result) {
    throw new Error('Cannot skip after the run is complete.')
  }

  const isFreeSkip = state.freeSkipsRemaining > 0
  if (!isFreeSkip && state.budgetRemaining < PAID_SKIP_COST) {
    throw new Error('Not enough budget for a paid skip.')
  }

  const budgetRemaining = isFreeSkip
    ? state.budgetRemaining
    : state.budgetRemaining - PAID_SKIP_COST
  const freeSkipsRemaining = isFreeSkip ? state.freeSkipsRemaining - 1 : 0
  const paidSkipsUsed = isFreeSkip ? state.paidSkipsUsed : state.paidSkipsUsed + 1
  const nextState = {
    ...state,
    budgetRemaining,
    freeSkipsRemaining,
    paidSkipsUsed,
    currentOffers: [],
    result: null,
  }
  const lastAction = isFreeSkip
    ? `你免费跳过了本轮，还剩 ${freeSkipsRemaining} 次免费跳过。`
    : `你花费 ${PAID_SKIP_COST} 预算跳过了本轮。`

  return advanceOrFinish(nextState, pool, rng, lastAction)
}

export function setArrangement(
  state: GameState,
  arrangement: LineupArrangement,
  pool: PlayerCard[],
): GameState {
  if (state.result) {
    return state
  }

  const playerIndex = getPlayerIndex(pool)
  const validIds = new Set(state.roster.map((player) => player.playerId))
  const next = createEmptyArrangement()
  const used = new Set<string>()

  for (const slot of COURT_SLOTS) {
    const playerId = arrangement[slot]
    const card = playerId ? playerIndex.get(playerId) : null
    const canUse =
      playerId &&
      card &&
      validIds.has(playerId) &&
      !used.has(playerId) &&
      (slot === SIXTH_SLOT || card.positions.includes(slot as Position))

    if (canUse) {
      next[slot] = playerId
      used.add(playerId)
    }
  }

  for (const player of state.roster) {
    if (used.has(player.playerId)) {
      continue
    }

    const card = playerIndex.get(player.playerId)
    if (!card) {
      continue
    }

    const slot = chooseSlotForPlayer(card, next)
    next[slot] = player.playerId
    used.add(player.playerId)
  }

  return {
    ...state,
    lineupArrangement: next,
  }
}
