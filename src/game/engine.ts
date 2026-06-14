import {
  COURT_SLOTS,
  FREE_SKIP_COUNT,
  MAX_ROUNDS,
  OFFER_COUNT,
  PAID_SKIP_STEP_COST,
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
  type Tier,
} from './types'

type Rng = () => number

interface PricedCandidate {
  card: PlayerCard
  price: number
  offerState: OfferState
}

const FREE_OFFER_CHANCE_BY_TIER: Record<Tier, number> = {
  T0: 0.005,
  T1: 0.0075,
  T2: 0.011,
  T3: 0.016,
  T4: 0.022,
}

const HALF_PRICE_CHANCE_BY_TIER: Record<Tier, number> = {
  T0: 0.02,
  T1: 0.028,
  T2: 0.04,
  T3: 0.055,
  T4: 0.07,
}

const PRD_FACTOR = 0.5
const MAX_FREE_CHANCE = 0.5
const MAX_HALF_PRICE_CHANCE = 0.75

const OFFER_TIER_SLOTS: Tier[][] = [
  ['T0', 'T1', 'T2'],
  ['T2', 'T3'],
  ['T2', 'T3'],
  ['T3', 'T4'],
]

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

function getDisplayName(card: Pick<PlayerCard, 'name' | 'chineseName'>) {
  return card.chineseName || card.name
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

export function calculateOfferPrice(card: PlayerCard) {
  return Math.max(1, Math.round((card.sourceRating - 74) * 1.0))
}

export function getPlayerWeight(card: PlayerCard) {
  return Math.max(0.1, card.rarityWeight)
}

function getDiscountChance(baseChance: number, counter: number, maxChance: number) {
  return Math.min(baseChance * (1 + counter * PRD_FACTOR), maxChance)
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

  throw new Error(`${getDisplayName(card)} cannot fit the remaining lineup slots.`)
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
  excludedIds = new Set<string>(),
) {
  return pool.some(
    (card) =>
      !excludedIds.has(card.id) &&
      !roster.some((player) => player.playerId === card.id) &&
      canFitOpenSlot(card, arrangement) &&
      calculateOfferPrice(card) <= budgetRemaining,
  )
}

function pickOfferForTierSlot(
  candidates: PricedCandidate[],
  tiers: Tier[],
  rng: Rng,
  blockedIds: Set<string>,
) {
  const tierCandidates = candidates.filter((candidate) => tiers.includes(candidate.card.tier))
  const source = tierCandidates.length > 0 ? tierCandidates : candidates

  return weightedPick(
    source,
    rng,
    (candidate) => getPlayerWeight(candidate.card),
    blockedIds,
    (candidate) => candidate.card.id,
  )
}

interface DiscountState {
  freeCounter: number
  halfPriceCounter: number
  freeTriggered: boolean
  halfPriceTriggered: boolean
}

function createOfferFromCandidate(
  candidate: PricedCandidate,
  roster: DraftedPlayer[],
  budgetRemaining: number,
  arrangement: LineupArrangement,
  rng: Rng,
  discountState: DiscountState,
): OfferCard {
  const originalPrice = candidate.price
  const freeChance = getDiscountChance(
    FREE_OFFER_CHANCE_BY_TIER[candidate.card.tier],
    discountState.freeCounter,
    MAX_FREE_CHANCE,
  )
  const halfChance = getDiscountChance(
    HALF_PRICE_CHANCE_BY_TIER[candidate.card.tier],
    discountState.halfPriceCounter,
    MAX_HALF_PRICE_CHANCE,
  )

  let discountType: 'free' | 'half-price' | undefined
  let price: number

  if (rng() < freeChance) {
    discountType = 'free'
    price = 0
    discountState.freeTriggered = true
  } else if (rng() < halfChance) {
    discountType = 'half-price'
    price = Math.ceil(originalPrice / 2)
    discountState.halfPriceTriggered = true
  } else {
    discountType = undefined
    price = originalPrice
  }

  return {
    ...candidate.card,
    price,
    originalPrice,
    discountType,
    offerState: getOfferState(candidate.card, price, budgetRemaining, roster, arrangement),
  }
}

interface GenerateOffersResult {
  offers: OfferCard[]
  freeDiscountCounter: number
  halfPriceDiscountCounter: number
}

export function generateOffers(
  roster: DraftedPlayer[],
  budgetRemaining: number,
  arrangement: LineupArrangement,
  pool: PlayerCard[],
  rng: Rng = Math.random,
  excludedIds = new Set<string>(),
  freeDiscountCounter = 0,
  halfPriceDiscountCounter = 0,
): GenerateOffersResult {
  const candidates: PricedCandidate[] = pool
    .filter((card) => !excludedIds.has(card.id))
    .map((card) => {
      const price = calculateOfferPrice(card)
      return {
        card,
        price,
        offerState: getOfferState(card, price, budgetRemaining, roster, arrangement),
      }
    })
  const blockedIds = new Set<string>()
  const offers: OfferCard[] = []
  const discountState: DiscountState = {
    freeCounter: freeDiscountCounter,
    halfPriceCounter: halfPriceDiscountCounter,
    freeTriggered: false,
    halfPriceTriggered: false,
  }

  for (const tiers of OFFER_TIER_SLOTS) {
    const picked = pickOfferForTierSlot(candidates, tiers, rng, blockedIds)

    if (!picked) {
      break
    }

    blockedIds.add(picked.card.id)
    offers.push(createOfferFromCandidate(picked, roster, budgetRemaining, arrangement, rng, discountState))
  }

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
    offers.push(createOfferFromCandidate(picked, roster, budgetRemaining, arrangement, rng, discountState))
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
      offers[offers.length - 1] = createOfferFromCandidate(
        replacement,
        roster,
        budgetRemaining,
        arrangement,
        rng,
        discountState,
      )
    }
  }

  return {
    offers,
    freeDiscountCounter: discountState.freeTriggered ? 0 : freeDiscountCounter + 1,
    halfPriceDiscountCounter: discountState.halfPriceTriggered ? 0 : halfPriceDiscountCounter + 1,
  }
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
        originalPrice: drafted.originalPrice,
        discountType: drafted.discountType,
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
          originalPrice: sixthDrafted.originalPrice,
          discountType: sixthDrafted.discountType,
        }
      : null

  const starterRatings = STARTING_POSITIONS.map((slot) => {
    const playerId = arrangement[slot]
    const card = playerId ? playerIndex.get(playerId) : null
    return card?.sourceRating ?? 0
  })
  const sixthRating = sixthMan?.ovr ?? 0
  const isComplete = roster.length >= ROSTER_TARGET && COURT_SLOTS.every((slot) => arrangement[slot])
  const nonZeroRatings = [...starterRatings, sixthRating].filter((rating) => rating > 0)
  const ratingSpread =
    nonZeroRatings.length > 0 ? Math.max(...nonZeroRatings) - Math.min(...nonZeroRatings) : 100
  const lineupCards = COURT_SLOTS.map((slot) => {
    const playerId = arrangement[slot]
    return playerId ? (playerIndex.get(playerId) ?? null) : null
  })
  const coreAverages = getCoreRatingAverages(lineupCards)
  const coreRating =
    coreAverages.offense * 0.35 +
    coreAverages.defense * 0.3 +
    coreAverages.physical * 0.15 +
    coreAverages.mentality * 0.2
  const coreSpread =
    Math.max(coreAverages.offense, coreAverages.defense, coreAverages.physical, coreAverages.mentality) -
    Math.min(coreAverages.offense, coreAverages.defense, coreAverages.physical, coreAverages.mentality)
  const strengthScore = Number(Math.min(65, coreRating * 0.7).toFixed(1))
  const balanceScore = getStructureScore(isComplete, roster.length, ratingSpread, coreSpread)
  const superstarScore = getStarPowerScore(nonZeroRatings)
  const budgetSpent = STARTING_BUDGET - budgetRemaining
  const budgetScore = getBudgetScore(isComplete, budgetRemaining)
  const dynastyScore = Math.min(
    100,
    Number((strengthScore + balanceScore + superstarScore + budgetScore).toFixed(1)),
  )
  const dimAvg =
    (coreAverages.offense + coreAverages.defense + coreAverages.physical + coreAverages.mentality) / 4
  const dimSpread =
    Math.max(coreAverages.offense, coreAverages.defense, coreAverages.physical, coreAverages.mentality) -
    Math.min(coreAverages.offense, coreAverages.defense, coreAverages.physical, coreAverages.mentality)
  const dimBalance = Math.max(0, 1 - dimSpread / 50)
  const dimQuality = Math.max(0, (dimAvg - 55) / 40)
  const dimAdjustment = Math.min(4, Math.max(-4, Math.round((dimBalance * dimQuality * 2 - 0.6) * 5)))

  const projectedWins = Math.min(82, Math.max(0, Math.round(20 + dynastyScore * 0.6 + dimAdjustment)))
  const championshipOdds = Math.round(
    (1 / (1 + Math.exp(-((dynastyScore - 80) / 4.5)))) * 100,
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
    budgetScore,
    offenseScore: Math.min(99, Math.round(coreAverages.offense * 1.1)),
    defenseScore: Math.min(99, Math.round(coreAverages.defense * 1.1)),
    physicalScore: Math.min(99, Math.round(coreAverages.physical * 1.1)),
    mentalityScore: Math.min(99, Math.round(coreAverages.mentality * 1.1)),
    budgetSpent,
    budgetRemaining,
    roundReached,
    gameOverReason,
  }
}

function getCoreRatingAverages(cards: Array<PlayerCard | null>) {
  let totalWeight = 0
  const totals = {
    offense: 0,
    defense: 0,
    physical: 0,
    mentality: 0,
  }

  cards.forEach((card, index) => {
    if (!card) {
      return
    }

    const weight = index === COURT_SLOTS.length - 1 ? 0.75 : 1
    const ratings =
      card.ratings ?? {
        offense: card.sourceRating,
        defense: card.sourceRating,
        physical: card.sourceRating,
        mentality: card.sourceRating,
      }

    totals.offense += ratings.offense * weight
    totals.defense += ratings.defense * weight
    totals.physical += ratings.physical * weight
    totals.mentality += ratings.mentality * weight
    totalWeight += weight
  })

  if (totalWeight === 0) {
    return {
      offense: 0,
      defense: 0,
      physical: 0,
      mentality: 0,
    }
  }

  return {
    offense: Number((totals.offense / totalWeight).toFixed(1)),
    defense: Number((totals.defense / totalWeight).toFixed(1)),
    physical: Number((totals.physical / totalWeight).toFixed(1)),
    mentality: Number((totals.mentality / totalWeight).toFixed(1)),
  }
}

function getStructureScore(
  isComplete: boolean,
  rosterSize: number,
  ratingSpread: number,
  coreSpread: number,
) {
  if (!isComplete) {
    return Math.round((rosterSize / ROSTER_TARGET) * 4)
  }

  let score = 6

  if (ratingSpread <= 5) {
    score += 3
  } else if (ratingSpread <= 10) {
    score += 2
  } else if (ratingSpread <= 15) {
    score += 1
  }

  if (coreSpread <= 8) {
    score += 3
  } else if (coreSpread <= 14) {
    score += 2
  } else if (coreSpread <= 20) {
    score += 1
  }

  return score
}

function getStarPowerScore(ratings: number[]) {
  const slotMax = [8, 7, 5]
  return Number(
    [...ratings]
      .sort((left, right) => right - left)
      .slice(0, slotMax.length)
      .reduce((sum, rating, index) => {
        const normalized = Math.max(0, Math.min(1, (rating - 90) / 9))
        return sum + normalized * slotMax[index]
      }, 0)
      .toFixed(1),
  )
}

function getBudgetScore(isComplete: boolean, budgetRemaining: number) {
  if (!isComplete) {
    return 0
  }

  if (budgetRemaining >= 9 && budgetRemaining <= 20) {
    return 8
  }

  if (budgetRemaining >= 21 && budgetRemaining <= 30) {
    return 6
  }

  if (budgetRemaining >= 1 && budgetRemaining <= 8) {
    return 5
  }

  if (budgetRemaining === 0 || budgetRemaining <= 40) {
    return 3
  }

  return 1
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

  const seenOfferIds = new Set(state.seenOfferIds)

  if (
    !canAnyPlayerBeBought(
      state.roster,
      state.lineupArrangement,
      state.budgetRemaining,
      pool,
      seenOfferIds,
    )
  ) {
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
  const {
    offers: currentOffers,
    freeDiscountCounter,
    halfPriceDiscountCounter,
  } = generateOffers(
    state.roster,
    state.budgetRemaining,
    state.lineupArrangement,
    pool,
    rng,
    seenOfferIds,
    state.freeDiscountCounter,
    state.halfPriceDiscountCounter,
  )
  const nextSeenOfferIds = new Set(seenOfferIds)
  for (const offer of currentOffers) {
    nextSeenOfferIds.add(offer.id)
  }

  return {
    ...state,
    round: nextRound,
    currentOffers,
    seenOfferIds: [...nextSeenOfferIds],
    freeDiscountCounter,
    halfPriceDiscountCounter,
    lastAction,
    result: null,
  }
}

export function createInitialState(pool: PlayerCard[], rng: Rng = Math.random): GameState {
  const lineupArrangement = createEmptyArrangement()
  const { offers: currentOffers } = generateOffers([], STARTING_BUDGET, lineupArrangement, pool, rng)

  return {
    budgetRemaining: STARTING_BUDGET,
    round: 1,
    freeSkipsRemaining: FREE_SKIP_COUNT,
    paidSkipsUsed: 0,
    roster: [],
    currentOffers,
    seenOfferIds: currentOffers.map((offer) => offer.id),
    lineupArrangement,
    lastAction: '第一组历史报价已送达。预算 100，目标 6 人王朝。',
    result: null,
    freeDiscountCounter: 0,
    halfPriceDiscountCounter: 0,
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
      originalPrice: offer.discountType ? offer.originalPrice : undefined,
      discountType: offer.discountType,
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
    offer.discountType === 'free'
      ? `${getDisplayName(offer)} 触发免费签约，落位 ${slotLabel}。`
      : offer.discountType === 'half-price'
        ? `${getDisplayName(offer)} 触发半价折扣（原价 ${offer.originalPrice}），以 ${offer.price} 预算加盟，落位 ${slotLabel}。`
        : `${getDisplayName(offer)} 以 ${offer.price} 预算加盟，落位 ${slotLabel}。`,
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

  if (state.freeSkipsRemaining > 0) {
    const freeSkipsRemaining = state.freeSkipsRemaining - 1
    const nextState = {
      ...state,
      freeSkipsRemaining,
      currentOffers: [],
      result: null,
    }
    const lastAction = `你免费跳过了本轮，还剩 ${freeSkipsRemaining} 次免费跳过。`

    return advanceOrFinish(nextState, pool, rng, lastAction)
  }

  const paidSkipsUsed = state.paidSkipsUsed + 1
  const budgetCost = paidSkipsUsed * PAID_SKIP_STEP_COST

  if (state.budgetRemaining < budgetCost) {
    throw new Error(`Not enough budget to skip. Need ${budgetCost}.`)
  }

  const nextState = {
    ...state,
    paidSkipsUsed,
    budgetRemaining: state.budgetRemaining - budgetCost,
    currentOffers: [],
    result: null,
  }
  const lastAction = `你支付了 ${budgetCost} 预算跳过本轮。后续下一次跳过将消耗 ${
    (paidSkipsUsed + 1) * PAID_SKIP_STEP_COST
  } 预算。`

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
