import { useEffect } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { useGameStore } from '../stores/gameStore'
import { scrollToPageTop } from '../hooks/useBudgetPulse'
import { getResultReason, getResultLineup, getMetricTone } from '../utils/results'
import { formatSlotLabel } from '../utils/format'
import { PlayerCardTile } from '../components/PlayerCardTile'

function ResultRoute() {
  const navigate = useNavigate()
  const gameState = useGameStore((s) => s.gameState)
  const startGame = useGameStore((s) => s.startGame)
  const openPlayerDetail = useGameStore((s) => s.openPlayerDetail)
  const result = gameState.result

  useEffect(() => {
    document.title = '阵容结算 — NBA Dynasty Draft'
    scrollToPageTop()
    useGameStore.setState({ isResultPending: false })

    // Guard: if there's no result (e.g. direct navigation, page refresh handled by root),
    // redirect to home so the user can start a new game
    if (!result) {
      navigate({ to: '/', replace: true })
    }
  }, [navigate, result])

  function handlePlayAgain() {
    startGame()
    navigate({ to: '/draft' })
  }

  if (!result) return null

  return (
    <main className="app-shell result">
      <section className="screen result-screen">
        <div className="result-hero">
          <p className="eyebrow">{getResultReason(result.gameOverReason)}</p>
          <h2>王朝评分</h2>
          <p>
            巅峰 {result.peakImpactScore} · 上限 {result.ceilingScore} · 契合{' '}
            {result.synergyFitScore} · 组队效率 {result.budgetScore}
          </p>
        </div>

        <section className="result-metrics">
          <article className={getMetricTone(result.dynastyScore, 88, 75)}>
            <span>王朝评分</span>
            <strong>{result.dynastyScore}</strong>
          </article>
          <article className={getMetricTone(result.projectedWins, 68, 55)}>
            <span>预计战绩</span>
            <strong>
              {result.projectedWins}-{result.projectedLosses}
            </strong>
          </article>
          <article className={getMetricTone(result.championshipOdds, 70, 35)}>
            <span>夺冠概率</span>
            <strong>{result.championshipOdds}%</strong>
          </article>
        </section>

        <section className="result-breakdown" aria-label="阵容分析">
          <article>
            <span>进攻影响</span>
            <strong>{result.offenseImpactScore}</strong>
          </article>
          <article>
            <span>防守体系</span>
            <strong>{result.defenseImpactScore}</strong>
          </article>
          <article>
            <span>阵容上限</span>
            <strong>{result.ceilingScore}</strong>
          </article>
          <article>
            <span>角色契合</span>
            <strong>{result.synergyFitScore}</strong>
          </article>
        </section>

        <section className="result-lineup-grid" aria-label="最终阵容">
          {getResultLineup(result).map(({ slot, card, pricePaid }) => (
            <article
              key={slot}
              className={`result-lineup-card ${card ? 'is-filled' : 'is-empty'}`}
            >
              <span className="result-slot-label">{formatSlotLabel(slot)}</span>
              {card ? (
                <PlayerCardTile
                  card={card}
                  price={pricePaid}
                  size="large"
                  statusLabel={formatSlotLabel(slot)}
                  className="result-player-card"
                  onLongPressOpen={openPlayerDetail}
                />
              ) : (
                <div className="result-empty-slot">
                  <strong>{formatSlotLabel(slot)}</strong>
                  <span>空位</span>
                </div>
              )}
            </article>
          ))}
        </section>

        <section className="result-summary">
          <button type="button" className="primary-button" onClick={handlePlayAgain}>
            再来一局
          </button>
        </section>
      </section>
    </main>
  )
}

export const resultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/result',
  component: ResultRoute,
})
