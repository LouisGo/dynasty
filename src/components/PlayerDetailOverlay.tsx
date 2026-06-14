import { useEffect } from 'react'
import { motion } from 'motion/react'
import { getDisplayName, formatPriceLabel } from '../utils/format'
import { getRatingPercent, getCoreRatingRows, getAttributeGroupRows, getAttributeRows } from '../utils/ratings'
import { formatRatingValue } from '../utils/format'
import type { PlayerDetailOverlayState } from '../stores/gameStore'

export function PlayerDetailOverlay({
  detail,
  onClose,
}: {
  detail: PlayerDetailOverlayState
  onClose: () => void
}) {
  const coreRows = getCoreRatingRows(detail.card)
  const groupRows = getAttributeGroupRows(detail.card)
  const attributeRows = getAttributeRows(detail.card)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <motion.section
      className="player-detail-overlay"
      aria-label={`${getDisplayName(detail.card)} 评分细分`}
      onPointerDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
    >
      <motion.div
        className="player-detail-panel"
        initial={{ opacity: 0, y: 14, scale: 0.96, filter: 'saturate(0.82)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'saturate(1)' }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="player-detail-head">
          <span>{detail.card.tier} · {detail.card.positions.join(' / ')}</span>
          <h2>{getDisplayName(detail.card)}</h2>
          <p>
            OVR {detail.card.sourceRating} · 价格 {formatPriceLabel(detail.price)} · {detail.statusLabel}
          </p>
        </header>

        <section className="player-detail-core" aria-label="核心评分">
          {coreRows.map((row) => {
            const value = formatRatingValue(row.value)
            return (
              <div key={row.label} className="player-detail-core-item">
                <span>{row.label}</span>
                <strong>{value !== null ? value : '—'}</strong>
              </div>
            )
          })}
        </section>

        <section className="player-detail-groups" aria-label="属性组">
          <h3>属性组</h3>
          <div className="player-detail-groups-grid">
            {groupRows.map((row) => {
              const value = formatRatingValue(row.value)
              const percent = getRatingPercent(row.value)
              return (
                <div key={row.label} className="player-detail-group-item">
                  <span className="player-detail-group-label">{row.label}</span>
                  <div className="player-detail-group-bar">
                    <i
                      className="player-detail-group-bar-fill"
                      style={{ '--score': percent } as React.CSSProperties & { '--score': string }}
                    />
                  </div>
                  <strong>{value !== null ? value : '—'}</strong>
                </div>
              )
            })}
          </div>
        </section>

        <section className="player-detail-attributes" aria-label="关键属性">
          <h3>关键属性</h3>
          <div className="player-detail-attributes-grid">
            {attributeRows.map((row) => {
              const value = formatRatingValue(row.value)
              const percent = getRatingPercent(row.value)
              return (
                <div key={row.label} className="player-detail-attribute-item">
                  <span className="player-detail-attribute-label">{row.label}</span>
                  <div className="player-detail-attribute-bar">
                    <i
                      className="player-detail-attribute-bar-fill"
                      style={{ '--score': percent } as React.CSSProperties & { '--score': string }}
                    />
                  </div>
                  <strong>{value !== null ? value : '—'}</strong>
                </div>
              )
            })}
          </div>
        </section>
      </motion.div>
    </motion.section>
  )
}
