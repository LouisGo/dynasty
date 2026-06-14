import type { CSSProperties } from 'react'
import { getTeamCode, getTeamLogoUrl } from '../utils/teams'
import { getDisplayName, tierClassName, formatPriceLabel, formatPositions } from '../utils/format'
import { getRatingLabel } from '../utils/ratings'
import { useLongPress } from '../hooks/useLongPress'
import type { PlayerDetailOverlayState } from '../stores/gameStore'
import type { PlayerCard } from '../game/types'

type CardSize = 'large' | 'mini'

interface PlayerCardTileProps {
  card: PlayerCard
  price: number
  size: CardSize
  statusLabel: string
  index?: number
  className?: string
  onLongPressOpen?: (detail: PlayerDetailOverlayState) => void
}

export function PlayerCardTile({
  card,
  price,
  size,
  statusLabel,
  index = 0,
  className = '',
  onLongPressOpen,
}: PlayerCardTileProps) {
  const teamCode = getTeamCode(card.id)
  const isFreeOffer = price === 0
  // discountType and originalPrice come from OfferCard; cast for generic PlayerCard usage
  const discountType = (card as Record<string, unknown>).discountType as string | undefined
  const originalPrice = (card as Record<string, unknown>).originalPrice as number | undefined
  const isHalfPrice = discountType === 'half-price'

  const { isPressing, longPressHandlers } = useLongPress({
    onLongPress: () => {
      if (onLongPressOpen) {
        onLongPressOpen({ card, price, statusLabel, size })
      }
    },
  })

  const hasLongPress = Boolean(onLongPressOpen)

  return (
    <div
      className={[
        'player-card',
        `player-card-${size}`,
        tierClassName(card.tier),
        isFreeOffer ? 'is-free-offer' : '',
        isHalfPrice ? 'is-half-price-offer' : '',
        isPressing ? 'is-long-pressing' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--offer-index': index } as CSSProperties & Record<'--offer-index', number>}
      {...(hasLongPress ? longPressHandlers : {})}
    >
      <div className="player-card-shine" />
      <span className={[
        'player-card-price',
        isHalfPrice ? 'is-half-price' : '',
        isFreeOffer ? 'is-free-price' : '',
      ].filter(Boolean).join(' ')}>
        {(isHalfPrice || isFreeOffer) ? (
          <>
            <span className="player-card-price-main">
              <span className="player-card-price-dollar">$</span>
              <span className="player-card-price-value">{isFreeOffer ? '0' : price}</span>
            </span>
            {originalPrice !== undefined && (
              <span className="player-card-price-original">${originalPrice}</span>
            )}
          </>
        ) : (
          formatPriceLabel(price)
        )}
      </span>
      {teamCode && (
        <img
          className="player-card-logo"
          src={getTeamLogoUrl(teamCode)}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div className="player-card-head">
        <h3>{getDisplayName(card)}</h3>
        {size === 'large' && <p className="player-card-subtitle">{getRatingLabel(card.sourceRating)}</p>}
      </div>
      <div className="player-card-stats">
        <div className="player-card-stat">
          <span>总评</span>
          <strong>{card.sourceRating}</strong>
        </div>
        <div className="player-card-stat">
          <span>{statusLabel}</span>
          <strong>{formatPositions(card.positions)}</strong>
        </div>
      </div>
    </div>
  )
}
