import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const poolPath = path.join(projectRoot, 'src', 'data', 'legend-pool.json')
const snapshotPath = path.join(__dirname, 'data', '2k-attribute-snapshot.json')

const CURRENT_TEAMS_URL = 'https://www.2kratings.com/current-teams'
const ALL_TIME_TEAMS_URL = 'https://www.2kratings.com/all-time-teams'
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0 Safari/537.36'

const GROUP_LABELS = {
  'Outside Scoring': 'outsideScoring',
  'Inside Scoring': 'insideScoring',
  Playmaking: 'playmaking',
  Defense: 'defense',
  Rebounding: 'rebounding',
  Athleticism: 'athleticism',
  Intangibles: 'intangibles',
}

const ATTRIBUTE_LABELS = {
  'Shot IQ': 'shotIQ',
  'Offensive Consistency': 'offensiveConsistency',
  'Pass IQ': 'passIQ',
  'Help Defense IQ': 'helpDefenseIQ',
  'Defensive Consistency': 'defensiveConsistency',
  Stamina: 'stamina',
  'Overall Durability': 'durability',
  Strength: 'strength',
  Agility: 'agility',
}

function parseArgs(argv) {
  const args = {
    headed: false,
    limit: null,
    refreshAll: false,
    write: true,
  }

  for (const arg of argv) {
    if (arg === '--headed') {
      args.headed = true
      continue
    }

    if (arg === '--refresh-all') {
      args.refreshAll = true
      continue
    }

    if (arg === '--no-write') {
      args.write = false
      continue
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length))
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --limit value: ${arg}`)
      }
      args.limit = Math.floor(value)
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return args
}

function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function getPathSegment(href) {
  try {
    const url = new URL(href)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts.length === 1 ? parts[0] : null
  } catch {
    return null
  }
}

function sleep(timeoutMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs)
  })
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function collectPlayerUrlIndex(page, indexUrl, targetNames) {
  await page.goto(indexUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(500)

  const teamUrls = await page.evaluate((url) => {
    const isAllTime = url.includes('/all-time-teams')
    return Array.from(document.querySelectorAll('a[href]'))
      .map((anchor) => anchor.href)
      .filter((href) =>
        isAllTime
          ? href.includes('/teams/all-time-')
          : href.includes('/teams/') && !href.includes('/teams/all-time-'),
      )
  }, indexUrl)

  const uniqueTeamUrls = [...new Set(teamUrls)]
  const playerUrlIndex = new Map()

  for (const teamUrl of uniqueTeamUrls) {
    await page.goto(teamUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(250)

    const anchors = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map((anchor) => ({
        href: anchor.href,
        text: anchor.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      })),
    )

    for (const anchor of anchors) {
      const key = normalizeName(anchor.text)
      if (!targetNames.has(key)) {
        continue
      }

      const segment = getPathSegment(anchor.href)
      if (!segment || segment === 'current-teams' || segment === 'all-time-teams') {
        continue
      }

      playerUrlIndex.set(key, anchor.href)
    }
  }

  return playerUrlIndex
}

async function scrapePlayerAttributes(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(400)

  const data = await page.evaluate(
    ({ groupLabels, attributeLabels }) => {
      const groups = {}
      const attributes = {}
      const cards = Array.from(document.querySelectorAll('.card'))

      function cleanLabel(element) {
        if (!element) {
          return ''
        }

        const clone = element.cloneNode(true)
        clone.querySelectorAll('[role="tooltip"], svg').forEach((node) => node.remove())
        return clone.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      }

      for (const card of cards) {
        const heading = card.querySelector('h4')
        const title = heading?.textContent?.replace(/\s+/g, ' ').trim()
        if (!title || !(title in groupLabels)) {
          continue
        }

        const headerValue = Number(card.querySelector('.card-header .attribute-box')?.textContent?.trim())
        if (Number.isFinite(headerValue)) {
          groups[groupLabels[title]] = headerValue
        }

        const rows = Array.from(card.querySelectorAll('.card-body li'))
        for (const row of rows) {
          const label = cleanLabel(row.querySelector('.d-flex > span'))
          const value = Number(row.querySelector('.attribute-box')?.textContent?.trim())
          const key = attributeLabels[label]
          if (key && Number.isFinite(value)) {
            attributes[key] = value
          }
        }
      }

      const title = document.title.trim()
      const bodyText = document.body.innerText
      const overallMatch =
        bodyText.match(/current version of .*? is (\d+)/i) ??
        bodyText.match(/with a (\d+)\s+OVR/i) ??
        title.match(/\b(\d+)\s*OVR\b/i)

      return {
        pageTitle: title,
        overall: overallMatch ? Number(overallMatch[1]) : null,
        groups,
        attributes,
      }
    },
    { groupLabels: GROUP_LABELS, attributeLabels: ATTRIBUTE_LABELS },
  )

  const missingGroups = Object.values(GROUP_LABELS).filter((key) => !Number.isFinite(data.groups[key]))
  const missingAttributes = Object.values(ATTRIBUTE_LABELS).filter(
    (key) => !Number.isFinite(data.attributes[key]),
  )

  if (missingGroups.length > 0 || missingAttributes.length > 0) {
    throw new Error(
      `Incomplete scrape for ${url}. Missing groups: ${missingGroups.join(', ') || 'none'}. Missing attributes: ${
        missingAttributes.join(', ') || 'none'
      }.`,
    )
  }

  return data
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const pool = await readJson(poolPath)
  const existingSnapshot = await readJson(snapshotPath)

  const pendingPlayers = pool
    .filter((player) =>
      args.refreshAll ? true : existingSnapshot[player.id]?.sourceStatus !== 'verified-2k-snapshot',
    )
    .slice(0, args.limit ?? undefined)

  if (pendingPlayers.length === 0) {
    console.log('No players need attribute scraping.')
    return
  }

  const targetNames = new Set(pendingPlayers.map((player) => normalizeName(player.name)))
  const browser = await chromium.launch({ headless: !args.headed })
  const page = await browser.newPage({ userAgent: USER_AGENT })

  try {
    const currentIndex = await collectPlayerUrlIndex(page, CURRENT_TEAMS_URL, targetNames)
    const allTimeIndex = await collectPlayerUrlIndex(page, ALL_TIME_TEAMS_URL, targetNames)

    const unresolvedPlayers = pendingPlayers.filter((player) => {
      const key = normalizeName(player.name)
      return !currentIndex.has(key) && !allTimeIndex.has(key)
    })

    if (unresolvedPlayers.length > 0) {
      throw new Error(
        `Could not resolve player pages for: ${unresolvedPlayers.map((player) => player.name).join(', ')}`,
      )
    }

    const nextSnapshot = { ...existingSnapshot }
    const failures = []

    for (const [index, player] of pendingPlayers.entries()) {
      const key = normalizeName(player.name)
      const url = currentIndex.get(key) ?? allTimeIndex.get(key)
      if (!url) {
        failures.push(`${player.name}: missing resolved URL`)
        continue
      }

      try {
        const scraped = await scrapePlayerAttributes(page, url)
        nextSnapshot[player.id] = {
          sourceUrl: url,
          sourceVersion: scraped.pageTitle,
          sourceStatus: 'verified-2k-snapshot',
          groups: scraped.groups,
          attributes: scraped.attributes,
        }

        const overall =
          Number.isFinite(scraped.overall) && scraped.overall !== player.sourceRating
            ? `, OVR ${player.sourceRating} -> ${scraped.overall}`
            : ''
        console.log(`[${index + 1}/${pendingPlayers.length}] ${player.name}${overall}`)
      } catch (error) {
        failures.push(`${player.name}: ${error instanceof Error ? error.message : String(error)}`)
      }

      await sleep(250)
    }

    if (args.write) {
      await writeFile(snapshotPath, `${JSON.stringify(nextSnapshot, null, 2)}\n`, 'utf8')
    }

    console.log(
      args.write
        ? `Updated ${snapshotPath} with ${pendingPlayers.length - failures.length} verified entries.`
        : `Dry run completed with ${pendingPlayers.length - failures.length} verified entries.`,
    )

    if (failures.length > 0) {
      console.error('Failures:')
      failures.forEach((failure) => console.error(`- ${failure}`))
      process.exitCode = 1
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
