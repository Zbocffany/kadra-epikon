import { createClient } from '@supabase/supabase-js'

const WIKIDATA_SEARCH_URL = 'https://www.wikidata.org/w/api.php'
const WIKIDATA_ENTITY_URL = 'https://www.wikidata.org/wiki/Special:EntityData'
const USER_AGENT = 'kadra-epikon/club-founded-importer'
const DEFAULT_MIN_SCORE = 80
const DEFAULT_LIMIT = 0
const YEAR_PRECISION = 'YEAR'
const FOUNDED_TITLE = 'Założenie klubu'
const REQUEST_DELAY_MS = 280
const RETRY_COUNT = 6
const RETRY_BASE_DELAY_MS = 1100
const MIN_REASONABLE_YEAR = 1800
const MAX_REASONABLE_YEAR = new Date().getUTCFullYear()

const FOOTBALL_HINTS = [
  'football club',
  'association football club',
  'soccer club',
  'klub pilkarski',
  'klub piłkarski',
  'pilkarski klub',
  'piłkarski klub',
]

// Wikidata Q-ids frequently used for football clubs.
const CLUB_LIKE_INSTANCE_IDS = new Set([
  'Q476028', // association football club
  'Q847017', // sports club
  'Q15944511', // football team
])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseArgs(argv) {
  const args = {
    apply: false,
    limit: DEFAULT_LIMIT,
    minScore: DEFAULT_MIN_SCORE,
    offset: 0,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--apply') {
      args.apply = true
      continue
    }
    if (arg === '--limit') {
      args.limit = Number.parseInt(argv[i + 1] ?? '0', 10) || 0
      i += 1
      continue
    }
    if (arg === '--offset') {
      args.offset = Number.parseInt(argv[i + 1] ?? '0', 10) || 0
      i += 1
      continue
    }
    if (arg === '--min-score') {
      args.minScore = Number.parseInt(argv[i + 1] ?? String(DEFAULT_MIN_SCORE), 10) || DEFAULT_MIN_SCORE
      i += 1
    }
  }

  return args
}

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function normalize(value) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseYearFromTime(value) {
  if (!value) return null
  const match = String(value).match(/^\+?(\d{1,6})-/)
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  return Number.isFinite(year) && year > 0 ? year : null
}

function getLabel(entity, language = 'pl') {
  return entity?.labels?.[language]?.value
    ?? entity?.labels?.en?.value
    ?? entity?.labels?.de?.value
    ?? null
}

function getDescription(entity, language = 'pl') {
  return entity?.descriptions?.[language]?.value
    ?? entity?.descriptions?.en?.value
    ?? entity?.descriptions?.de?.value
    ?? null
}

function getAliases(entity) {
  const values = []
  for (const language of ['pl', 'en', 'de']) {
    for (const alias of entity?.aliases?.[language] ?? []) {
      if (alias?.value) values.push(alias.value)
    }
  }
  return values
}

function getClaimEntityIds(entity, propertyId) {
  const claims = entity?.claims?.[propertyId] ?? []
  const ids = []
  for (const claim of claims) {
    const id = claim?.mainsnak?.datavalue?.value?.id
    if (id) ids.push(id)
  }
  return ids
}

function getInceptionYear(entity) {
  const claims = entity?.claims?.P571 ?? []
  for (const claim of claims) {
    const time = claim?.mainsnak?.datavalue?.value?.time
    const year = parseYearFromTime(time)
    if (year) return year
  }
  return null
}

function scoreCandidate({ clubName, cityName, entity, searchLabel }) {
  const normalizedClub = normalize(clubName)
  const normalizedCity = normalize(cityName)
  const label = getLabel(entity) ?? searchLabel ?? ''
  const description = getDescription(entity) ?? ''
  const aliases = getAliases(entity)
  const normalizedLabel = normalize(label)
  const normalizedDescription = normalize(description)
  const normalizedAliases = aliases.map(normalize)
  const inceptionYear = getInceptionYear(entity)
  const instanceIds = getClaimEntityIds(entity, 'P31')
  const hasClubLikeInstance = instanceIds.some((id) => CLUB_LIKE_INSTANCE_IDS.has(id))
  const hasFootballHint = FOOTBALL_HINTS.some((hint) => normalizedDescription.includes(hint))

  let score = 0

  if (normalizedLabel === normalizedClub) score += 45
  else if (normalizedLabel.includes(normalizedClub) || normalizedClub.includes(normalizedLabel)) score += 25

  if (normalizedAliases.includes(normalizedClub)) score += 25
  else if (normalizedAliases.some((alias) => alias.includes(normalizedClub) || normalizedClub.includes(alias))) score += 10

  if (hasFootballHint) score += 20
  if (hasClubLikeInstance) score += 25
  else if (instanceIds.length > 0) score += 5
  if (inceptionYear) score += 15

  if (normalizedCity) {
    if (normalizedLabel.includes(normalizedCity)) score += 10
    if (normalizedDescription.includes(normalizedCity)) score += 15
    if (normalizedAliases.some((alias) => alias.includes(normalizedCity))) score += 10
  }

  if (inceptionYear && (inceptionYear < MIN_REASONABLE_YEAR || inceptionYear > MAX_REASONABLE_YEAR)) {
    score -= 60
  }

  if (!hasFootballHint && !hasClubLikeInstance) {
    score -= 50
  }

  // Penalize women's/girls' teams when the searched club is not a women's team
  const WOMEN_INDICATORS = ['women', 'ladies', 'femmes', 'femenino', 'feminino', 'mulheres']
  const clubIsWomens = WOMEN_INDICATORS.some((w) => normalizedClub.includes(w))
  const labelIsWomens = WOMEN_INDICATORS.some((w) => normalizedLabel.includes(w))
  if (labelIsWomens && !clubIsWomens) {
    score -= 100
  }

  // Penalize B-team / reserve team labels
  // (e.g. "RCD Espanyol B" should not match "Espanyol" main team)
  const RESERVE_INDICATORS = [' b', ' ii', ' 2', ' 2nd', ' reserves', ' reserve', ' sub']
  const clubHasReserve = RESERVE_INDICATORS.some((r) => normalizedClub.endsWith(r))
  const labelHasReserve = RESERVE_INDICATORS.some((r) => normalizedLabel.endsWith(r))
  if (labelHasReserve && !clubHasReserve) {
    score -= 80
  }

  // Penalize when label contains club name only as a substring with a significant prefix
  // (e.g. "stalybridge celtic fc" matched for "celtic" → clearly wrong club)
  if (normalizedLabel.includes(normalizedClub) && normalizedLabel !== normalizedClub) {
    const idx = normalizedLabel.indexOf(normalizedClub)
    const prefix = normalizedLabel.slice(0, idx).trim()
    if (prefix.length > 4) {
      score -= 30
    }
  }

  return {
    score,
    inceptionYear,
    label,
    description,
    wikidataId: entity.id,
    hasFootballHint,
    hasClubLikeInstance,
  }
}

async function fetchJson(url) {
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        'accept': 'application/json',
      },
    })

    if (response.ok) {
      return response.json()
    }

    if ((response.status === 429 || response.status >= 500) && attempt < RETRY_COUNT) {
      const backoff = RETRY_BASE_DELAY_MS * (attempt + 1)
      await sleep(backoff)
      continue
    }

    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  throw new Error(`HTTP error for ${url}`)
}

async function searchWikidata(query) {
  const url = new URL(WIKIDATA_SEARCH_URL)
  url.searchParams.set('action', 'wbsearchentities')
  url.searchParams.set('format', 'json')
  url.searchParams.set('language', 'pl')
  url.searchParams.set('uselang', 'pl')
  url.searchParams.set('limit', '5')
  url.searchParams.set('search', query)
  url.searchParams.set('origin', '*')
  const payload = await fetchJson(url)
  await sleep(REQUEST_DELAY_MS)
  return payload?.search ?? []
}

async function fetchEntity(entityId) {
  const url = `${WIKIDATA_ENTITY_URL}/${entityId}.json`
  const payload = await fetchJson(url)
  await sleep(REQUEST_DELAY_MS)
  return payload?.entities?.[entityId] ?? null
}

async function getCityMap(supabase, cityIds) {
  const uniqueIds = [...new Set(cityIds.filter(Boolean))]
  const cityMap = new Map()
  if (!uniqueIds.length) return cityMap

  const { data, error } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .in('id', uniqueIds)

  if (error) throw new Error(`tbl_Cities: ${error.message}`)
  for (const row of data ?? []) {
    cityMap.set(row.id, row.city_name)
  }
  return cityMap
}

async function getMissingFoundedClubs(supabase) {
  const { data: clubs, error: clubsError } = await supabase
    .from('tbl_Clubs')
    .select('id, name, club_city_id')
    .order('name', { ascending: true })

  if (clubsError) throw new Error(`tbl_Clubs: ${clubsError.message}`)
  const clubRows = clubs ?? []
  const foundedIds = new Set()
  const chunkSize = 300

  for (let i = 0; i < clubRows.length; i += chunkSize) {
    const chunk = clubRows.slice(i, i + chunkSize)
    const ids = chunk.map((club) => club.id)
    const { data, error } = await supabase
      .from('tbl_Club_History')
      .select('club_id')
      .eq('event_type', 'FOUNDED')
      .in('club_id', ids)

    if (error) throw new Error(`tbl_Club_History: ${error.message}`)
    for (const row of data ?? []) {
      foundedIds.add(row.club_id)
    }
  }

  const cityMap = await getCityMap(supabase, clubRows.map((club) => club.club_city_id))
  return clubRows
    .filter((club) => !foundedIds.has(club.id))
    .map((club) => ({
      ...club,
      city_name: club.club_city_id ? (cityMap.get(club.club_city_id) ?? null) : null,
    }))
}

async function findBestCandidate(club) {
  const queries = [
    [club.name, club.city_name].filter(Boolean).join(' '),
    club.name,
  ].filter(Boolean)

  const seen = new Set()
  const candidates = []

  for (const query of queries) {
    const searchResults = await searchWikidata(query)
    for (const result of searchResults) {
      if (!result?.id || seen.has(result.id)) continue
      seen.add(result.id)
      const entity = await fetchEntity(result.id)
      if (!entity) continue
      const scored = scoreCandidate({
        clubName: club.name,
        cityName: club.city_name,
        entity,
        searchLabel: result.label,
      })
      if (scored.inceptionYear && (scored.inceptionYear < MIN_REASONABLE_YEAR || scored.inceptionYear > MAX_REASONABLE_YEAR)) {
        continue
      }
      if (!scored.hasFootballHint && !scored.hasClubLikeInstance) {
        continue
      }
      candidates.push(scored)
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0] ?? null
}

async function insertFoundedEvent(supabase, club, match) {
  const eventDate = `${String(match.inceptionYear).padStart(4, '0')}-01-01`
  const { error } = await supabase.from('tbl_Club_History').insert({
    id: crypto.randomUUID(),
    club_id: club.id,
    title: FOUNDED_TITLE,
    description: `Autoimport z Wikidata (${match.wikidataId})`,
    event_type: 'FOUNDED',
    event_date: eventDate,
    event_date_precision: YEAR_PRECISION,
    event_order: 0,
  })

  if (error) throw new Error(`Insert FOUNDED for ${club.name}: ${error.message}`)
}

function formatClub(club) {
  return club.city_name ? `${club.name} (${club.city_name})` : club.name
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const supabase = getSupabase()
  const missing = await getMissingFoundedClubs(supabase)
  const start = args.offset
  const end = args.limit > 0 ? start + args.limit : missing.length
  const clubs = missing.slice(start, end)

  console.log(`Clubs without FOUNDED: ${missing.length}`)
  console.log(args.apply ? 'Mode: APPLY' : 'Mode: DRY RUN')
  console.log(`Min score: ${args.minScore}`)
  if (!clubs.length) return

  let matched = 0
  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const [index, club] of clubs.entries()) {
    let best = null
    try {
      best = await findBestCandidate(club)
    } catch (error) {
      errors += 1
      skipped += 1
      console.log(`[${index + 1}/${clubs.length}] ERROR ${formatClub(club)} -> ${error instanceof Error ? error.message : String(error)}`)
      // On API throttling spikes, cool down and continue with next club.
      await sleep(2000)
      continue
    }

    if (!best || !best.inceptionYear || best.score < args.minScore) {
      skipped += 1
      console.log(`[${index + 1}/${clubs.length}] SKIP  ${formatClub(club)}`)
      if (best) {
        console.log(`  best=${best.label} (${best.wikidataId}), year=${best.inceptionYear ?? '—'}, score=${best.score}`)
      }
      continue
    }

    matched += 1
    console.log(`[${index + 1}/${clubs.length}] MATCH ${formatClub(club)} -> ${best.label} (${best.wikidataId}), year=${best.inceptionYear}, score=${best.score}`)

    if (args.apply) {
      await insertFoundedEvent(supabase, club, best)
      inserted += 1
    }
  }

  console.log('---')
  console.log(`Matched: ${matched}`)
  console.log(`Inserted: ${inserted}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})