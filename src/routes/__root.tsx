import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Backdrop } from '../components/Backdrop'
import { PlayerDetailOverlay } from '../components/PlayerDetailOverlay'
import { useGameStore } from '../stores/gameStore'

function RootLayout() {
  const playerDetail = useGameStore((s) => s.playerDetail)
  const closePlayerDetail = useGameStore((s) => s.closePlayerDetail)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

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
