import { useEffect } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { useGameStore } from '../stores/gameStore'
import { scrollToPageTop } from '../hooks/useBudgetPulse'
import { OFFER_COUNT, MAX_ROUNDS, FREE_SKIP_COUNT } from '../game/types'

function LandingRoute() {
  const startGame = useGameStore((s) => s.startGame)
  const navigate = useNavigate()

  useEffect(() => {
    document.title = '王朝选秀 — NBA Dynasty Draft'
    scrollToPageTop()
  }, [])

  function handleStart() {
    startGame()
    navigate({ to: '/draft' })
  }

  return (
    <main className="app-shell landing">
      <section className="screen landing-screen">
        <div className="landing-copy">
          <p className="eyebrow">王朝选秀</p>
          <h1>100 预算，20 回合，抽一套历史王朝。</h1>
          <p className="landing-body">
            每轮四张历史球星卡，价格每次重掷，偶尔会出现免费签约。签下一人或跳过，填满五个首发和第六人即结算。
          </p>
          <div className="landing-actions">
            <button type="button" className="primary-button" onClick={handleStart}>
              开始选秀
            </button>
            <p className="micro-copy">
              {FREE_SKIP_COUNT} 次免费跳过，用完后可继续付预算重抽，且每次递增 +2。
            </p>
          </div>
        </div>

        <div className="landing-poster">
          <div className="poster-strip">
            <span>{OFFER_COUNT} 张候选</span>
            <span>{MAX_ROUNDS} 回合</span>
            <span>100 预算</span>
          </div>
          <div className="poster-metric">
            <strong>6</strong>
            <span>PG / SG / SF / PF / C / 第六人</span>
          </div>
          <div className="poster-detail">
            <p>OVR 越高越稀有，顶级卡价格波动更大，轮换卡更容易刷到免费。</p>
            <p>第六人不限位置，重复球员禁止签约。</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingRoute,
})
