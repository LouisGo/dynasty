import { create } from 'zustand'
import {
  createInitialState,
  createSeededRng,
  signOffer,
  skipOfferGroup,
  setArrangement,
} from '../game/engine'
import {
  type CourtSlotId,
  type GameState,
  type OfferCard,
  type PlayerCard,
  type ResultSummary,
} from '../game/types'
import { pool, randomSeed } from '../utils/pool'

// Re-exported types for consumer convenience
export type { CourtSlotId, GameState, OfferCard, PlayerCard, ResultSummary }

// ── UI helper types ──

type CardSize = 'large' | 'mini'

export interface DragPreviewState {
  slot: CourtSlotId
  card: PlayerCard
  price: number
  x: number
  y: number
  width: number
  height: number
  offsetX: number
  offsetY: number
}

export interface PlayerDetailOverlayState {
  card: PlayerCard
  price: number
  statusLabel: string
  size: CardSize
}

// ── Store interface ──

interface GameStore {
  // ── Game engine state ──
  gameState: GameState
  rngSeed: number
  previousBudget: number

  // ── Core actions ──
  startGame: () => void
  commitSign: (offer: OfferCard) => void
  skipRound: () => void
  swapSlots: (from: CourtSlotId, to: CourtSlotId) => void

  // ── UI: Player detail overlay (cross-route) ──
  playerDetail: PlayerDetailOverlayState | null
  openPlayerDetail: (detail: PlayerDetailOverlayState) => void
  closePlayerDetail: () => void

  // ── UI: Draft screen state ──
  selectedSlot: CourtSlotId | null
  selectedOfferId: string | null
  isResultPending: boolean
  revealingSlot: CourtSlotId | null
  budgetPulseKey: number

  // ── UI: Drag-and-drop ──
  draggingSlot: CourtSlotId | null
  dragPreview: DragPreviewState | null
  suppressNextSlotClick: boolean

  beginDraggingSlot: (
    slot: CourtSlotId,
    chipRect: DOMRect,
    slotRect: DOMRect,
    clientX: number,
    clientY: number,
    card: PlayerCard & { pricePaid: number },
  ) => void
  clearDraggingSlot: () => void

  // ── Internal helpers ──
  _scheduleResult: () => void
  _setInitialState: () => void
}

// ── Internal helper ──

function getInitialUIState() {
  return {
    selectedSlot: null as CourtSlotId | null,
    selectedOfferId: null as string | null,
    isResultPending: false,
    revealingSlot: null as CourtSlotId | null,
    budgetPulseKey: 0,
    draggingSlot: null as CourtSlotId | null,
    dragPreview: null as DragPreviewState | null,
    suppressNextSlotClick: false,
    playerDetail: null as PlayerDetailOverlayState | null,
  }
}

function createInitialGameState(seed: number): GameState {
  return createInitialState(pool, createSeededRng(seed))
}

// ── Store ──

export const useGameStore = create<GameStore>((set, get) => ({
  // ── Initial state ──
  gameState: createInitialGameState(randomSeed()),
  rngSeed: randomSeed(),
  previousBudget: 100,

  ...getInitialUIState(),

  // ── Core actions ──

  startGame: () => {
    const nextSeed = randomSeed()
    set({
      gameState: createInitialGameState(nextSeed),
      rngSeed: nextSeed,
      previousBudget: 100,
      ...getInitialUIState(),
    })
  },

  commitSign: (offer: OfferCard) => {
    if (offer.offerState !== 'enabled') return

    const { gameState, rngSeed } = get()
    const nextState = signOffer(
      gameState,
      offer.id,
      pool,
      createSeededRng(rngSeed + gameState.round * 17),
    )

    const budgetChanged = nextState.budgetRemaining < gameState.budgetRemaining
    const update: Partial<GameStore> = {
      gameState: nextState,
      selectedSlot: null,
      draggingSlot: null,
      dragPreview: null,
      suppressNextSlotClick: false,
      previousBudget: nextState.budgetRemaining,
    }

    if (budgetChanged) {
      update.budgetPulseKey = get().budgetPulseKey + 1
    }

    set(update as GameStore)
  },

  skipRound: () => {
    const { gameState, rngSeed } = get()
    const nextState = skipOfferGroup(
      gameState,
      pool,
      createSeededRng(rngSeed + gameState.round * 31 + 7),
    )

    const budgetChanged = nextState.budgetRemaining < gameState.budgetRemaining
    const update: Partial<GameStore> = {
      gameState: nextState,
      previousBudget: nextState.budgetRemaining,
    }

    if (budgetChanged) {
      update.budgetPulseKey = get().budgetPulseKey + 1
    }

    set(update as GameStore)
  },

  swapSlots: (from: CourtSlotId, to: CourtSlotId) => {
    if (from === to) return

    const { gameState } = get()
    const arrangement = {
      ...gameState.lineupArrangement,
      [from]: gameState.lineupArrangement[to],
      [to]: gameState.lineupArrangement[from],
    }
    set({
      gameState: setArrangement(gameState, arrangement, pool),
      selectedSlot: null,
      draggingSlot: null,
      dragPreview: null,
      suppressNextSlotClick: false,
    })
  },

  // ── UI: Player detail ──

  openPlayerDetail: (detail) => {
    set({
      playerDetail: detail,
      draggingSlot: null,
      dragPreview: null,
      suppressNextSlotClick: false,
    })
  },

  closePlayerDetail: () => {
    set({ playerDetail: null })
  },

  // ── UI: Drag-and-drop ──

  beginDraggingSlot: (slot, chipRect, _slotRect, clientX, clientY, card) => {
    const preview: DragPreviewState = {
      slot,
      card,
      price: card.pricePaid,
      x: chipRect.left,
      y: chipRect.top,
      width: chipRect.width,
      height: chipRect.height,
      offsetX: clientX - chipRect.left,
      offsetY: clientY - chipRect.top,
    }

    set({
      draggingSlot: slot,
      dragPreview: preview,
      suppressNextSlotClick: false,
    })
  },

  clearDraggingSlot: () => {
    set({
      draggingSlot: null,
      dragPreview: null,
      suppressNextSlotClick: false,
    })
  },

  // ── Internal ──

  _scheduleResult: () => {
    set({ isResultPending: true })
  },

  _setInitialState: () => {
    set(getInitialUIState())
  },
}))
