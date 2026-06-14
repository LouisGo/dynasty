import { createRootRoute, Outlet, useRouterState, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Backdrop } from '../components/Backdrop'
import { PlayerDetailOverlay } from '../components/PlayerDetailOverlay'
import { DragPreview } from '../components/DragPreview'
import { ResultPendingOverlay } from '../components/ResultPendingOverlay'
import { useGameStore } from '../stores/gameStore'

function RootLayout() {
  const playerDetail = useGameStore((s) => s.playerDetail)
  const closePlayerDetail = useGameStore((s) => s.closePlayerDetail)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // On page refresh, force redirect to home so the user always starts fresh
  useEffect(() => {
    const loadedKey = 'nba-draft-loaded'
    const isReload = !sessionStorage.getItem(loadedKey)
    sessionStorage.setItem(loadedKey, '1')
    if (isReload && pathname !== '/') {
      navigate({ to: '/', replace: true })
    }
  }, [])

  return (
    <>
      <Backdrop />
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 14, scale: 0.985, filter: 'saturate(0.82)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'saturate(1)' }}
          exit={{ opacity: 0, y: -14, scale: 0.985 }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>

      {/* Fixed-position overlays render outside the motion wrapper so CSS transforms don't create a new containing block */}
      <DragPreview />
      <ResultPendingOverlay />

      <AnimatePresence>
        {playerDetail && (
          <PlayerDetailOverlay
            detail={playerDetail}
            onClose={closePlayerDetail}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export const rootRoute = createRootRoute({
  component: RootLayout,
})
