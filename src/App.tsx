import { useMemo, useState } from 'react'
import legendPool from './data/legend-pool.json'
import './App.css'
import {
  canConfirmArrangement,
  confirmLineup,
  createInitialState,
  createSeededRng,
  getCardPower,
  skipOfferGroup,
  signOffer,
  setArrangement,
} from './game/engine'
import {
  COURT_SLOTS,
  OFFER_COUNT,
  ROSTER_TARGET,
  SKIP_TOKENS,
  SIXTH_SLOT,
  type CourtSlotId,
  type GameState,
  type OfferCard,
  type OwnedCard,
  type PlayerCard,
  type Position,
  type Tier,
} from './game/types'

const pool = legendPool as PlayerCard[]
const poolIndex = new Map(pool.map((card) => [card.id, card]))

type Screen = 'landing' | 'draft' | 'result'

interface TeamMeta {
  code: string
  name: string
}

const teamByPlayerId: Record<string, TeamMeta> = {
  'michael-jordan': { code: 'chi', name: 'Chicago Bulls' },
  'lebron-james': { code: 'cle', name: 'Cleveland Cavaliers' },
  'kareem-abdul-jabbar': { code: 'lal', name: 'Los Angeles Lakers' },
  'magic-johnson': { code: 'lal', name: 'Los Angeles Lakers' },
  'kobe-bryant': { code: 'lal', name: 'Los Angeles Lakers' },
  'shaquille-oneal': { code: 'lal', name: 'Los Angeles Lakers' },
  'tim-duncan': { code: 'sas', name: 'San Antonio Spurs' },
  'larry-bird': { code: 'bos', name: 'Boston Celtics' },
  'hakeem-olajuwon': { code: 'hou', name: 'Houston Rockets' },
  'wilt-chamberlain': { code: 'lal', name: 'Los Angeles Lakers' },
  'stephen-curry': { code: 'gs', name: 'Golden State Warriors' },
  'bill-russell': { code: 'bos', name: 'Boston Celtics' },
  'kevin-durant': { code: 'bkn', name: 'Brooklyn Nets' },
  'oscar-robertson': { code: 'mil', name: 'Milwaukee Bucks' },
  'jerry-west': { code: 'lal', name: 'Los Angeles Lakers' },
  'julius-erving': { code: 'phi', name: 'Philadelphia 76ers' },
  'dirk-nowitzki': { code: 'dal', name: 'Dallas Mavericks' },
  'kevin-garnett': { code: 'min', name: 'Minnesota Timberwolves' },
  'moses-malone': { code: 'phi', name: 'Philadelphia 76ers' },
  'nikola-jokic': { code: 'den', name: 'Denver Nuggets' },
  'giannis-antetokounmpo': { code: 'mil', name: 'Milwaukee Bucks' },
  'dwyane-wade': { code: 'mia', name: 'Miami Heat' },
  'isiah-thomas': { code: 'det', name: 'Detroit Pistons' },
  'charles-barkley': { code: 'phx', name: 'Phoenix Suns' },
  'allen-iverson': { code: 'phi', name: 'Philadelphia 76ers' },
  'scottie-pippen': { code: 'chi', name: 'Chicago Bulls' },
  'david-robinson': { code: 'sas', name: 'San Antonio Spurs' },
  'john-stockton': { code: 'uta', name: 'Utah Jazz' },
  'karl-malone': { code: 'uta', name: 'Utah Jazz' },
  'elgin-baylor': { code: 'lal', name: 'Los Angeles Lakers' },
  'chris-paul': { code: 'lac', name: 'Los Angeles Clippers' },
  'kawhi-leonard': { code: 'tor', name: 'Toronto Raptors' },
  'steve-nash': { code: 'phx', name: 'Phoenix Suns' },
  'james-harden': { code: 'hou', name: 'Houston Rockets' },
  'tracy-mcgrady': { code: 'orl', name: 'Orlando Magic' },
  'patrick-ewing': { code: 'ny', name: 'New York Knicks' },
  'clyde-drexler': { code: 'hou', name: 'Houston Rockets' },
  'ray-allen': { code: 'sea', name: 'Seattle SuperSonics' },
  'reggie-miller': { code: 'ind', name: 'Indiana Pacers' },
  'manu-ginobili': { code: 'sas', name: 'San Antonio Spurs' },
  'pau-gasol': { code: 'lal', name: 'Los Angeles Lakers' },
  'dwight-howard': { code: 'orl', name: 'Orlando Magic' },
  'yao-ming': { code: 'hou', name: 'Houston Rockets' },
  'vince-carter': { code: 'tor', name: 'Toronto Raptors' },
  'damian-lillard': { code: 'por', name: 'Portland Trail Blazers' },
  'dominique-wilkins': { code: 'atl', name: 'Atlanta Hawks' },
  'paul-pierce': { code: 'bos', name: 'Boston Celtics' },
  'dennis-rodman': { code: 'chi', name: 'Chicago Bulls' },
}

function getTeamLogoUrl(code: string) {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${code}.png`
}

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000)
}

function getRosterCard(owned: OwnedCard) {
  const card = poolIndex.get(owned.playerId)
  if (!card) {
    throw new Error(`Missing player ${owned.playerId}`)
  }

  return card
}

function formatPositions(positions: Position[]) {
  return positions.join(' / ')
}

function tierClassName(tier: Tier) {
  return `tier-${tier.toLowerCase()}`
}

function formatSlotLabel(slot: CourtSlotId) {
  return slot === SIXTH_SLOT ? '6' : slot
}

function getSlotRole(slot: CourtSlotId) {
  return slot === SIXTH_SLOT ? 'bench' : 'starter'
}

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [rngSeed, setRngSeed] = useState<number>(() => randomSeed())
  const [selectedSlot, setSelectedSlot] = useState<CourtSlotId | null>(null)
  const [draggingSlot, setDraggingSlot] = useState<CourtSlotId | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(pool, createSeededRng(randomSeed())),
  )

  const rosterCards = useMemo(
    () =>
      gameState.roster.map((owned) => {
        const card = getRosterCard(owned)
        return {
          ...card,
          stars: owned.stars,
          totalCost: owned.totalCost,
          power: getCardPower(card, owned.stars),
        }
      }),
    [gameState.roster],
  )
  const rosterCardMap = useMemo(
    () => new Map(rosterCards.map((card) => [card.id, card])),
    [rosterCards],
  )
  const needsLineupConfirm = gameState.roster.length >= ROSTER_TARGET && !gameState.result
  const arrangementReady = canConfirmArrangement(gameState.roster, gameState.lineupArrangement, pool)

  function startRun() {
    const nextSeed = randomSeed()
    setRngSeed(nextSeed)
    setGameState(createInitialState(pool, createSeededRng(nextSeed)))
    setSelectedSlot(null)
    setDraggingSlot(null)
    setConfirmOpen(false)
    setScreen('draft')
  }

  function handleSign(offer: OfferCard) {
    if (offer.offerState !== 'enabled') {
      return
    }

    const nextState = signOffer(
      gameState,
      offer.id,
      pool,
      createSeededRng(rngSeed + gameState.offerCount * 17),
    )
    setGameState(nextState)
    setSelectedSlot(null)
    setDraggingSlot(null)
    setConfirmOpen(false)
    setScreen(nextState.result ? 'result' : 'draft')
  }

  function handleSkip() {
    if (gameState.skipsRemaining <= 0) {
      return
    }

    const nextState = skipOfferGroup(
      gameState,
      pool,
      createSeededRng(rngSeed + gameState.offerCount * 31 + 7),
    )
    setGameState(nextState)
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
    setDraggingSlot(null)
  }

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

  function handleDrop(from: CourtSlotId, to: CourtSlotId) {
    swapSlots(from, to)
  }

  function openConfirm() {
    if (!needsLineupConfirm || !arrangementReady) {
      return
    }

    setConfirmOpen(true)
  }

  function handleConfirmLineup() {
    const nextState = confirmLineup(gameState, pool)
    setGameState(nextState)
    setConfirmOpen(false)
    setSelectedSlot(null)
    setDraggingSlot(null)
    setScreen('result')
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
            <p className="eyebrow">DYNASTY DRAFT</p>
            <h1>只盯这 4 张牌，抽出你心里的 NBA 历史王朝。</h1>
            <p className="landing-body">
              每轮只看 4 张候选卡。你可以直接签，也可以有限次跳过等下一组报价。真正的爽点，不是填表，而是每次看见神卡时那一下心跳。
            </p>
            <div className="landing-actions">
              <button type="button" className="primary-button" onClick={startRun}>
                开始抽王朝
              </button>
              <p className="micro-copy">手机优先。无限重开。先收 6 人池，再拖拽确认首发与第六人。</p>
            </div>
          </div>

          <div className="landing-poster">
            <div className="poster-strip">
              <span>{OFFER_COUNT} CARDS</span>
              <span>{SKIP_TOKENS} SKIPS</span>
              <span>100 BUDGET</span>
            </div>
            <div className="poster-metric">
              <strong>6</strong>
              <span>人池成型即结算</span>
            </div>
            <div className="poster-detail">
              <p>强卡更贵，重复能升星。</p>
              <p>6 人成型后，手动摆上你的球场。</p>
            </div>
          </div>
        </section>
      )}

      {screen === 'draft' && (
        <section className="screen draft-screen">
          <header className="draft-header">
            <div className="status-row">
              <article className="status-chip">
                <span>点数</span>
                <strong>{gameState.budgetRemaining}</strong>
              </article>
              <article className="status-chip">
                <span>已签</span>
                <strong>
                  {gameState.roster.length}/{ROSTER_TARGET}
                </strong>
              </article>
              <article className="status-chip">
                <span>跳过</span>
                <strong>{gameState.skipsRemaining}</strong>
              </article>
            </div>
          </header>

          <section className="offer-stage">
            {gameState.currentOffers.length > 0 ? (
              gameState.currentOffers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  className={`offer-card ${tierClassName(offer.tier)} ${offer.offerState !== 'enabled' ? 'is-disabled' : ''}`}
                  onClick={() => handleSign(offer)}
                  disabled={offer.offerState !== 'enabled'}
                >
                  <div className="offer-corners">
                    <span className="offer-tier-mark">{offer.tier}</span>
                    <span className="offer-cost-mark">{offer.price}</span>
                  </div>
                  <div className="offer-head">
                    <h3>{offer.name}</h3>
                    <div className="offer-teamline">
                      <img
                        className="offer-team-logo"
                        src={getTeamLogoUrl(teamByPlayerId[offer.id]?.code ?? 'nba')}
                        alt=""
                      />
                      <p>{teamByPlayerId[offer.id]?.name ?? 'NBA Legend'}</p>
                    </div>
                  </div>
                  <div className="offer-stats">
                    <div className="offer-stat">
                      <span>总评</span>
                      <strong>{offer.sourceRating}</strong>
                    </div>
                    <div className="offer-stat">
                      <span>位置</span>
                      <strong>{formatPositions(offer.positions)}</strong>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="offer-stage-placeholder">
                <span>LINEUP READY</span>
              </div>
            )}
          </section>

          <section className="action-bar">
            {!needsLineupConfirm && (
              <button
                type="button"
                className="ghost-button"
                onClick={handleSkip}
                disabled={gameState.skipsRemaining <= 0}
              >
                {gameState.skipsRemaining > 0 ? `跳过本轮 (${gameState.skipsRemaining})` : '跳过已用尽'}
              </button>
            )}
            {needsLineupConfirm && (
              <button
                type="button"
                className="primary-button"
                onClick={openConfirm}
                disabled={!arrangementReady}
              >
                确认阵容
              </button>
            )}
            <button type="button" className="ghost-button" onClick={startRun}>
              这局不满意，重开
            </button>
          </section>

          <section className="court-editor">
            <div className="court-surface">
              <div className="court-half" />
              <div className="court-paint" />
              <div className="court-rim" />
              <div className="court-backboard" />
              <div className="court-arc" />
              <div className="court-free-throw" />

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
                    onDragOver={(event) => {
                      if (draggingSlot) {
                        event.preventDefault()
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const from = event.dataTransfer.getData('text/plain') as CourtSlotId
                      if (from) {
                        handleDrop(from, slot)
                      }
                    }}
                  >
                    <span className="court-slot-label">{formatSlotLabel(slot)}</span>
                    {card ? (
                      <span
                        className={`court-player-chip ${tierClassName(card.tier)}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', slot)
                          event.dataTransfer.effectAllowed = 'move'
                          setDraggingSlot(slot)
                        }}
                        onDragEnd={() => setDraggingSlot(null)}
                      >
                        <img
                          className="court-player-logo"
                          src={getTeamLogoUrl(teamByPlayerId[card.id]?.code ?? 'nba')}
                          alt=""
                        />
                        <span className="court-player-copy">
                          <strong>{card.name}</strong>
                          <em>
                            {card.power} · {'★'.repeat(card.stars)}
                          </em>
                        </span>
                      </span>
                    ) : (
                      <span className="court-slot-empty-dot" />
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {confirmOpen && (
            <div className="confirm-overlay" role="presentation" onClick={() => setConfirmOpen(false)}>
              <div
                className="confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-lineup-title"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="eyebrow">LOCK IN</p>
                <h3 id="confirm-lineup-title">确认这套首发与第六人？</h3>
                <div className="confirm-actions">
                  <button type="button" className="ghost-button" onClick={() => setConfirmOpen(false)}>
                    再调一下
                  </button>
                  <button type="button" className="primary-button" onClick={handleConfirmLineup}>
                    进入总评
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {screen === 'result' && gameState.result && (
        <section className="screen result-screen">
          <div className="result-hero">
            <p className="eyebrow">FINAL SHEET</p>
            <h2>{gameState.result.title.label}</h2>
            <p>{gameState.result.title.subtitle}</p>
          </div>

          <section className="result-metrics">
            <article>
              <span>阵容总评</span>
              <strong>{gameState.result.teamRating}</strong>
            </article>
            <article>
              <span>总火力</span>
              <strong>{gameState.result.totalPower}</strong>
            </article>
            <article>
              <span>预算效率</span>
              <strong>{gameState.result.efficiencyScore}</strong>
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
                    <span>{'★'.repeat(starter.stars)}</span>
                    <strong>{starter.power}</strong>
                  </div>
                </article>
              )
            })}

            <article className="lineup-row lineup-bench">
              <span>6TH</span>
              <div>
                <strong>{poolIndex.get(gameState.result.sixthMan.playerId)?.name}</strong>
                <p>第六人火力储备</p>
              </div>
              <div className="lineup-value">
                <span>{'★'.repeat(gameState.result.sixthMan.stars)}</span>
                <strong>{gameState.result.sixthMan.power}</strong>
              </div>
            </article>
          </section>

          <section className="result-summary">
            <p>
              花了 <strong>{gameState.result.budgetSpent}</strong> 王朝点，还剩{' '}
              <strong>{gameState.result.budgetRemaining}</strong>。全队累计{' '}
              <strong>{gameState.result.totalStars}</strong> 星。
            </p>
            <button type="button" className="primary-button" onClick={startRun}>
              再抽一套历史阵容
            </button>
          </section>
        </section>
      )}
    </main>
  )
}

export default App
