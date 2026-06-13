import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const seedPath = path.join(__dirname, 'data', 'legend-seed-snapshot.json')
const overridesPath = path.join(__dirname, 'data', 'legend-overrides.json')
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
  const sourcePool = seed.length >= 150 ? seed : await readJson(outputPath)

  const legendPool = sourcePool.map((player) => {
    const override = overrides[player.id]
    const positions = override?.positions ?? player.positions

    if (!positions) {
      throw new Error(`Missing positions for ${player.id}`)
    }

    const tier = getTier(player.sourceRating)

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
