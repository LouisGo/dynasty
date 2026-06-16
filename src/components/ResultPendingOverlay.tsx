import { useRouterState } from '@tanstack/react-router'
import { useGameStore } from '../stores/gameStore'

export function ResultPendingOverlay() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isResultPending = useGameStore((s) => s.isResultPending)

  if (!isResultPending || pathname !== '/draft') return null

  return (
    <section className="result-pending-overlay" aria-live="polite" aria-label="王朝阵容锁定">
      <h2>王朝阵容锁定</h2>
      <p>thinking...</p>
      <span aria-hidden="true" />
    </section>
  )
}
