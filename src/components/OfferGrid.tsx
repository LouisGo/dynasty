import { useGameStore } from '../stores/gameStore'
import { getOfferStateText, getTargetSlotForOffer } from '../utils/results'
import { PlayerCardTile } from './PlayerCardTile'
import type { OfferCard } from '../game/types'

export function OfferGrid() {
  const gameState = useGameStore((s) => s.gameState)
  const selectedOfferId = useGameStore((s) => s.selectedOfferId)
  const isResultPending = useGameStore((s) => s.isResultPending)
  const openPlayerDetail = useGameStore((s) => s.openPlayerDetail)
  const commitSign = useGameStore((s) => s.commitSign)

  function handleSign(offer: OfferCard) {
    if (offer.offerState !== 'enabled' || selectedOfferId || isResultPending) return

    const targetSlot = getTargetSlotForOffer(offer, gameState.lineupArrangement)

    // Animate out the selected card, then commit
    useGameStore.setState({ selectedOfferId: offer.id })

    window.setTimeout(() => {
      commitSign(offer)
      useGameStore.setState({
        selectedOfferId: null,
        revealingSlot: targetSlot,
      })

      window.setTimeout(() => {
        useGameStore.setState({ revealingSlot: null })
      }, 520)
    }, 300)
  }

  return (
    <section
      className={`offer-stage ${selectedOfferId ? 'is-transitioning' : ''}`}
      key={gameState.round}
    >
      {gameState.currentOffers.map((offer, index) => (
        <button
          key={offer.id}
          type="button"
          className={[
            'offer-card-button',
            offer.offerState !== 'enabled' ? 'is-disabled' : '',
            selectedOfferId === offer.id ? 'is-selected-for-signing' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => handleSign(offer)}
          aria-disabled={offer.offerState !== 'enabled' || Boolean(selectedOfferId)}
        >
          <PlayerCardTile
            card={offer}
            price={offer.price}
            size="large"
            statusLabel={getOfferStateText(offer)}
            index={index}
            onLongPressOpen={openPlayerDetail}
          />
        </button>
      ))}
    </section>
  )
}
