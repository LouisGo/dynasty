import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
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
  const discountType = (card as unknown as Record<string, unknown>).discountType as string | undefined
  const originalPrice = (card as unknown as Record<string, unknown>).originalPrice as number | undefined
  const isHalfPrice = discountType === 'half-price'

  function openDetail() {
    if (onLongPressOpen) {
      onLongPressOpen({ card, price, statusLabel, size })
    }
  }

  const { isPressing, longPressHandlers } = useLongPress({
    onLongPress: openDetail,
  })

  const hasLongPress = Boolean(onLongPressOpen)

  function handleDetailIconPointerDown(event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault()
    event.stopPropagation()
  }

  function handleDetailIconClick(event: ReactMouseEvent<HTMLSpanElement>) {
    event.preventDefault()
    event.stopPropagation()
    openDetail()
  }

  function handleDetailIconKeyDown(event: ReactKeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    openDetail()
  }

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
        <h3>
          <span className="player-card-name-text">{getDisplayName(card)}</span>
          {hasLongPress && (
            <span
              className="player-card-detail-trigger"
              role="button"
              tabIndex={0}
              aria-label={`查看 ${getDisplayName(card)} 详情`}
              onPointerDown={handleDetailIconPointerDown}
              onClick={handleDetailIconClick}
              onKeyDown={handleDetailIconKeyDown}
            />
          )}
        </h3>
        {size === 'large' && <p className="player-card-subtitle">{getRatingLabel(card.sourceRating)}</p>}
      </div>
      <div className="player-card-stats">
        <div className="player-card-stat">
          <span>巅峰</span>
          <strong>{card.peakImpact.peakValue}</strong>
        </div>
        <div className="player-card-stat">
          <span>{statusLabel}</span>
          <strong>{formatPositions(card.positions)}</strong>
        </div>
      </div>
    </div>
  )
}
