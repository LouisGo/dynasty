import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const seedPath = path.join(__dirname, 'data', 'legend-seed-snapshot.json')
const baseSnapshotPath = path.join(__dirname, 'data', 'legend-base-snapshot.json')
const overridesPath = path.join(__dirname, 'data', 'legend-overrides.json')
const attributesPath = path.join(__dirname, 'data', '2k-attribute-snapshot.json')
const chineseNamesPath = path.join(__dirname, 'data', 'legend-chinese-names.json')
const curationPath = path.join(__dirname, 'data', 'legend-pool-curation.json')
const peakImpactOverridesPath = path.join(__dirname, 'data', 'peak-impact-overrides.json')
const outputPath = path.join(projectRoot, 'src', 'data', 'legend-pool.json')

function getTier(sourceRating) {
  if (sourceRating >= 97) {
    return 'T0'
  }

  if (sourceRating >= 95) {
    return 'T1'
  }

  if (sourceRating >= 92) {
    return 'T2'
  }

  if (sourceRating >= 86) {
    return 'T3'
  }

  return 'T4'
}

function getDefaultTagline(sourceRating) {
  if (sourceRating >= 97) {
    return '历史级建队核心。'
  }

  if (sourceRating >= 95) {
    return '能改变阵容上限的超巨。'
  }

  if (sourceRating >= 90) {
    return '稳定的明星主力。'
  }

  if (sourceRating >= 86) {
    return '适合补齐阵容结构的强力拼图。'
  }

  if (sourceRating >= 78) {
    return '预算紧张时的可靠轮换。'
  }

  return '最后预算下的补位选择。'
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function readJsonOptional(filePath, fallback) {
  try {
    return await readJson(filePath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return fallback
    }

    throw error
  }
}

function assertRating(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 99) {
    throw new Error(`${label} must be a 0-99 number.`)
  }
}

function weightedAverage(parts) {
  return Math.round(parts.reduce((sum, [value, weight]) => sum + value * weight, 0))
}

function clampRating(value) {
  return Math.max(25, Math.min(99, Math.round(value)))
}

function mergeSourcePools(primary, additions) {
  const byId = new Map()

  for (const player of primary) {
    byId.set(player.id, player)
  }

  for (const player of additions) {
    if (!byId.has(player.id)) {
      byId.set(player.id, player)
    }
  }

  return [...byId.values()]
}

const positionProfiles = {
  PG: {
    outsideScoring: 2,
    insideScoring: -4,
    playmaking: 7,
    defense: -2,
    rebounding: -10,
    athleticism: 1,
    intangibles: 2,
    strength: -10,
    agility: 7,
  },
  SG: {
    outsideScoring: 5,
    insideScoring: -1,
    playmaking: 1,
    defense: 0,
    rebounding: -7,
    athleticism: 3,
    intangibles: 2,
    strength: -7,
    agility: 5,
  },
  SF: {
    outsideScoring: 2,
    insideScoring: 1,
    playmaking: 0,
    defense: 1,
    rebounding: -2,
    athleticism: 3,
    intangibles: 2,
    strength: -2,
    agility: 3,
  },
  PF: {
    outsideScoring: -2,
    insideScoring: 5,
    playmaking: -4,
    defense: 3,
    rebounding: 6,
    athleticism: 0,
    intangibles: 2,
    strength: 6,
    agility: -1,
  },
  C: {
    outsideScoring: -8,
    insideScoring: 8,
    playmaking: -7,
    defense: 5,
    rebounding: 8,
    athleticism: -2,
    intangibles: 2,
    strength: 8,
    agility: -4,
  },
}

function getAveragePositionProfile(positions) {
  const totals = {}

  for (const position of positions) {
    const profile = positionProfiles[position]
    if (!profile) {
      throw new Error(`Unknown position ${position}.`)
    }

    for (const [key, value] of Object.entries(profile)) {
      totals[key] = (totals[key] ?? 0) + value
    }
  }

  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, value / positions.length]),
  )
}

function buildEstimatedAttributeEntry(player) {
  const profile = getAveragePositionProfile(player.positions)
  const base = player.sourceRating - 3
  const adjusted = (key) => base + profile[key] * 0.65
  const groups = {
    outsideScoring: clampRating(adjusted('outsideScoring')),
    insideScoring: clampRating(adjusted('insideScoring')),
    playmaking: clampRating(adjusted('playmaking')),
    defense: clampRating(adjusted('defense')),
    rebounding: clampRating(adjusted('rebounding')),
    athleticism: clampRating(adjusted('athleticism')),
    intangibles: clampRating(adjusted('intangibles')),
  }
  const attributes = {
    shotIQ: clampRating((groups.outsideScoring + groups.insideScoring) / 2 + 3),
    offensiveConsistency: clampRating(player.sourceRating),
    passIQ: clampRating(groups.playmaking + 3),
    helpDefenseIQ: clampRating(groups.defense + 2),
    defensiveConsistency: clampRating(groups.defense + 1),
    stamina: clampRating(player.sourceRating),
    durability: clampRating(base + 2),
    strength: clampRating(adjusted('strength')),
    agility: clampRating(adjusted('agility')),
  }

  return {
    sourceUrl: null,
    sourceVersion: 'estimated from OVR and position archetype',
    sourceStatus: 'estimated-archetype-v1',
    groups,
    attributes,
  }
}

function buildAttributeProfile(player, snapshot) {
  const playerId = player.id
  const entry = snapshot[playerId]

  const sourceEntry = entry ?? buildEstimatedAttributeEntry(player)

  const groupKeys = [
    'outsideScoring',
    'insideScoring',
    'playmaking',
    'defense',
    'rebounding',
    'athleticism',
    'intangibles',
  ]
  const attributeKeys = [
    'shotIQ',
    'offensiveConsistency',
    'passIQ',
    'helpDefenseIQ',
    'defensiveConsistency',
    'stamina',
    'durability',
    'strength',
    'agility',
  ]

  for (const key of groupKeys) {
    assertRating(sourceEntry.groups?.[key], `${playerId}.groups.${key}`)
  }
  for (const key of attributeKeys) {
    assertRating(sourceEntry.attributes?.[key], `${playerId}.attributes.${key}`)
  }

  const groups = sourceEntry.groups
  const attributes = sourceEntry.attributes

  return {
    ratingModelVersion: '2k-attributes-v1',
    sourceAttributes: {
      sourceVersion: sourceEntry.sourceVersion,
      groups,
      attributes,
    },
    attributeSourceUrl: sourceEntry.sourceUrl,
    attributeSourceStatus: sourceEntry.sourceStatus,
  }
}

function getPeakSeasonLabel(sourceVersion) {
  if (!sourceVersion) {
    return 'peak profile'
  }

  return sourceVersion
    .replace(/^NBA 2K26 /, '')
    .replace(/ NBA 2K26 Rating/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPeakImpactProfile(player, attributeProfile, override) {
  const groups = attributeProfile.sourceAttributes.groups
  const attributes = attributeProfile.sourceAttributes.attributes
  const sourceIsVerified = attributeProfile.attributeSourceStatus === 'verified-2k-snapshot'

  const primaryEngine = weightedAverage([
    [groups.outsideScoring, 0.22],
    [groups.insideScoring, 0.18],
    [groups.playmaking, 0.28],
    [attributes.offensiveConsistency, 0.17],
    [attributes.shotIQ, 0.1],
    [player.sourceRating, 0.05],
  ])
  const gravity = weightedAverage([
    [groups.outsideScoring, 0.52],
    [attributes.shotIQ, 0.18],
    [groups.playmaking, 0.13],
    [attributes.offensiveConsistency, 0.17],
  ])
  const defensiveAnchor = weightedAverage([
    [groups.defense, 0.48],
    [groups.rebounding, 0.18],
    [attributes.defensiveConsistency, 0.2],
    [attributes.helpDefenseIQ, 0.14],
  ])
  const wingValue = weightedAverage([
    [groups.defense, 0.28],
    [groups.outsideScoring, 0.18],
    [groups.playmaking, 0.16],
    [groups.athleticism, 0.16],
    [attributes.agility, 0.12],
    [groups.intangibles, 0.1],
  ])
  const rebounding = groups.rebounding
  const availability = weightedAverage([
    [attributes.stamina, 0.45],
    [attributes.durability, 0.4],
    [player.sourceRating, 0.15],
  ])
  const rawPeakValue = weightedAverage([
    [player.sourceRating, 0.32],
    [primaryEngine, 0.22],
    [Math.max(gravity, defensiveAnchor, wingValue), 0.16],
    [defensiveAnchor, 0.1],
    [rebounding, 0.08],
    [availability, 0.12],
  ])
  const peakFloor = player.sourceRating
  const peakValue = Math.max(rawPeakValue, peakFloor)

  const profile = {
    peakSeasonLabel:
      override?.peakSeasonLabel ?? getPeakSeasonLabel(attributeProfile.sourceAttributes.sourceVersion),
    sourceType: override?.sourceType ?? (sourceIsVerified ? 'verified-2k-snapshot' : 'estimated-peak'),
    confidence: override?.confidence ?? (sourceIsVerified ? 'high' : 'low'),
    manualCorrectionNote: override?.manualCorrectionNote ?? null,
    peakValue,
    primaryEngine,
    gravity,
    defensiveAnchor,
    wingValue,
    rebounding,
    availability,
  }

  for (const key of [
    'peakValue',
    'primaryEngine',
    'gravity',
    'defensiveAnchor',
    'wingValue',
    'rebounding',
    'availability',
  ]) {
    profile[key] = override?.[key] ?? profile[key]
    assertRating(profile[key], `${player.id}.peakImpact.${key}`)
  }

  return profile
}

async function tryRemoteFetch() {
  const sources = [
    'https://nba.2k.com/2k26/ratings/',
    'https://www.2kratings.com/lists/top-100-all-time-players',
  ]
  const errors = []

  for (const url of sources) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0 Safari/537.36',
        },
      })

      const body = await response.text()
      const blocked =
        !response.ok ||
        /just a moment|request blocked|enable javascript and cookies/i.test(body)

      if (!blocked) {
        return {
          source: url,
          note:
            'Remote fetch succeeded, but this prototype still relies on the checked-in snapshot for deterministic builds.',
        }
      }

      errors.push(`${url} -> blocked (${response.status})`)
    } catch (error) {
      errors.push(`${url} -> ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    source: 'snapshot',
    note: `Remote sources unavailable; using checked-in snapshot. ${errors.join('; ')}`,
  }
}

async function main() {
  const seed = await readJson(seedPath)
  const overrides = await readJson(overridesPath)
  const attributes = await readJson(attributesPath)
  const chineseNames = await readJson(chineseNamesPath)
  const curation = await readJson(curationPath)
  const peakImpactOverrides = await readJson(peakImpactOverridesPath)
  const remote = await tryRemoteFetch()
  const baseSnapshot = await readJsonOptional(baseSnapshotPath, seed)
  const sourcePool = mergeSourcePools(baseSnapshot, seed)
  const excludedIds = new Set(Object.keys(curation.excludedIds ?? {}))

  const legendPool = sourcePool.filter((player) => !excludedIds.has(player.id)).map((player) => {
    const override = overrides[player.id]
    const positions = override?.positions ?? player.positions

    if (!positions) {
      throw new Error(`Missing positions for ${player.id}`)
    }

    const tier = getTier(player.sourceRating)
    const attributeProfile = buildAttributeProfile({ ...player, positions }, attributes)
    const peakImpact = buildPeakImpactProfile(player, attributeProfile, peakImpactOverrides[player.id])

    return {
      id: player.id,
      name: player.name,
      chineseName: chineseNames[player.id] ?? player.name,
      positions,
      sourceRating: player.sourceRating,
      tier,
      contractCost: Math.max(1, player.sourceRating - 74),
      rarityWeight: Math.max(1, 100 - player.sourceRating),
      tagline: player.tagline ?? override?.tagline ?? getDefaultTagline(player.sourceRating),
      source: player.source,
      sourceStatus:
        player.sourceStatus === 'focused-modern-snapshot' ? player.sourceStatus : remote.source,
      ...attributeProfile,
      peakImpact,
    }
  }).sort((left, right) => right.sourceRating - left.sourceRating || left.name.localeCompare(right.name))

  if (
    curation.targetCount &&
    Math.abs(legendPool.length - curation.targetCount) > 3
  ) {
    throw new Error(
      `Curated pool has ${legendPool.length} cards, expected around ${curation.targetCount}.`,
    )
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(legendPool, null, 2)}\n`, 'utf8')

  console.log(
    `Generated ${legendPool.length} legend cards at ${path.relative(projectRoot, outputPath)}.`,
  )
  console.log(remote.note)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
