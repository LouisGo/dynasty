import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const seedPath = path.join(__dirname, 'data', 'legend-seed-snapshot.json')
const overridesPath = path.join(__dirname, 'data', 'legend-overrides.json')
const attributesPath = path.join(__dirname, 'data', '2k-attribute-snapshot.json')
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
    ratings: {
      offense: weightedAverage([
        [groups.outsideScoring, 0.35],
        [groups.insideScoring, 0.25],
        [groups.playmaking, 0.25],
        [attributes.offensiveConsistency, 0.1],
        [attributes.shotIQ, 0.05],
      ]),
      defense: weightedAverage([
        [groups.defense, 0.65],
        [groups.rebounding, 0.2],
        [attributes.defensiveConsistency, 0.1],
        [attributes.helpDefenseIQ, 0.05],
      ]),
      physical: weightedAverage([
        [groups.athleticism, 0.45],
        [attributes.stamina, 0.2],
        [attributes.durability, 0.15],
        [attributes.strength, 0.1],
        [attributes.agility, 0.1],
      ]),
      mentality: weightedAverage([
        [groups.intangibles, 0.35],
        [attributes.shotIQ, 0.2],
        [attributes.passIQ, 0.15],
        [attributes.offensiveConsistency, 0.15],
        [attributes.defensiveConsistency, 0.15],
      ]),
    },
    sourceAttributes: {
      sourceVersion: sourceEntry.sourceVersion,
      groups,
      attributes,
    },
    attributeSourceUrl: sourceEntry.sourceUrl,
    attributeSourceStatus: sourceEntry.sourceStatus,
  }
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
  const remote = await tryRemoteFetch()
  const sourcePool = seed.length >= 150 ? seed : await readJson(outputPath)

  const legendPool = sourcePool.map((player) => {
    const override = overrides[player.id]
    const positions = override?.positions ?? player.positions

    if (!positions) {
      throw new Error(`Missing positions for ${player.id}`)
    }

    const tier = getTier(player.sourceRating)
    const attributeProfile = buildAttributeProfile({ ...player, positions }, attributes)

    return {
      id: player.id,
      name: player.name,
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
    }
  })

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
