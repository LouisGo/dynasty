import { useEffect, useRef } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { useGameStore } from '../stores/gameStore'
import { scrollToPageTop } from '../hooks/useBudgetPulse'
import { BudgetChip, StatusChips } from '../components/BudgetChip'
import { OfferGrid } from '../components/OfferGrid'
import { ActionBar } from '../components/ActionBar'
import { CourtEditor } from '../components/CourtEditor'

function DraftRoute() {
  const navigate = useNavigate()
  const gameState = useGameStore((s) => s.gameState)
  const lastAction = gameState.lastAction

  // Timer refs
  const resultTimerRef = useRef<number | null>(null)
  const resultScheduledRef = useRef(false)

  useEffect(() => {
    document.title = '选秀中 — NBA Dynasty Draft'
    scrollToPageTop()

    return () => {
      if (resultTimerRef.current !== null) {
        window.clearTimeout(resultTimerRef.current)
      }
    }
  }, [])

  // Watch for game over → navigate to result after delay
  useEffect(() => {
    if (gameState.result && !resultScheduledRef.current) {
      resultScheduledRef.current = true
      useGameStore.setState({ isResultPending: true })

      resultTimerRef.current = window.setTimeout(() => {
        useGameStore.setState({ isResultPending: false })
        resultScheduledRef.current = false
        navigate({ to: '/result' })
        scrollToPageTop()
        resultTimerRef.current = null
      }, 2500)
    }
  }, [gameState.result, navigate])

  return (
    <main className="app-shell draft">
      <section className="screen draft-screen">
        <header className="draft-header">
          <BudgetChip />
          <StatusChips />
        </header>

        <OfferGrid />

        <ActionBar />

        <p className="pool-note">{lastAction}</p>

        <CourtEditor />
      </section>
    </main>
  )
}

export const draftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draft',
  component: DraftRoute,
})
