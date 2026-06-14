import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { MAX_ROUNDS, ROSTER_TARGET } from '../game/types'

export function BudgetChip() {
  const budgetRemaining = useGameStore((s) => s.gameState.budgetRemaining)
  const budgetPulseKey = useGameStore((s) => s.budgetPulseKey)

  return (
    <article className="budget-chip">
      <span>预算</span>
      <motion.strong
        key={budgetPulseKey}
        animate={{ scale: [1.08, 1], filter: ['saturate(1.18)', 'saturate(1)'] }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {budgetRemaining}
      </motion.strong>
    </article>
  )
}

export function StatusChips() {
  const round = useGameStore((s) => s.gameState.round)
  const rosterLength = useGameStore((s) => s.gameState.roster.length)
  const freeSkipsRemaining = useGameStore((s) => s.gameState.freeSkipsRemaining)

  return (
    <div className="status-row">
      <article className="status-chip">
        <span>回合</span>
        <strong>{round}/{MAX_ROUNDS}</strong>
      </article>
      <article className="status-chip">
        <span>阵容</span>
        <strong>{rosterLength}/{ROSTER_TARGET}</strong>
      </article>
      <article className="status-chip">
        <span>免费跳过</span>
        <strong>{freeSkipsRemaining}</strong>
      </article>
    </div>
  )
}
