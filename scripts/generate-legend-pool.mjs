import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const seedPath = path.join(__dirname, 'data', 'legend-seed-snapshot.json')
const overridesPath = path.join(__dirname, 'data', 'legend-overrides.json')
const outputPath = path.join(projectRoot, 'src', 'data', 'legend-pool.json')

const TIER_COST = {
  T0: 30,
  T1: 22,
  T2: 16,
  T3: 11,
  T4: 7,
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
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
  const remote = await tryRemoteFetch()

  const legendPool = seed.map((player) => {
    const override = overrides[player.id]

    if (!override) {
      throw new Error(`Missing override for ${player.id}`)
    }

    return {
      id: player.id,
      name: player.name,
      positions: override.positions,
      sourceRating: player.sourceRating,
      tier: override.tier,
      contractCost: TIER_COST[override.tier],
      rarityWeight: override.rarityWeight,
      tagline: override.tagline,
      source: player.source,
      sourceStatus: remote.source,
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
