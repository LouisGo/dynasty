import { useGameStore } from '../stores/gameStore'
import { getPaidSkipCost } from '../utils/pool'
import { RestartIcon } from './RestartIcon'

export function ActionBar() {
  const gameState = useGameStore((s) => s.gameState)
  const isResultPending = useGameStore((s) => s.isResultPending)
  const startGame = useGameStore((s) => s.startGame)
  const skipRound = useGameStore((s) => s.skipRound)

  const skipLabel =
    gameState.freeSkipsRemaining > 0
      ? `跳过本轮（免费 ${gameState.freeSkipsRemaining}）`
      : gameState.budgetRemaining >= getPaidSkipCost(gameState.paidSkipsUsed)
        ? `跳过本轮（-${getPaidSkipCost(gameState.paidSkipsUsed)} 预算）`
        : `预算不足，无法跳过（需 ${getPaidSkipCost(gameState.paidSkipsUsed)}）`

  const canSkip =
    gameState.freeSkipsRemaining > 0 ||
    gameState.budgetRemaining >= getPaidSkipCost(gameState.paidSkipsUsed)

  return (
    <section className="action-bar">
      <button
        type="button"
        className="ghost-button restart-icon-button"
        onClick={startGame}
        aria-label="重新开始"
        title="重新开始"
      >
        <RestartIcon />
      </button>
      <button
        type="button"
        className="primary-button skip-button"
        onClick={skipRound}
        disabled={!canSkip || isResultPending}
      >
        {skipLabel}
      </button>
    </section>
  )
}
