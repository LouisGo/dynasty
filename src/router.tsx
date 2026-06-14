import { createRouter, createHashHistory } from '@tanstack/react-router'
import { rootRoute } from './routes/__root'
import { landingRoute } from './routes/index'
import { draftRoute } from './routes/draft'
import { resultRoute } from './routes/result'

const routeTree = rootRoute.addChildren([landingRoute, draftRoute, resultRoute])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: false,
})
