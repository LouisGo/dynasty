import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
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
  ROSTER_TARGET,
  SIXTH_SLOT,
  type CourtSlotId,
  type DraftedPlayer,
  type GameOverReason,
  type GameState,
  type OfferCard,
  type PlayerCard,
  type Position,
  type ResultSummary,
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
  onLongPressOpen?: (detail: PlayerDetailOverlayState) => void
}

interface DragPreviewState {
  slot: CourtSlotId
  card: PlayerCard
  price: number
  x: number
  y: number
  width: number
  height: number
  offsetX: number
  offsetY: number
}

interface PlayerDetailOverlayState {
  card: PlayerCard
  price: number
  statusLabel: string
  size: CardSize
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
  'john-stockton': 'utah',
  'karl-malone': 'utah',
  'chris-paul': 'lac',
  'kawhi-leonard': 'tor',
  'steve-nash': 'phx',
  'james-harden': 'hou',
  'tracy-mcgrady': 'orl',
  'patrick-ewing': 'ny',
  'clyde-drexler': 'por',
  'ray-allen': 'okc',
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
  'gary-payton': 'okc',
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
  'shawn-kemp': 'okc',
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
  'shai-gilgeous-alexander': 'okc',
  'victor-wembanyama': 'sas',
  'anthony-edwards': 'min',
  'jalen-brunson': 'ny',
  'cade-cunningham': 'det',
  'jaylen-brown': 'bos',
  'jayson-tatum': 'bos',
  'donovan-mitchell': 'cle',
  'tyrese-haliburton': 'ind',
  'devin-booker': 'phx',
  'tyrese-maxey': 'phi',
  'karl-anthony-towns': 'ny',
  'trae-young': 'atl',
  'bam-adebayo': 'mia',
  'jamal-murray': 'den',
  'scottie-barnes': 'tor',
  'jalen-johnson': 'atl',
  'paolo-banchero': 'orl',
  'alperen-sengun': 'hou',
  'lamelo-ball': 'cha',
  'og-anunoby': 'ny',
  'stephon-castle': 'sas',
  'deni-avdija': 'por',
  'cooper-flagg': 'dal',
  'ja-morant': 'mem',
  'jalen-williams': 'okc',
  'evan-mobley': 'cle',
  'pascal-siakam': 'ind',
  'chet-holmgren': 'okc',
  'amen-thompson': 'hou',
  'tyler-herro': 'mia',
  'franz-wagner': 'orl',
  'austin-reaves': 'lal',
  'lauri-markkanen': 'utah',
  'brandon-miller': 'cha',
  'domantas-sabonis': 'sac',
  'deaaron-fox': 'sas',
  'darius-garland': 'cle',
  'jalen-duren': 'det',
  'rudy-gobert': 'min',
  'zion-williamson': 'no',
  'derrick-white': 'bos',
  'jrue-holiday': 'por',
  'julius-randle': 'min',
  'desmond-bane': 'orl',
  'zach-lavine': 'sac',
  'mikal-bridges': 'ny',
  'jarrett-allen': 'cle',
  'kristaps-porzingis': 'atl',
  'dejounte-murray': 'no',
  'bradley-beal': 'lac',
  'khris-middleton': 'was',
  'cj-mccollum': 'was',
  'aaron-gordon': 'den',
  'myles-turner': 'mil',
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

function formatRatingValue(value: number | null | undefined) {
  return typeof value === 'number' ? Math.round(value) : null
}

function getRatingPercent(value: number | null | undefined) {
  return `${Math.max(0, Math.min(100, formatRatingValue(value) ?? 0))}%`
}

function getCoreRatingRows(card: PlayerCard) {
  const ratings = card.ratings

  return [
    { label: '进攻', value: ratings?.offense },
    { label: '防守', value: ratings?.defense },
    { label: '体能', value: ratings?.physical },
    { label: '心态', value: ratings?.mentality },
  ]
}

function getAttributeGroupRows(card: PlayerCard) {
  const groups = card.sourceAttributes?.groups

  return [
    { label: '外线终结', value: groups?.outsideScoring },
    { label: '内线终结', value: groups?.insideScoring },
    { label: '组织控场', value: groups?.playmaking },
    { label: '单防协防', value: groups?.defense },
    { label: '篮板保护', value: groups?.rebounding },
    { label: '运动能力', value: groups?.athleticism },
    { label: '无形价值', value: groups?.intangibles },
  ]
}

function getAttributeRows(card: PlayerCard) {
  const attributes = card.sourceAttributes?.attributes

  return [
    { label: '投篮选择', value: attributes?.shotIQ },
    { label: '进攻稳定', value: attributes?.offensiveConsistency },
    { label: '传球判断', value: attributes?.passIQ },
    { label: '协防判断', value: attributes?.helpDefenseIQ },
    { label: '防守稳定', value: attributes?.defensiveConsistency },
    { label: '耐力', value: attributes?.stamina },
    { label: '耐用度', value: attributes?.durability },
    { label: '力量', value: attributes?.strength },
    { label: '敏捷', value: attributes?.agility },
  ]
}

function getMetricTone(value: number, excellent: number, good: number) {
  if (value >= excellent) {
    return 'metric-excellent'
  }

  if (value >= good) {
    return 'metric-good'
  }

  return 'metric-normal'
}

function getResultLineup(result: ResultSummary) {
  return COURT_SLOTS.map((slot) => {
    if (slot === SIXTH_SLOT) {
      const card = result.sixthMan ? poolIndex.get(result.sixthMan.playerId) : null
      return {
        slot,
        card,
        pricePaid: result.sixthMan?.pricePaid ?? 0,
      }
    }

    const starter = result.starters.find((item) => item.slot === slot)
    const card = starter ? poolIndex.get(starter.playerId) : null
    return {
      slot,
      card,
      pricePaid: starter?.pricePaid ?? 0,
    }
  })
}

function RestartIcon() {
  return (
    <svg className="restart-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6.3 7.6A7.7 7.7 0 1 1 4.7 12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M6.4 3.8v3.8h3.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
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
  onLongPressOpen,
}: PlayerCardTileProps) {
  const teamCode = getTeamCode(card.id)
  const pressTimerRef = useRef<number | null>(null)
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTriggeredRef = useRef(false)
  const [isPressing, setIsPressing] = useState(false)

  useEffect(
    () => () => {
      if (pressTimerRef.current !== null) {
        window.clearTimeout(pressTimerRef.current)
      }
    },
    [],
  )

  function clearPressState() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartRef.current = null
    setIsPressing(false)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!onLongPressOpen || (event.pointerType === 'mouse' && event.button !== 0)) {
      return
    }

    pressStartRef.current = { x: event.clientX, y: event.clientY }
    setIsPressing(true)
    pressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      pressTimerRef.current = null
      pressStartRef.current = null
      setIsPressing(false)
      onLongPressOpen({ card, price, statusLabel, size })
    }, 520)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pressStartRef.current
    if (!start) {
      return
    }

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (distance > 10) {
      clearPressState()
    }
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!longPressTriggeredRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    longPressTriggeredRef.current = false
  }

  return (
    <div
      className={[
        'player-card',
        `player-card-${size}`,
        tierClassName(card.tier),
        isPressing ? 'is-long-pressing' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--offer-index': index } as CSSProperties & Record<'--offer-index', number>}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPressState}
      onPointerCancel={clearPressState}
      onPointerLeave={clearPressState}
      onClickCapture={handleClickCapture}
      onContextMenu={(event) => event.preventDefault()}
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

function PlayerDetailOverlay({
  detail,
  onClose,
}: {
  detail: PlayerDetailOverlayState
  onClose: () => void
}) {
  const coreRows = getCoreRatingRows(detail.card)
  const groupRows = getAttributeGroupRows(detail.card)
  const attributeRows = getAttributeRows(detail.card)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <section
      className="player-detail-overlay"
      aria-label={`${detail.card.name} 评分细分`}
      onPointerDown={onClose}
    >
      <div className="player-detail-panel">
        <header className="player-detail-head">
          <span>{detail.card.tier} · {formatPositions(detail.card.positions)}</span>
          <h2>{detail.card.name}</h2>
          <p>
            OVR {detail.card.sourceRating} · 价格 {detail.price} · {detail.statusLabel}
          </p>
        </header>

        <section className="player-detail-core" aria-label="核心评分">
          {coreRows.map((row) => {
            const value = formatRatingValue(row.value)
            return (
              <article
                key={row.label}
                style={{ '--score': getRatingPercent(row.value) } as CSSProperties & Record<'--score', string>}
              >
                <span>{row.label}</span>
                <strong>{value ?? '--'}</strong>
                <i aria-hidden="true" />
              </article>
            )
          })}
        </section>

        <section className="player-detail-section" aria-label="子项分数">
          <h3>子项分数</h3>
          <div className="player-detail-rows">
            {groupRows.map((row) => {
              const value = formatRatingValue(row.value)
              return (
                <div
                  key={row.label}
                  className="player-detail-row"
                  style={{ '--score': getRatingPercent(row.value) } as CSSProperties & Record<'--score', string>}
                >
                  <span>{row.label}</span>
                  <i aria-hidden="true" />
                  <strong>{value ?? '--'}</strong>
                </div>
              )
            })}
          </div>
        </section>

        <section className="player-detail-section" aria-label="关键属性">
          <h3>关键属性</h3>
          <div className="player-detail-rows compact">
            {attributeRows.map((row) => {
              const value = formatRatingValue(row.value)
              return (
                <div
                  key={row.label}
                  className="player-detail-row"
                  style={{ '--score': getRatingPercent(row.value) } as CSSProperties & Record<'--score', string>}
                >
                  <span>{row.label}</span>
                  <i aria-hidden="true" />
                  <strong>{value ?? '--'}</strong>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </section>
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [rngSeed, setRngSeed] = useState<number>(() => randomSeed())
  const [selectedSlot, setSelectedSlot] = useState<CourtSlotId | null>(null)
  const [draggingSlot, setDraggingSlot] = useState<CourtSlotId | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null)
  const [revealingSlot, setRevealingSlot] = useState<CourtSlotId | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [isResultPending, setIsResultPending] = useState(false)
  const [playerDetail, setPlayerDetail] = useState<PlayerDetailOverlayState | null>(null)
  const draggingSlotRef = useRef<CourtSlotId | null>(null)
  const dragPreviewRef = useRef<DragPreviewState | null>(null)
  const suppressNextSlotClickRef = useRef(false)
  const signAnimationTimerRef = useRef<number | null>(null)
  const revealTimerRef = useRef<number | null>(null)
  const resultTimerRef = useRef<number | null>(null)
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
      : '跳过次数已用完'
  const canSkip = gameState.freeSkipsRemaining > 0

  useEffect(
    () => () => {
      if (signAnimationTimerRef.current !== null) {
        window.clearTimeout(signAnimationTimerRef.current)
      }
      if (resultTimerRef.current !== null) {
        window.clearTimeout(resultTimerRef.current)
      }
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  function scrollToPageTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })
  }

  function beginDraggingSlot(
    slot: CourtSlotId,
    event: ReactPointerEvent<HTMLButtonElement>,
    card: PlayerCard & { pricePaid: number },
  ) {
    const chip = event.currentTarget.querySelector<HTMLElement>('.court-player-chip')
    const rect = chip?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
    const preview = {
      slot,
      card,
      price: card.pricePaid,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }

    draggingSlotRef.current = slot
    dragPreviewRef.current = preview
    suppressNextSlotClickRef.current = false
    setDraggingSlot(slot)
    setDragPreview(preview)
  }

  function clearDraggingSlot() {
    draggingSlotRef.current = null
    dragPreviewRef.current = null
    setDraggingSlot(null)
    setDragPreview(null)
  }

  function openPlayerDetail(detail: PlayerDetailOverlayState) {
    clearDraggingSlot()
    setPlayerDetail(detail)
  }

  function startRun() {
    const nextSeed = randomSeed()
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current)
      resultTimerRef.current = null
    }
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
    setRngSeed(nextSeed)
    setGameState(createInitialState(pool, createSeededRng(nextSeed)))
    setSelectedSlot(null)
    setIsResultPending(false)
    setSelectedOfferId(null)
    setRevealingSlot(null)
    clearDraggingSlot()
    setScreen('draft')
    scrollToPageTop()
  }

  function scheduleResultScreen() {
    setIsResultPending(true)
    setScreen('draft')
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current)
    }

    resultTimerRef.current = window.setTimeout(() => {
      setIsResultPending(false)
      setScreen('result')
      scrollToPageTop()
      resultTimerRef.current = null
    }, 2500)
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
    if (nextState.result) {
      scheduleResultScreen()
    } else {
      setScreen('draft')
    }
  }

  function handleSign(offer: OfferCard) {
    if (offer.offerState !== 'enabled' || selectedOfferId || isResultPending) {
      return
    }

    const targetSlot = getTargetSlotForOffer(offer, gameState.lineupArrangement)
    setSelectedOfferId(offer.id)
    if (signAnimationTimerRef.current !== null) {
      window.clearTimeout(signAnimationTimerRef.current)
    }
    signAnimationTimerRef.current = window.setTimeout(() => {
      commitSign(offer)
      setRevealingSlot(targetSlot)
      setSelectedOfferId(null)
      signAnimationTimerRef.current = null
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current)
      }
      revealTimerRef.current = window.setTimeout(() => {
        setRevealingSlot(null)
        revealTimerRef.current = null
      }, 520)
    }, 300)
  }

  function handleSkip() {
    if (!canSkip || selectedOfferId || isResultPending) {
      return
    }

    const nextState = skipOfferGroup(
      gameState,
      pool,
      createSeededRng(rngSeed + gameState.round * 31 + 7),
    )
    setGameState(nextState)
    if (nextState.result) {
      scheduleResultScreen()
    } else {
      setScreen('draft')
    }
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
    function moveDragAt(clientX: number, clientY: number) {
      const preview = dragPreviewRef.current
      if (!preview) {
        return
      }

      const next = {
        ...preview,
        x: clientX - preview.offsetX,
        y: clientY - preview.offsetY,
      }
      dragPreviewRef.current = next
      suppressNextSlotClickRef.current = true
      setDragPreview(next)
    }

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
      dragPreviewRef.current = null
      setDraggingSlot(null)
      setDragPreview(null)
    }

    function clearDrag() {
      draggingSlotRef.current = null
      dragPreviewRef.current = null
      setDraggingSlot(null)
      setDragPreview(null)
    }

    function handleWindowPointerMove(event: PointerEvent) {
      moveDragAt(event.clientX, event.clientY)
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
    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointercancel', clearDrag)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('touchend', handleWindowTouchEnd)
    window.addEventListener('touchcancel', clearDrag)

    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointercancel', clearDrag)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      window.removeEventListener('touchend', handleWindowTouchEnd)
      window.removeEventListener('touchcancel', clearDrag)
    }
  }, [])

  function handleSlotClick(slot: CourtSlotId) {
    if (suppressNextSlotClickRef.current) {
      suppressNextSlotClickRef.current = false
      return
    }

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
                {FREE_SKIP_COUNT} 次免费跳过，用完后必须从当前报价中签人。
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

          <section className={`offer-stage ${selectedOfferId ? 'is-transitioning' : ''}`} key={gameState.round}>
            {gameState.currentOffers.map((offer, index) => {
              return (
                <button
                  key={offer.id}
                  type="button"
                  className={[
                    'offer-card-button',
                    offer.offerState !== 'enabled' ? 'is-disabled' : '',
                    selectedOfferId === offer.id ? 'is-selected-for-signing' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleSign(offer)}
                  aria-disabled={offer.offerState !== 'enabled' || Boolean(selectedOfferId)}
                >
                  <PlayerCardTile
                    card={offer}
                    price={offer.price}
                    size="large"
                    statusLabel={getOfferStateText(offer)}
                    index={index}
                    onLongPressOpen={openPlayerDetail}
                  />
                </button>
              )
            })}
          </section>

          <section className="action-bar">
            <button
              type="button"
              className="ghost-button restart-icon-button"
              onClick={startRun}
              aria-label="重新开始"
              title="重新开始"
            >
              <RestartIcon />
            </button>
            <button
              type="button"
              className="primary-button skip-button"
              onClick={handleSkip}
              disabled={!canSkip || isResultPending}
            >
              {skipLabel}
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
                const isRevealingSlot = Boolean(card && revealingSlot === slot)

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
                      isRevealingSlot ? 'is-revealing' : '',
                      getSlotRole(slot),
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleSlotClick(slot)}
                    onPointerDown={(event) => {
                      if (card) {
                        beginDraggingSlot(slot, event, card)
                      }
                    }}
                  >
                    <span className="court-slot-label">{formatSlotLabel(slot)}</span>
                    {card ? (
                      <span
                        className={[
                          'court-player-chip',
                          isRevealingSlot ? 'is-revealing' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <PlayerCardTile
                          card={card}
                          price={card.pricePaid}
                          size="mini"
                          statusLabel="可签约"
                          onLongPressOpen={openPlayerDetail}
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

      {isResultPending && (
        <section className="result-pending-overlay" aria-live="polite" aria-label="王朝阵容锁定">
          <h2>王朝阵容锁定</h2>
          <p>thikink...</p>
          <span aria-hidden="true" />
        </section>
      )}

      {dragPreview && (
        <div
          className="drag-preview"
          style={
            {
              '--drag-x': `${dragPreview.x}px`,
              '--drag-y': `${dragPreview.y}px`,
              '--drag-w': `${dragPreview.width}px`,
              '--drag-h': `${dragPreview.height}px`,
            } as CSSProperties &
            Record<'--drag-x' | '--drag-y' | '--drag-w' | '--drag-h', string>
          }
        >
          <PlayerCardTile
            card={dragPreview.card}
            price={dragPreview.price}
            size="mini"
            statusLabel="可签约"
          />
        </div>
      )}

      {screen === 'result' && gameState.result && (
        <section className="screen result-screen">
          <div className="result-hero">
            <p className="eyebrow">{getResultReason(gameState.result.gameOverReason)}</p>
            <h2>王朝评分</h2>
            <p>
              实力 {gameState.result.strengthScore} · 上限 {gameState.result.superstarScore} · 结构{' '}
              {gameState.result.balanceScore} · 预算 {gameState.result.budgetScore}
            </p>
          </div>

          <section className="result-metrics">
            <article
              className={getMetricTone(gameState.result.dynastyScore, 90, 85)}
            >
              <span>王朝评分</span>
              <strong>{gameState.result.dynastyScore}</strong>
            </article>
            <article
              className={getMetricTone(gameState.result.projectedWins, 72, 65)}
            >
              <span>预计战绩</span>
              <strong>
                {gameState.result.projectedWins}-{gameState.result.projectedLosses}
              </strong>
            </article>
            <article
              className={getMetricTone(gameState.result.championshipOdds, 80, 60)}
            >
              <span>夺冠概率</span>
              <strong>{gameState.result.championshipOdds}%</strong>
            </article>
          </section>

          <section className="result-breakdown" aria-label="阵容分析">
            <article>
              <span>进攻</span>
              <strong>{gameState.result.offenseScore}</strong>
            </article>
            <article>
              <span>防守</span>
              <strong>{gameState.result.defenseScore}</strong>
            </article>
            <article>
              <span>体能</span>
              <strong>{gameState.result.physicalScore}</strong>
            </article>
            <article>
              <span>心态</span>
              <strong>{gameState.result.mentalityScore}</strong>
            </article>
          </section>

          <section className="result-lineup-grid" aria-label="最终阵容">
            {getResultLineup(gameState.result).map(({ slot, card, pricePaid }) => {
              return (
                <article
                  key={slot}
                  className={`result-lineup-card ${card ? 'is-filled' : 'is-empty'}`}
                >
                  <span className="result-slot-label">{formatSlotLabel(slot)}</span>
                  {card ? (
                    <PlayerCardTile
                      card={card}
                      price={pricePaid}
                      size="large"
                      statusLabel={formatSlotLabel(slot)}
                      className="result-player-card"
                      onLongPressOpen={openPlayerDetail}
                    />
                  ) : (
                    <div className="result-empty-slot">
                      <strong>{formatSlotLabel(slot)}</strong>
                      <span>空位</span>
                    </div>
                  )}
                </article>
              )
            })}
          </section>

          <section className="result-summary">
            <button type="button" className="primary-button" onClick={startRun}>
              再来一局
            </button>
          </section>
        </section>
      )}

      {playerDetail && (
        <PlayerDetailOverlay
          detail={playerDetail}
          onClose={() => setPlayerDetail(null)}
        />
      )}
    </main>
  )
}

export default App
