import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import legendPool from './data/legend-pool.json'
import './App.css'
import {
  createInitialState,
  createSeededRng,
  skipOfferGroup,
  signOffer,
  setArrangement,
} from './game/engine'
import {
  COURT_SLOTS,
  FREE_SKIP_COUNT,
  MAX_ROUNDS,
  OFFER_COUNT,
  PAID_SKIP_COST,
  ROSTER_TARGET,
  SIXTH_SLOT,
  type CourtSlotId,
  type DraftedPlayer,
  type GameOverReason,
  type GameState,
  type OfferCard,
  type PlayerCard,
  type Position,
  type Tier,
} from './game/types'

const pool = legendPool as PlayerCard[]
const poolIndex = new Map(pool.map((card) => [card.id, card]))

type Screen = 'landing' | 'draft' | 'result'
type CardSize = 'large' | 'mini'

interface PlayerCardTileProps {
  card: PlayerCard
  price: number
  size: CardSize
  statusLabel: string
  index?: number
  className?: string
}

interface FlyingCardState {
  card: PlayerCard
  price: number
  statusLabel: string
  from: DOMRect
  to: DOMRect
}

const teamCodeByPlayerId: Record<string, string> = {
  'michael-jordan': 'chi',
  'lebron-james': 'cle',
  'kareem-abdul-jabbar': 'lal',
  'magic-johnson': 'lal',
  'kobe-bryant': 'lal',
  'shaquille-oneal': 'lal',
  'tim-duncan': 'sas',
  'larry-bird': 'bos',
  'hakeem-olajuwon': 'hou',
  'wilt-chamberlain': 'lal',
  'stephen-curry': 'gs',
  'bill-russell': 'bos',
  'kevin-durant': 'gs',
  'julius-erving': 'phi',
  'dirk-nowitzki': 'dal',
  'kevin-garnett': 'min',
  'moses-malone': 'phi',
  'nikola-jokic': 'den',
  'giannis-antetokounmpo': 'mil',
  'dwyane-wade': 'mia',
  'isiah-thomas': 'det',
  'charles-barkley': 'phx',
  'allen-iverson': 'phi',
  'scottie-pippen': 'chi',
  'david-robinson': 'sas',
  'john-stockton': 'uta',
  'karl-malone': 'uta',
  'chris-paul': 'lac',
  'kawhi-leonard': 'tor',
  'steve-nash': 'phx',
  'james-harden': 'hou',
  'tracy-mcgrady': 'orl',
  'patrick-ewing': 'ny',
  'clyde-drexler': 'por',
  'ray-allen': 'sea',
  'reggie-miller': 'ind',
  'manu-ginobili': 'sas',
  'pau-gasol': 'lal',
  'dwight-howard': 'orl',
  'yao-ming': 'hou',
  'vince-carter': 'tor',
  'damian-lillard': 'por',
  'dominique-wilkins': 'atl',
  'paul-pierce': 'bos',
  'dennis-rodman': 'chi',
  'gary-payton': 'sea',
  'jason-kidd': 'dal',
  'rick-barry': 'gs',
  'george-gervin': 'sas',
  'elvin-hayes': 'was',
  'bob-mcadoo': 'lac',
  'anthony-davis': 'lal',
  'russell-westbrook': 'okc',
  'luka-doncic': 'dal',
  'joel-embiid': 'phi',
  'nate-archibald': 'sac',
  'alex-english': 'den',
  'bernard-king': 'ny',
  'chris-webber': 'sac',
  alonzomourning: 'mia',
  'dikembe-mutombo': 'den',
  'tony-parker': 'sas',
  'carmelo-anthony': 'ny',
  'klay-thompson': 'gs',
  'draymond-green': 'gs',
  'jimmy-butler': 'mia',
  'paul-george': 'ind',
  'kyrie-irving': 'cle',
  'grant-hill': 'det',
  'penny-hardaway': 'orl',
  'shawn-kemp': 'sea',
  'mitch-richmond': 'sac',
  'joe-dumars': 'det',
  'sidney-moncrief': 'mil',
  'artis-gilmore': 'chi',
  'robert-parish': 'bos',
  'kevin-mchale': 'bos',
  'bill-walton': 'por',
  'tim-hardaway': 'gs',
  'mark-price': 'cle',
  'derrick-rose': 'chi',
  'chauncey-billups': 'det',
  'rajon-rondo': 'bos',
  'amar-e-stoudemire': 'phx',
  'chris-bosh': 'tor',
  'blake-griffin': 'lac',
  'lamarcus-aldridge': 'por',
  'marc-gasol': 'mem',
  'ben-wallace': 'det',
  'rasheed-wallace': 'det',
  'peja-stojakovic': 'sac',
  'chris-mullin': 'gs',
  'gilbert-arenas': 'was',
  'demar-derozan': 'tor',
  'john-wall': 'was',
}

function getTeamLogoUrl(code: string) {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${code}.png`
}

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000)
}

function getRosterCard(owned: DraftedPlayer) {
  const card = poolIndex.get(owned.playerId)
  if (!card) {
    throw new Error(`Missing player ${owned.playerId}`)
  }

  return {
    ...card,
    pricePaid: owned.pricePaid,
    assignedSlot: owned.assignedSlot,
  }
}

function formatPositions(positions: Position[]) {
  return positions.join(' / ')
}

function tierClassName(tier: Tier) {
  return `tier-${tier.toLowerCase()}`
}

function formatSlotLabel(slot: CourtSlotId) {
  return slot === SIXTH_SLOT ? '第六人' : slot
}

function getSlotRole(slot: CourtSlotId) {
  return slot === SIXTH_SLOT ? 'bench' : 'starter'
}

function getOfferStateText(offer: OfferCard) {
  if (offer.offerState === 'too-expensive') {
    return '预算不足'
  }

  if (offer.offerState === 'duplicate') {
    return '已拥有'
  }

  if (offer.offerState === 'slot-blocked') {
    return '无可用位置'
  }

  return '可签约'
}

function getRatingLabel(ovr: number) {
  if (ovr >= 97) {
    return '历史级核心'
  }

  if (ovr >= 94) {
    return '超巨即战力'
  }

  if (ovr >= 90) {
    return '明星主力'
  }

  if (ovr >= 86) {
    return '强力拼图'
  }

  return '轮换补强'
}

function getResultReason(reason: GameOverReason) {
  if (reason === 'lineup-complete') {
    return '六人阵容完成'
  }

  if (reason === 'budget-exhausted') {
    return '预算不足'
  }

  return '20 回合结束'
}

function getTeamCode(playerId: string) {
  return teamCodeByPlayerId[playerId]
}

function getTargetSlotForOffer(offer: OfferCard, arrangement: GameState['lineupArrangement']) {
  const starterSlot = offer.positions.find((position) => arrangement[position] === null)
  return starterSlot ?? SIXTH_SLOT
}

function PlayerCardTile({
  card,
  price,
  size,
  statusLabel,
  index = 0,
  className = '',
}: PlayerCardTileProps) {
  const teamCode = getTeamCode(card.id)

  return (
    <div
      className={[
        'player-card',
        `player-card-${size}`,
        tierClassName(card.tier),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--offer-index': index } as CSSProperties & Record<'--offer-index', number>}
    >
      <span className="player-card-price">{price}</span>
      {teamCode && (
        <img
          className="player-card-logo"
          src={getTeamLogoUrl(teamCode)}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div className="player-card-head">
        <h3>{card.name}</h3>
        {size === 'large' && <p className="player-card-subtitle">{getRatingLabel(card.sourceRating)}</p>}
      </div>
      <div className="player-card-stats">
        <div className="player-card-stat">
          <span>总评</span>
          <strong>{card.sourceRating}</strong>
        </div>
        <div className="player-card-stat">
          <span>{statusLabel}</span>
          <strong>{formatPositions(card.positions)}</strong>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [rngSeed, setRngSeed] = useState<number>(() => randomSeed())
  const [selectedSlot, setSelectedSlot] = useState<CourtSlotId | null>(null)
  const [draggingSlot, setDraggingSlot] = useState<CourtSlotId | null>(null)
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null)
  const draggingSlotRef = useRef<CourtSlotId | null>(null)
  const signTimerRef = useRef<number | null>(null)
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(pool, createSeededRng(randomSeed())),
  )

  const rosterCards = useMemo(
    () => gameState.roster.map((owned) => getRosterCard(owned)),
    [gameState.roster],
  )
  const rosterCardMap = useMemo(
    () => new Map(rosterCards.map((card) => [card.id, card])),
    [rosterCards],
  )
  const skipLabel =
    gameState.freeSkipsRemaining > 0
      ? `跳过本轮（免费 ${gameState.freeSkipsRemaining}）`
      : `跳过本轮（-${PAID_SKIP_COST} 预算）`
  const canSkip = gameState.freeSkipsRemaining > 0 || gameState.budgetRemaining >= PAID_SKIP_COST

  useEffect(
    () => () => {
      if (signTimerRef.current !== null) {
        window.clearTimeout(signTimerRef.current)
      }
    },
    [],
  )

  function beginDraggingSlot(slot: CourtSlotId) {
    draggingSlotRef.current = slot
    setDraggingSlot(slot)
  }

  function clearDraggingSlot() {
    draggingSlotRef.current = null
    setDraggingSlot(null)
  }

  function startRun() {
    const nextSeed = randomSeed()
    setRngSeed(nextSeed)
    setGameState(createInitialState(pool, createSeededRng(nextSeed)))
    setSelectedSlot(null)
    clearDraggingSlot()
    setScreen('draft')
  }

  function commitSign(offer: OfferCard) {
    if (offer.offerState !== 'enabled') {
      return
    }

    const nextState = signOffer(
      gameState,
      offer.id,
      pool,
      createSeededRng(rngSeed + gameState.round * 17),
    )
    setGameState(nextState)
    setSelectedSlot(null)
    clearDraggingSlot()
    setScreen(nextState.result ? 'result' : 'draft')
  }

  function handleSign(offer: OfferCard, event: ReactMouseEvent<HTMLButtonElement>) {
    if (offer.offerState !== 'enabled' || flyingCard) {
      return
    }

    const targetSlot = getTargetSlotForOffer(offer, gameState.lineupArrangement)
    const targetElement = document.querySelector<HTMLElement>(`[data-court-slot="${targetSlot}"]`)

    if (!targetElement) {
      commitSign(offer)
      return
    }

    setFlyingCard({
      card: offer,
      price: offer.price,
      statusLabel: getOfferStateText(offer),
      from: event.currentTarget.getBoundingClientRect(),
      to: targetElement.getBoundingClientRect(),
    })

    signTimerRef.current = window.setTimeout(() => {
      commitSign(offer)
      setFlyingCard(null)
      signTimerRef.current = null
    }, 430)
  }

  function handleSkip() {
    if (!canSkip || flyingCard) {
      return
    }

    const nextState = skipOfferGroup(
      gameState,
      pool,
      createSeededRng(rngSeed + gameState.round * 31 + 7),
    )
    setGameState(nextState)
    setScreen(nextState.result ? 'result' : 'draft')
  }

  function swapSlots(from: CourtSlotId, to: CourtSlotId) {
    if (from === to) {
      return
    }

    const arrangement = {
      ...gameState.lineupArrangement,
      [from]: gameState.lineupArrangement[to],
      [to]: gameState.lineupArrangement[from],
    }
    setGameState(setArrangement(gameState, arrangement, pool))
    setSelectedSlot(null)
    clearDraggingSlot()
  }

  useEffect(() => {
    function finishDragAt(clientX: number, clientY: number) {
      const sourceSlot = draggingSlotRef.current
      if (!sourceSlot) {
        return
      }

      const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null
      const slotElement = target?.closest<HTMLElement>('[data-court-slot]')
      const targetSlot = slotElement?.dataset.courtSlot as CourtSlotId | undefined

      if (targetSlot && targetSlot !== sourceSlot) {
        setGameState((current) => {
          const arrangement = {
            ...current.lineupArrangement,
            [sourceSlot]: current.lineupArrangement[targetSlot],
            [targetSlot]: current.lineupArrangement[sourceSlot],
          }
          return setArrangement(current, arrangement, pool)
        })
        setSelectedSlot(null)
      }

      draggingSlotRef.current = null
      setDraggingSlot(null)
    }

    function clearDrag() {
      draggingSlotRef.current = null
      setDraggingSlot(null)
    }

    function handleWindowPointerUp(event: PointerEvent) {
      finishDragAt(event.clientX, event.clientY)
    }

    function handleWindowMouseUp(event: MouseEvent) {
      finishDragAt(event.clientX, event.clientY)
    }

    function handleWindowTouchEnd(event: TouchEvent) {
      const touch = event.changedTouches[0]
      if (touch) {
        finishDragAt(touch.clientX, touch.clientY)
      } else {
        clearDrag()
      }
    }

    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', clearDrag)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('touchend', handleWindowTouchEnd)
    window.addEventListener('touchcancel', clearDrag)

    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', clearDrag)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      window.removeEventListener('touchend', handleWindowTouchEnd)
      window.removeEventListener('touchcancel', clearDrag)
    }
  }, [])

  function handleSlotClick(slot: CourtSlotId) {
    if (!gameState.lineupArrangement[slot]) {
      if (selectedSlot) {
        swapSlots(selectedSlot, slot)
      }
      return
    }

    if (selectedSlot === slot) {
      setSelectedSlot(null)
      return
    }

    if (selectedSlot) {
      swapSlots(selectedSlot, slot)
      return
    }

    setSelectedSlot(slot)
  }

  return (
    <main className={`app-shell ${screen}`}>
      <section className="backdrop">
        <div className="backdrop-grid" />
        <div className="backdrop-arc backdrop-arc-left" />
        <div className="backdrop-arc backdrop-arc-right" />
      </section>

      {screen === 'landing' && (
        <section className="screen landing-screen">
          <div className="landing-copy">
            <p className="eyebrow">王朝选秀</p>
            <h1>100 预算，20 回合，抽一套历史王朝。</h1>
            <p className="landing-body">
              每轮四张历史球星卡，价格每次重掷。签下一人或跳过，填满五个首发和第六人即结算。
            </p>
            <div className="landing-actions">
              <button type="button" className="primary-button" onClick={startRun}>
                开始选秀
              </button>
              <p className="micro-copy">
                {FREE_SKIP_COUNT} 次免费跳过，用完后每次消耗 {PAID_SKIP_COST} 预算。
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
              <p>OVR 越高越稀有，价格每次出现都会重掷。</p>
              <p>第六人不限位置，重复球员禁止签约。</p>
            </div>
          </div>
        </section>
      )}

      {screen === 'draft' && (
        <section className="screen draft-screen">
          <header className="draft-header">
            <div className="status-row">
              <article className="status-chip">
                <span>预算</span>
                <strong>{gameState.budgetRemaining}</strong>
              </article>
              <article className="status-chip">
                <span>回合</span>
                <strong>
                  {gameState.round}/{MAX_ROUNDS}
                </strong>
              </article>
              <article className="status-chip">
                <span>阵容</span>
                <strong>
                  {gameState.roster.length}/{ROSTER_TARGET}
                </strong>
              </article>
              <article className="status-chip">
                <span>免费跳过</span>
                <strong>{gameState.freeSkipsRemaining}</strong>
              </article>
            </div>
          </header>

          <section className="offer-stage" key={gameState.round}>
            {gameState.currentOffers.map((offer, index) => {
              return (
                <button
                  key={offer.id}
                  type="button"
                  className={`offer-card-button ${offer.offerState !== 'enabled' ? 'is-disabled' : ''}`}
                  onClick={(event) => handleSign(offer, event)}
                  disabled={offer.offerState !== 'enabled' || Boolean(flyingCard)}
                >
                  <PlayerCardTile
                    card={offer}
                    price={offer.price}
                    size="large"
                    statusLabel={getOfferStateText(offer)}
                    index={index}
                  />
                </button>
              )
            })}
          </section>

          <section className="action-bar">
            <button type="button" className="ghost-button" onClick={handleSkip} disabled={!canSkip}>
              {skipLabel}
            </button>
            <button type="button" className="ghost-button" onClick={startRun}>
              重新开始
            </button>
          </section>

          <p className="pool-note">{gameState.lastAction}</p>

          <section className="court-editor">
            <div
              className="court-surface"
              onPointerCancel={clearDraggingSlot}
            >
              {COURT_SLOTS.map((slot) => {
                const playerId = gameState.lineupArrangement[slot]
                const card = playerId ? rosterCardMap.get(playerId) : null
                const isStarterSlot = slot !== SIXTH_SLOT
                const isInvalid = Boolean(
                  card && isStarterSlot && !card.positions.includes(slot as Position),
                )
                const isSelected = selectedSlot === slot
                const isDragging = draggingSlot === slot

                return (
                  <button
                    key={slot}
                    type="button"
                    data-court-slot={slot}
                    className={[
                      'court-slot',
                      `slot-${slot.toLowerCase()}`,
                      card ? 'is-filled' : 'is-empty',
                      isInvalid ? 'is-invalid' : '',
                      isSelected ? 'is-selected' : '',
                      isDragging ? 'is-dragging' : '',
                      getSlotRole(slot),
                    ]
                      .filter(Boolean)
                    .join(' ')}
                    onClick={() => handleSlotClick(slot)}
                    onPointerDown={() => {
                      if (card) {
                        beginDraggingSlot(slot)
                      }
                    }}
                    onMouseDown={() => {
                      if (card) {
                        beginDraggingSlot(slot)
                      }
                    }}
                    onTouchStart={() => {
                      if (card) {
                        beginDraggingSlot(slot)
                      }
                    }}
                  >
                    <span className="court-slot-label">{formatSlotLabel(slot)}</span>
                    {card ? (
                      <span
                        className="court-player-chip"
                      >
                        <PlayerCardTile
                          card={card}
                          price={card.pricePaid}
                          size="mini"
                          statusLabel="可签约"
                        />
                      </span>
                    ) : (
                      <span className="court-slot-empty-dot" />
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        </section>
      )}

      {flyingCard && (
        <div
          className="flying-card"
          style={
            {
              '--fly-from-x': `${flyingCard.from.left}px`,
              '--fly-from-y': `${flyingCard.from.top}px`,
              '--fly-to-x': `${flyingCard.to.left + 8}px`,
              '--fly-to-y': `${flyingCard.to.top + 30}px`,
              '--fly-from-w': `${flyingCard.from.width}px`,
              '--fly-from-h': `${flyingCard.from.height}px`,
              '--fly-to-w': `${Math.max(80, flyingCard.to.width - 16)}px`,
              '--fly-to-h': `${Math.max(72, flyingCard.to.height - 38)}px`,
            } as CSSProperties &
              Record<
                | '--fly-from-x'
                | '--fly-from-y'
                | '--fly-to-x'
                | '--fly-to-y'
                | '--fly-from-w'
                | '--fly-from-h'
                | '--fly-to-w'
                | '--fly-to-h',
                string
              >
          }
        >
          <PlayerCardTile
            card={flyingCard.card}
            price={flyingCard.price}
            size="large"
            statusLabel={flyingCard.statusLabel}
          />
        </div>
      )}

      {screen === 'result' && gameState.result && (
        <section className="screen result-screen">
          <div className="result-hero">
            <p className="eyebrow">{getResultReason(gameState.result.gameOverReason)}</p>
            <h2>王朝评分</h2>
            <p>预算、平衡和巨星浓度共同决定这支队的历史分量。</p>
          </div>

          <section className="result-metrics">
            <article>
              <span>王朝评分</span>
              <strong>{gameState.result.dynastyScore}</strong>
            </article>
            <article>
              <span>预计战绩</span>
              <strong>
                {gameState.result.projectedWins}-{gameState.result.projectedLosses}
              </strong>
            </article>
            <article>
              <span>夺冠概率</span>
              <strong>{gameState.result.championshipOdds}%</strong>
            </article>
          </section>

          <section className="lineup-board">
            {gameState.result.starters.map((starter) => {
              const card = poolIndex.get(starter.playerId)
              if (!card) {
                return null
              }

              return (
                <article
                  key={`${starter.slot}-${starter.playerId}`}
                  className={`lineup-row ${tierClassName(card.tier)}`}
                >
                  <span>{starter.slot}</span>
                  <div>
                    <strong>{card.name}</strong>
                    <p>{formatPositions(card.positions)}</p>
                  </div>
                  <div className="lineup-value">
                    <span>{starter.pricePaid} 预算</span>
                    <strong>{starter.ovr}</strong>
                  </div>
                </article>
              )
            })}

            {gameState.result.sixthMan && (
              <article className="lineup-row lineup-bench">
                <span>第六人</span>
                <div>
                  <strong>{poolIndex.get(gameState.result.sixthMan.playerId)?.name}</strong>
                  <p>第六人</p>
                </div>
                <div className="lineup-value">
                  <span>{gameState.result.sixthMan.pricePaid} 预算</span>
                  <strong>{gameState.result.sixthMan.ovr}</strong>
                </div>
              </article>
            )}
          </section>

          <section className="result-summary">
            <p>
              实力 <strong>{gameState.result.strengthScore}</strong> · 平衡{' '}
              <strong>{gameState.result.balanceScore}</strong> · 巨星{' '}
              <strong>{gameState.result.superstarScore}</strong> · 花费{' '}
              <strong>{gameState.result.budgetSpent}</strong>
            </p>
            <button type="button" className="primary-button" onClick={startRun}>
              再来一局
            </button>
          </section>
        </section>
      )}
    </main>
  )
}

export default App
