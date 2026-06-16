import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { getDisplayName, formatPriceLabel } from '../utils/format'
import {
  getRatingPercent,
  getAttributeGroupRows,
  getAttributeRows,
  getPeakImpactRows,
  getPeakImpactSourceLabel,
} from '../utils/ratings'
import { formatRatingValue } from '../utils/format'
import type { PlayerDetailOverlayState } from '../stores/gameStore'

export function PlayerDetailOverlay({
  detail,
  onClose,
}: {
  detail: PlayerDetailOverlayState
  onClose: () => void
}) {
  const [isClosing, setIsClosing] = useState(false)
  const didCloseRef = useRef(false)
  const peakRows = getPeakImpactRows(detail.card)
  const groupRows = getAttributeGroupRows(detail.card)
  const attributeRows = getAttributeRows(detail.card)

  const requestClose = useCallback(() => {
    setIsClosing(true)
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requestClose])

  return (
    <motion.section
      className="player-detail-overlay"
      aria-label={`${getDisplayName(detail.card)} 评分细分`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose()
        }
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.24 }}
    >
      <motion.div
        className="player-detail-panel"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 14, scale: 0.96, filter: 'saturate(0.82)' }}
        animate={{
          opacity: isClosing ? 0 : 1,
          y: isClosing ? 10 : 0,
          scale: isClosing ? 0.98 : 1,
          filter: isClosing ? 'saturate(0.9)' : 'saturate(1)',
        }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={() => {
          if (isClosing && !didCloseRef.current) {
            didCloseRef.current = true
            onClose()
          }
        }}
      >
        <header className="player-detail-head">
          <span>{detail.card.tier} · {detail.card.positions.join(' / ')}</span>
          <h2>{getDisplayName(detail.card)}</h2>
          <p>
            巅峰 {detail.card.peakImpact.peakValue} · OVR {detail.card.sourceRating} · 价格{' '}
            {formatPriceLabel(detail.price)} · {detail.statusLabel}
          </p>
        </header>

        <section className="player-detail-peak" aria-label="巅峰战力">
          <h3>巅峰战力</h3>
          <p className="player-detail-source">
            {detail.card.peakImpact.peakSeasonLabel} · {getPeakImpactSourceLabel(detail.card)}
          </p>
          {detail.card.peakImpact.manualCorrectionNote && (
            <p className="player-detail-source">{detail.card.peakImpact.manualCorrectionNote}</p>
          )}
          <div className="player-detail-core">
            {peakRows.map((row) => {
              const value = formatRatingValue(row.value)
              return (
                <div key={row.label} className="player-detail-core-item">
                  <span>{row.label}</span>
                  <strong>{value !== null ? value : '—'}</strong>
                </div>
              )
            })}
          </div>
        </section>

        <section className="player-detail-groups" aria-label="属性组">
          <h3>属性组参考</h3>
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
