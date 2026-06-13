import { pickDynastyTitle } from './titles'
import {
  COURT_SLOTS,
  OFFER_COUNT,
  ROSTER_TARGET,
  SKIP_TOKENS,
  SIXTH_SLOT,
  STAR_BONUS,
  STARTING_BUDGET,
  STARTING_POSITIONS,
  type GameState,
  type LineupArrangement,
  type LineupSlot,
  type OfferCard,
  type OfferState,
  type OwnedCard,
  type PartialLineup,
  type PlayerCard,
  type ResultSummary,
  type StarterAssignment,
} from './types'

type Rng = () => number

interface CandidateOffer {
  card: PlayerCard
  offerKind: 'new' | 'upgrade'
  starTarget: number
  price: number
  offerState: OfferState
}

interface SearchResult {
  assignments: LineupSlot[]
  usedPlayerIds: Set<string>
  filledCount: number
  totalPower: number
}

function getPlayerIndex(pool: PlayerCard[]) {
  return new Map(pool.map((card) => [card.id, card]))
}

function getOwnedMap(roster: OwnedCard[]) {
  return new Map(roster.map((owned) => [owned.playerId, owned]))
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

function weightedPick<T extends { rarityWeight: number }>(
  options: T[],
  rng: Rng,
  blocked = new Set<string>(),
  idGetter: (item: T) => string,
) {
  const filtered = options.filter((option) => !blocked.has(idGetter(option)))
  const total = filtered.reduce((sum, option) => sum + option.rarityWeight, 0)

  if (!filtered.length || total <= 0) {
    return null
  }

  let cursor = rng() * total
  for (const option of filtered) {
    cursor -= option.rarityWeight
    if (cursor <= 0) {
      return option
    }
  }

  return filtered.at(-1) ?? null
}

function getPrice(card: PlayerCard, owned: OwnedCard | undefined) {
  return owned ? Math.ceil(card.contractCost / 2) : card.contractCost
}

function getRequiredReserve(uniquePlayersAfter: number) {
  return Math.max(0, ROSTER_TARGET - uniquePlayersAfter) * 7
}

function getOfferState(
  budgetRemaining: number,
  uniqueCount: number,
  card: PlayerCard,
  owned: OwnedCard | undefined,
): OfferState {
  if (owned && owned.stars >= 3) {
    return 'maxed-out'
  }

  const price = getPrice(card, owned)
  if (price > budgetRemaining) {
    return 'too-expensive'
  }

  const uniqueAfter = uniqueCount + (owned ? 0 : 1)
  if (budgetRemaining - price < getRequiredReserve(uniqueAfter)) {
    return 'reserve-blocked'
  }

  return 'enabled'
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

export function getCardPower(card: PlayerCard, stars: number) {
  return card.sourceRating + (stars - 1) * STAR_BONUS
}

function searchBestAssignments(
  roster: OwnedCard[],
  poolIndex: Map<string, PlayerCard>,
  requireFullLineup: boolean,
): SearchResult {
  const emptyAssignments = STARTING_POSITIONS.map((slot) => ({
    slot,
    playerId: null,
    stars: 0,
    power: 0,
  }))

  const best: SearchResult = {
    assignments: emptyAssignments,
    usedPlayerIds: new Set<string>(),
    filledCount: requireFullLineup ? -1 : 0,
    totalPower: 0,
  }

  function isBetter(result: SearchResult) {
    if (result.filledCount !== best.filledCount) {
      return result.filledCount > best.filledCount
    }

    return result.totalPower > best.totalPower
  }

  function walk(
    positionIndex: number,
    usedPlayerIds: Set<string>,
    assignments: LineupSlot[],
    filledCount: number,
    totalPower: number,
  ) {
    if (positionIndex >= STARTING_POSITIONS.length) {
      const result = {
        assignments: assignments.map((assignment) => ({ ...assignment })),
        usedPlayerIds: new Set(usedPlayerIds),
        filledCount,
        totalPower,
      }

      if (isBetter(result)) {
        best.assignments = result.assignments
        best.usedPlayerIds = result.usedPlayerIds
        best.filledCount = result.filledCount
        best.totalPower = result.totalPower
      }

      return
    }

    const slot = STARTING_POSITIONS[positionIndex]

    if (!requireFullLineup) {
      assignments[positionIndex] = { slot, playerId: null, stars: 0, power: 0 }
      walk(positionIndex + 1, usedPlayerIds, assignments, filledCount, totalPower)
    }

    for (const owned of roster) {
      if (usedPlayerIds.has(owned.playerId)) {
        continue
      }

      const card = poolIndex.get(owned.playerId)
      if (!card || !card.positions.includes(slot)) {
        continue
      }

      usedPlayerIds.add(owned.playerId)
      assignments[positionIndex] = {
        slot,
        playerId: owned.playerId,
        stars: owned.stars,
        power: getCardPower(card, owned.stars),
      }
      walk(
        positionIndex + 1,
        usedPlayerIds,
        assignments,
        filledCount + 1,
        totalPower + getCardPower(card, owned.stars),
      )
      usedPlayerIds.delete(owned.playerId)
    }
  }

  walk(0, new Set<string>(), emptyAssignments.map((slot) => ({ ...slot })), 0, 0)
  return best
}

export function getPartialLineup(roster: OwnedCard[], pool: PlayerCard[]): PartialLineup {
  const result = searchBestAssignments(roster, getPlayerIndex(pool), false)
  const missingPositions = result.assignments
    .filter((assignment) => assignment.playerId === null)
    .map((assignment) => assignment.slot)

  return {
    assignments: result.assignments,
    filledCount: result.filledCount,
    totalPower: result.totalPower,
    missingPositions,
  }
}

export function canFormStarter(roster: OwnedCard[], pool: PlayerCard[]) {
  return searchBestAssignments(roster, getPlayerIndex(pool), true).filledCount === 5
}

export function createDefaultArrangement(roster: OwnedCard[], pool: PlayerCard[]): LineupArrangement {
  const arrangement = createEmptyArrangement()
  const playerIndex = getPlayerIndex(pool)
  const best =
    roster.length >= STARTING_POSITIONS.length
      ? searchBestAssignments(roster, playerIndex, canFormStarter(roster, pool))
      : searchBestAssignments(roster, playerIndex, false)

  const assigned = new Set<string>()
  for (const assignment of best.assignments) {
    if (assignment.playerId) {
      arrangement[assignment.slot] = assignment.playerId
      assigned.add(assignment.playerId)
    }
  }

  const leftovers = roster.filter((owned) => !assigned.has(owned.playerId))
  if (leftovers[0]) {
    arrangement.SIX = leftovers[0].playerId
    assigned.add(leftovers[0].playerId)
  }

  const remainingSlots = COURT_SLOTS.filter((slot) => arrangement[slot] === null)
  const unassignedPlayers = roster.filter((owned) => !assigned.has(owned.playerId))
  unassignedPlayers.forEach((owned, index) => {
    const slot = remainingSlots[index]
    if (slot) {
      arrangement[slot] = owned.playerId
    }
  })

  return arrangement
}

export function syncArrangement(
  current: LineupArrangement,
  roster: OwnedCard[],
  pool: PlayerCard[],
): LineupArrangement {
  const next = createEmptyArrangement()
  const validIds = new Set(roster.map((owned) => owned.playerId))
  const occupied = new Set<string>()

  for (const slot of COURT_SLOTS) {
    const playerId = current[slot]
    if (playerId && validIds.has(playerId) && !occupied.has(playerId)) {
      next[slot] = playerId
      occupied.add(playerId)
    }
  }

  const suggested = createDefaultArrangement(roster, pool)
  for (const slot of COURT_SLOTS) {
    if (next[slot] === null) {
      const playerId = suggested[slot]
      if (playerId && !occupied.has(playerId)) {
        next[slot] = playerId
        occupied.add(playerId)
      }
    }
  }

  const remainingPlayers = roster
    .map((owned) => owned.playerId)
    .filter((playerId) => !occupied.has(playerId))
  const remainingSlots = COURT_SLOTS.filter((slot) => next[slot] === null)

  remainingSlots.forEach((slot, index) => {
    next[slot] = remainingPlayers[index] ?? null
  })

  return next
}

function pickOfferFromPool(
  candidates: CandidateOffer[],
  rng: Rng,
  blockedIds: Set<string>,
  enabledOnly: boolean,
) {
  const weighted = candidates
    .filter((candidate) =>
      enabledOnly ? candidate.offerState === 'enabled' : candidate.offerState !== 'maxed-out',
    )
    .map((candidate) => ({
      ...candidate,
      rarityWeight:
        candidate.offerKind === 'upgrade' ? candidate.card.rarityWeight * 0.28 : candidate.card.rarityWeight,
    }))

  return weightedPick(weighted, rng, blockedIds, (candidate) => candidate.card.id)
}

export function generateOffers(
  roster: OwnedCard[],
  budgetRemaining: number,
  pool: PlayerCard[],
  rng: Rng = Math.random,
): OfferCard[] {
  const ownedMap = getOwnedMap(roster)
  const uniqueCount = roster.length
  const partial = getPartialLineup(roster, pool)
  const candidates: CandidateOffer[] = pool.map((card) => {
    const owned = ownedMap.get(card.id)
    return {
      card,
      offerKind: owned ? 'upgrade' : 'new',
      starTarget: owned ? Math.min(owned.stars + 1, 3) : 1,
      price: getPrice(card, owned),
      offerState: getOfferState(budgetRemaining, uniqueCount, card, owned),
    }
  })
  const blockedIds = new Set<string>()
  const offers: OfferCard[] = []
  const needPositionGuard =
    uniqueCount < STARTING_POSITIONS.length && partial.missingPositions.length > 0

  if (!candidates.some((candidate) => candidate.offerState === 'enabled')) {
    throw new Error('Offer generation failed: no enabled candidates remain.')
  }

  if (needPositionGuard) {
    const forcedPool = candidates.filter(
      (candidate) =>
        candidate.offerState === 'enabled' &&
        candidate.offerKind === 'new' &&
        candidate.card.positions.some((position) => partial.missingPositions.includes(position)),
    )
    const forced = pickOfferFromPool(forcedPool, rng, blockedIds, true)

    if (forced) {
      blockedIds.add(forced.card.id)
      offers.push({
        ...forced.card,
        offerKind: forced.offerKind,
        starTarget: forced.starTarget,
        price: forced.price,
        offerState: forced.offerState,
      })
    }
  }

  while (offers.length < OFFER_COUNT) {
    const requireEnabled = !offers.some((offer) => offer.offerState === 'enabled')
    const picked =
      pickOfferFromPool(candidates, rng, blockedIds, requireEnabled) ??
      pickOfferFromPool(candidates, rng, blockedIds, true)

    if (!picked) {
      break
    }

    blockedIds.add(picked.card.id)
    offers.push({
      ...picked.card,
      offerKind: picked.offerKind,
      starTarget: picked.starTarget,
      price: picked.price,
      offerState: picked.offerState,
    })
  }

  if (!offers.some((offer) => offer.offerState === 'enabled')) {
    throw new Error('Offer generation failed: no enabled card surfaced.')
  }

  if (needPositionGuard) {
    const hasFixer = offers.some(
      (offer) =>
        offer.offerState === 'enabled' &&
        offer.offerKind === 'new' &&
        offer.positions.some((position) => partial.missingPositions.includes(position)),
    )

    if (!hasFixer) {
      throw new Error('Offer generation failed: no enabled card covers a missing starter slot.')
    }
  }

  return offers
}

function createResultSummary(
  roster: OwnedCard[],
  budgetRemaining: number,
  arrangement: LineupArrangement,
  pool: PlayerCard[],
): ResultSummary {
  const playerIndex = getPlayerIndex(pool)
  const ownedMap = getOwnedMap(roster)
  const used = new Set<string>()
  const starters = STARTING_POSITIONS.map((slot) => {
    const playerId = arrangement[slot]
    if (!playerId) {
      throw new Error(`Missing player at ${slot}.`)
    }

    if (used.has(playerId)) {
      throw new Error(`Duplicate player assignment for ${playerId}.`)
    }

    const owned = ownedMap.get(playerId)
    const card = playerIndex.get(playerId)
    if (!owned || !card) {
      throw new Error(`Unknown player ${playerId}.`)
    }

    if (!card.positions.includes(slot)) {
      throw new Error(`${card.name} cannot start at ${slot}.`)
    }

    used.add(playerId)
    return {
      slot,
      playerId,
      stars: owned.stars,
      power: getCardPower(card, owned.stars),
    }
  })

  const sixthPlayerId = arrangement[SIXTH_SLOT]
  if (!sixthPlayerId) {
    throw new Error('Missing sixth man.')
  }

  if (used.has(sixthPlayerId)) {
    throw new Error('Sixth man duplicates a starter.')
  }

  const benchOwned = ownedMap.get(sixthPlayerId)
  const benchCard = playerIndex.get(sixthPlayerId)
  if (!benchOwned || !benchCard) {
    throw new Error(`Unknown player ${sixthPlayerId}.`)
  }

  const sixthMan: StarterAssignment = {
    slot: benchCard.positions[0] ?? 'SF',
    playerId: sixthPlayerId,
    stars: benchOwned.stars,
    power: getCardPower(benchCard, benchOwned.stars),
  }

  const totalPower = starters.reduce((sum, starter) => sum + starter.power, 0) + sixthMan.power
  const budgetSpent = STARTING_BUDGET - budgetRemaining
  const teamRating = Math.round(totalPower / ROSTER_TARGET)
  const efficiencyScore = Number((totalPower / Math.max(budgetSpent, 1)).toFixed(2))
  const totalStars = roster.reduce((sum, player) => sum + player.stars, 0)
  const summaryWithoutTitle = {
    starters,
    sixthMan,
    totalPower,
    teamRating,
    efficiencyScore,
    budgetSpent,
    budgetRemaining,
    totalStars,
  }

  return {
    ...summaryWithoutTitle,
    title: pickDynastyTitle(summaryWithoutTitle, playerIndex),
  }
}

export function createInitialState(pool: PlayerCard[], rng: Rng = Math.random): GameState {
  return {
    budgetRemaining: STARTING_BUDGET,
    offerCount: 1,
    skipsRemaining: SKIP_TOKENS,
    roster: [],
    currentOffers: generateOffers([], STARTING_BUDGET, pool, rng),
    lineupArrangement: createEmptyArrangement(),
    lastAction: '第一组报价已送达，先定你的王朝底色。',
    result: null,
  }
}

export function signOffer(
  state: GameState,
  offerId: string,
  pool: PlayerCard[],
  rng: Rng = Math.random,
): GameState {
  const offer = state.currentOffers.find((candidate) => candidate.id === offerId)
  if (!offer) {
    throw new Error(`Offer ${offerId} not found.`)
  }

  if (offer.offerState !== 'enabled') {
    throw new Error(`Offer ${offerId} is not signable.`)
  }

  const roster = state.roster.map((owned) => ({ ...owned }))
  const existing = roster.find((owned) => owned.playerId === offer.id)
  const player = pool.find((card) => card.id === offer.id)

  if (!player) {
    throw new Error(`Unknown player ${offer.id}`)
  }

  if (existing) {
    existing.stars = Math.min(3, existing.stars + 1)
    existing.totalCost += offer.price
  } else {
    roster.push({
      playerId: offer.id,
      stars: 1,
      totalCost: offer.price,
    })
  }

  const budgetRemaining = state.budgetRemaining - offer.price
  const lineupArrangement = syncArrangement(state.lineupArrangement, roster, pool)
  const lastAction =
    offer.offerKind === 'upgrade'
      ? `${player.name} 升到 ${offer.starTarget} 星，预算压力也跟着上来了。`
      : `${player.name} 加盟，阵容骨架更清晰了。`

  if (roster.length >= ROSTER_TARGET) {
    return {
      budgetRemaining,
      offerCount: state.offerCount,
      skipsRemaining: state.skipsRemaining,
      roster,
      currentOffers: [],
      lineupArrangement,
      lastAction: '6 人池已成型，拖拽确认首发位置后再进入总评。',
      result: null,
    }
  }

  return {
    budgetRemaining,
    offerCount: state.offerCount + 1,
    skipsRemaining: state.skipsRemaining,
    roster,
    currentOffers: generateOffers(roster, budgetRemaining, pool, rng),
    lineupArrangement,
    lastAction,
    result: null,
  }
}

export function skipOfferGroup(
  state: GameState,
  pool: PlayerCard[],
  rng: Rng = Math.random,
): GameState {
  if (state.result) {
    throw new Error('Cannot skip after the run is complete.')
  }

  if (state.skipsRemaining <= 0) {
    throw new Error('No skips remaining.')
  }

  return {
    ...state,
    offerCount: state.offerCount + 1,
    skipsRemaining: state.skipsRemaining - 1,
    currentOffers: generateOffers(state.roster, state.budgetRemaining, pool, rng),
    lastAction: `你跳过了这轮报价，还剩 ${state.skipsRemaining - 1} 次观望机会。`,
  }
}

export function setArrangement(
  state: GameState,
  arrangement: LineupArrangement,
  pool: PlayerCard[],
): GameState {
  return {
    ...state,
    lineupArrangement: syncArrangement(arrangement, state.roster, pool),
  }
}

export function canConfirmArrangement(
  roster: OwnedCard[],
  arrangement: LineupArrangement,
  pool: PlayerCard[],
) {
  const playerIndex = getPlayerIndex(pool)
  const validIds = new Set(roster.map((owned) => owned.playerId))
  const used = new Set<string>()

  for (const slot of STARTING_POSITIONS) {
    const playerId = arrangement[slot]
    if (!playerId || !validIds.has(playerId) || used.has(playerId)) {
      return false
    }

    const card = playerIndex.get(playerId)
    if (!card || !card.positions.includes(slot)) {
      return false
    }

    used.add(playerId)
  }

  const sixthPlayerId = arrangement[SIXTH_SLOT]
  return Boolean(sixthPlayerId && validIds.has(sixthPlayerId) && !used.has(sixthPlayerId))
}

export function confirmLineup(state: GameState, pool: PlayerCard[]): GameState {
  if (!canConfirmArrangement(state.roster, state.lineupArrangement, pool)) {
    throw new Error('Lineup arrangement is incomplete or invalid.')
  }

  return {
    ...state,
    result: createResultSummary(
      state.roster,
      state.budgetRemaining,
      state.lineupArrangement,
      pool,
    ),
  }
}
