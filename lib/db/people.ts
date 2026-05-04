import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

type CityCountryPeriod = {
  city_id: string
  country_id: string
  valid_from: string | null
  valid_to: string | null
}

export type AdminPersonRole = 'PLAYER' | 'COACH' | 'REFEREE'

const ROLE_ORDER: Record<AdminPersonRole, number> = {
  PLAYER: 0,
  COACH: 1,
  REFEREE: 2,
}

const ROLE_LABEL: Record<AdminPersonRole, string> = {
  PLAYER: 'Piłkarz',
  COACH: 'Trener',
  REFEREE: 'Sędzia',
}

export type AdminPersonListItem = {
  id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  birth_date: string | null
  death_date: string | null
  is_active: boolean | null
  birth_city_id: string | null
  birth_country_id: string | null
  birth_city_name: string | null
  birth_country_name: string | null
  birth_country_fifa_code: string | null
  represented_country_names: string[]
  represented_country_fifa_codes: (string | null)[]
  coached_country_names: string[]
  coached_country_fifa_codes: (string | null)[]
  roles: AdminPersonRole[]
  role_labels: string[]
  appearance_count: number
  starting_appearance_count: number
  sub_on_count: number
  sub_off_count: number
  goal_count: number
  assist_count: number
  yellow_card_count: number
  red_card_count: number
  minute_count: number
  bench_count: number
  player_match_count: number
  coach_match_count: number
  referee_match_count: number
  coach_wins: number
  coach_draws: number
  coach_losses: number
  coach_goals_scored: number
  coach_goals_conceded: number
  coach_points_per_match: number
}

export type AdminPersonDetails = AdminPersonListItem & {
  represented_country_ids: string[]
}

export type AdminPersonBirthCityOption = {
  id: string
  city_name: string
  current_country_id: string | null
  current_country_name: string | null
}

function sortPeriods(periods: CityCountryPeriod[]): CityCountryPeriod[] {
  return [...periods].sort((a, b) => {
    const aCurrent = a.valid_to === null
    const bCurrent = b.valid_to === null

    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1

    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : Number.NEGATIVE_INFINITY
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : Number.NEGATIVE_INFINITY
    if (aTo !== bTo) return bTo - aTo

    const aFrom = a.valid_from ? new Date(a.valid_from).getTime() : Number.NEGATIVE_INFINITY
    const bFrom = b.valid_from ? new Date(b.valid_from).getTime() : Number.NEGATIVE_INFINITY
    return bFrom - aFrom
  })
}

function buildDisplayName(person: Pick<AdminPersonListItem, 'first_name' | 'last_name' | 'nickname'>): string {
  const first = person.first_name?.trim() ?? ''
  const last = person.last_name?.trim() ?? ''
  const nick = person.nickname?.trim() ?? ''

  const fullName = `${first} ${last}`.trim()
  // If both full name and nickname exist, prefer nickname
  if (fullName && nick) return nick
  if (nick) return nick
  if (fullName) return fullName
  return '—'
}

export function getPersonDisplayName(person: Pick<AdminPersonListItem, 'first_name' | 'last_name' | 'nickname'>): string {
  return buildDisplayName(person)
}

function mapRolesToLabels(roles: AdminPersonRole[]): string[] {
  return roles.map((role) => ROLE_LABEL[role])
}

async function getRolesByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, AdminPersonRole[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const allParticipants: { person_id: string; role: string }[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Participants')
      .select('person_id, role')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
    allParticipants.push(...(data ?? []))
  }
  const participants = allParticipants

  const map = new Map<string, AdminPersonRole[]>()

  for (const row of participants ?? []) {
    const role = row.role as AdminPersonRole
    if (!role || !(role in ROLE_ORDER)) continue

    const existing = map.get(row.person_id) ?? []
    if (!existing.includes(role)) {
      existing.push(role)
      existing.sort((left, right) => ROLE_ORDER[left] - ROLE_ORDER[right])
      map.set(row.person_id, existing)
    }
  }

  return map
}

async function getExplicitRepresentedCountryDataByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, { name: string; fifaCode: string | null }[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const allLinks: { person_id: string; country_id: string }[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Person_Countries')
      .select('person_id, country_id')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Person_Countries: ${error.message}`)
    allLinks.push(...(data ?? []))
  }
  const links = allLinks

  const countryIds = [...new Set(links.map((row) => row.country_id).filter(Boolean))]
  if (!countryIds.length) {
    return new Map()
  }

  const { data: countries, error: countriesError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code')
    .in('id', countryIds)

  if (countriesError) {
    throw new Error(`tbl_Countries: ${countriesError.message}`)
  }

  const countryById = new Map((countries ?? []).map((country) => [country.id, { name: country.name, fifaCode: country.fifa_code ?? null }]))
  const map = new Map<string, { name: string; fifaCode: string | null }[]>()

  for (const row of links ?? []) {
    const country = countryById.get(row.country_id)
    if (!country?.name) continue

    const existing = map.get(row.person_id) ?? []
    if (!existing.some((e) => e.name === country.name)) {
      existing.push({ name: country.name, fifaCode: country.fifaCode })
      existing.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
      map.set(row.person_id, existing)
    }
  }

  return map
}

async function getExplicitRepresentedCountryIdsByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, string[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const allLinks: { person_id: string; country_id: string }[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Person_Countries')
      .select('person_id, country_id')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Person_Countries: ${error.message}`)
    allLinks.push(...(data ?? []))
  }
  const links = allLinks

  const map = new Map<string, string[]>()

  for (const row of links ?? []) {
    const existing = map.get(row.person_id) ?? []
    if (!existing.includes(row.country_id)) {
      existing.push(row.country_id)
      map.set(row.person_id, existing)
    }
  }

  return map
}

async function getCoachedCountryNamesByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, string[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  type CoachParticipationRow = { person_id: string; team_id: string | null }
  const participations: CoachParticipationRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, team_id')
        .eq('role', 'COACH')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (coached countries): ${error.message}`)

      const rows = (data ?? []) as CoachParticipationRow[]
      participations.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const teamIds = [...new Set(participations.map((row) => row.team_id).filter((teamId): teamId is string => Boolean(teamId)))]
  if (!teamIds.length) {
    return new Map()
  }

  const countryIdByTeamId = new Map<string, string>()
  for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id')
      .in('id', teamIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Teams (coached countries): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; country_id: string | null }>) {
      if (row.country_id) {
        countryIdByTeamId.set(row.id, row.country_id)
      }
    }
  }

  const countryIds = [...new Set(countryIdByTeamId.values())]
  if (!countryIds.length) {
    return new Map()
  }

  const countryNameById = new Map<string, string>()
  for (let i = 0; i < countryIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Countries (coached countries): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; name: string | null }>) {
      if (row.name) {
        countryNameById.set(row.id, row.name)
      }
    }
  }

  const namesByPersonId = new Map<string, Set<string>>()
  for (const participation of participations) {
    if (!participation.team_id) continue
    const countryId = countryIdByTeamId.get(participation.team_id)
    if (!countryId) continue
    const countryName = countryNameById.get(countryId)
    if (!countryName) continue

    const existing = namesByPersonId.get(participation.person_id) ?? new Set<string>()
    existing.add(countryName)
    namesByPersonId.set(participation.person_id, existing)
  }

  const result = new Map<string, string[]>()
  for (const [personId, names] of namesByPersonId) {
    result.set(personId, [...names].sort((a, b) => a.localeCompare(b, 'pl')))
  }

  return result
}

async function getCoachedCountryDataByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, { names: string[]; fifaCodes: (string | null)[] }>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  type CoachParticipationRow = { person_id: string; team_id: string | null }
  const participations: CoachParticipationRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, team_id')
        .eq('role', 'COACH')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (coached countries): ${error.message}`)

      const rows = (data ?? []) as CoachParticipationRow[]
      participations.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const teamIds = [...new Set(participations.map((row) => row.team_id).filter((teamId): teamId is string => Boolean(teamId)))]
  if (!teamIds.length) {
    return new Map()
  }

  const countryIdByTeamId = new Map<string, string>()
  for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id')
      .in('id', teamIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Teams (coached countries): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; country_id: string | null }>) {
      if (row.country_id) {
        countryIdByTeamId.set(row.id, row.country_id)
      }
    }
  }

  const countryIds = [...new Set(countryIdByTeamId.values())]
  if (!countryIds.length) {
    return new Map()
  }

  const countryDataById = new Map<string, { name: string; fifaCode: string | null }>()
  for (let i = 0; i < countryIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', countryIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Countries (coached countries): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; name: string | null; fifa_code: string | null }>) {
      if (row.name) {
        countryDataById.set(row.id, { name: row.name, fifaCode: row.fifa_code ?? null })
      }
    }
  }

  const dataByPersonId = new Map<string, { names: Set<string>; fifaCodes: Map<string, string | null> }>()
  for (const participation of participations) {
    if (!participation.team_id) continue
    const countryId = countryIdByTeamId.get(participation.team_id)
    if (!countryId) continue
    const countryData = countryDataById.get(countryId)
    if (!countryData) continue

    const existing = dataByPersonId.get(participation.person_id) ?? { names: new Set<string>(), fifaCodes: new Map<string, string | null>() }
    existing.names.add(countryData.name)
    existing.fifaCodes.set(countryData.name, countryData.fifaCode)
    dataByPersonId.set(participation.person_id, existing)
  }

  const result = new Map<string, { names: string[]; fifaCodes: (string | null)[] }>()
  for (const [personId, data] of dataByPersonId) {
    const names = [...data.names].sort((a, b) => a.localeCompare(b, 'pl'))
    const fifaCodes = names.map((name) => data.fifaCodes.get(name) ?? null)
    result.set(personId, { names, fifaCodes })
  }

  return result
}

export type DuplicatePerson = {
  id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  birth_date: string | null
  birth_country_name: string | null
}

export async function findDuplicatePeopleByBirthDateAndCountry(
  birthDate: string,
  birthCountryId: string
): Promise<DuplicatePerson[]> {
  const supabase = createServiceRoleClient()

  const { data: people, error } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, birth_country_id')
    .eq('birth_date', birthDate)
    .eq('birth_country_id', birthCountryId)

  if (error) throw new Error(`tbl_People: ${error.message}`)
  if (!people?.length) return []

  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]
  let countryNameById = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryNameById = new Map((countries ?? []).map((c) => [c.id, c.name ?? '']))
  }

  return people.map((p) => ({
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    nickname: p.nickname ?? null,
    birth_date: p.birth_date ?? null,
    birth_country_name: p.birth_country_id ? (countryNameById.get(p.birth_country_id) ?? null) : null,
  }))
}

export async function getAdminPersonBirthCityOptions(): Promise<AdminPersonBirthCityOption[]> {
  const supabase = createServiceRoleClient()

  const { data: cities, error: citiesError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .order('city_name', { ascending: true })

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (!cities?.length) return []

  const cityIds = cities.map((city) => city.id)

  // Avoid oversized `.in(...)` queries that can fail at fetch layer when city count is high.
  const periods: CityCountryPeriod[] = []
  const batchSize = 250

  for (let start = 0; start < cityIds.length; start += batchSize) {
    const cityIdsBatch = cityIds.slice(start, start + batchSize)
    const { data: periodsBatch, error: periodsError } = await supabase
      .from('tbl_City_Country_Periods')
      .select('city_id, country_id, valid_from, valid_to')
      .in('city_id', cityIdsBatch)

    if (periodsError) {
      throw new Error(`tbl_City_Country_Periods: ${periodsError.message}`)
    }

    if (periodsBatch?.length) {
      periods.push(...periodsBatch)
    }
  }

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const period of periods) {
    const arr = periodsByCity.get(period.city_id) ?? []
    arr.push(period)
    periodsByCity.set(period.city_id, arr)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const best = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (best?.country_id) currentCountryIdByCity.set(cityId, best.country_id)
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryNameById = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryNameById = new Map((countries ?? []).map((country) => [country.id, country.name]))
  }

  return cities.map((city) => {
    const currentCountryId = currentCountryIdByCity.get(city.id) ?? null

    return {
      id: city.id,
      city_name: city.city_name ?? '—',
      current_country_id: currentCountryId,
      current_country_name: currentCountryId ? (countryNameById.get(currentCountryId) ?? null) : null,
    }
  })
}

type PersonStatRow = {
  appearance_count: number
  starting_appearance_count: number
  sub_on_count: number
  sub_off_count: number
  goal_count: number
  assist_count: number
  yellow_card_count: number
  red_card_count: number
  minute_count: number
  bench_count: number
}

type PersonRoleMatchCounts = {
  player_match_count: number
  coach_match_count: number
  referee_match_count: number
}

type CoachResultStats = {
  coach_wins: number
  coach_draws: number
  coach_losses: number
  coach_goals_scored: number
  coach_goals_conceded: number
}

function getCoachPointsPerMatch(input: {
  coachMatchCount: number
  coachWins: number
  coachDraws: number
}): number {
  if (input.coachMatchCount <= 0) return 0
  const pointsSum = (input.coachWins * 3) + input.coachDraws
  return pointsSum / input.coachMatchCount
}

async function getNonWalkoverMatchIdSet(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matchIds: string[]
): Promise<Set<string>> {
  if (!matchIds.length) return new Set()

  const CHUNK_SIZE = 80
  const allowedMatchIds = new Set<string>()

  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, result_type')
      .in('id', matchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches (walkover filter): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; result_type: string | null }>) {
      if (row.result_type !== 'WALKOVER') {
        allowedMatchIds.add(row.id)
      }
    }
  }

  return allowedMatchIds
}

async function getRoleMatchCountsByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, PersonRoleMatchCounts>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000
  type ParticipantRoleRow = { person_id: string; role: string; match_id: string }
  const allParticipants: ParticipantRoleRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, role, match_id')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (role counts): ${error.message}`)

      const rows = (data ?? []) as ParticipantRoleRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const allMatchIds = [...new Set(allParticipants.map((row) => row.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((row) => nonWalkoverMatchIds.has(row.match_id))

  const buckets = new Map<string, { PLAYER: Set<string>; COACH: Set<string>; REFEREE: Set<string> }>()

  for (const row of filteredParticipants) {
    const role = row.role as AdminPersonRole
    if (!(role in ROLE_ORDER)) continue
    const existing = buckets.get(row.person_id) ?? {
      PLAYER: new Set<string>(),
      COACH: new Set<string>(),
      REFEREE: new Set<string>(),
    }
    existing[role].add(row.match_id)
    buckets.set(row.person_id, existing)
  }

  const counts = new Map<string, PersonRoleMatchCounts>()
  for (const personId of personIds) {
    const existing = buckets.get(personId)
    counts.set(personId, {
      player_match_count: existing?.PLAYER.size ?? 0,
      coach_match_count: existing?.COACH.size ?? 0,
      referee_match_count: existing?.REFEREE.size ?? 0,
    })
  }

  return counts
}

async function getCoachResultStatsByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, CoachResultStats>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  // 1. Get all COACH participations (person_id, match_id, team_id coached)
  type CoachParticipantRow = { person_id: string; match_id: string; team_id: string | null }
  const participations: CoachParticipantRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, team_id')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .eq('role', 'COACH')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Participants (coach stats): ${error.message}`)
      const rows = (data ?? []) as CoachParticipantRow[]
      participations.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!participations.length) return new Map()

  // 2. Get match data for all coach matches
  const allMatchIds = [...new Set(participations.map((p) => p.match_id))]
  const nonWalkoverMatchIdsSet = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipations = participations.filter((p) => nonWalkoverMatchIdsSet.has(p.match_id))
  if (!filteredParticipations.length) return new Map()

  const filteredMatchIds = [...new Set(filteredParticipations.map((p) => p.match_id))]
  type MatchRow = { id: string; home_team_id: string; away_team_id: string; result_type: string | null; match_status: string }
  const matchDataMap = new Map<string, MatchRow>()
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id, result_type, match_status')
      .in('id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches (coach stats): ${error.message}`)
    for (const m of (data ?? []) as MatchRow[]) matchDataMap.set(m.id, m)
  }

  // 3. Get goal events for all coach matches
  type GoalEventRow = { match_id: string; event_type: string; team_id: string | null }
  const goalEvents: GoalEventRow[] = []
  const GOAL_EVENT_TYPES = ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'PENALTY_SHOOTOUT_SCORED']
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, event_type, team_id')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
        .in('event_type', GOAL_EVENT_TYPES)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Events (coach stats): ${error.message}`)
      const rows = (data ?? []) as GoalEventRow[]
      goalEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  // 4. Build per-match goal tally keyed by (matchId, teamId) — for each team separately
  // OWN_GOAL: team_id = team whose player scored it (they concede), so OWN_GOAL with team_id T
  //   means team T concedes → counted as a goal FOR the OTHER team
  type TeamGoals = { goals: number; shootoutGoals: number }
  const teamGoalsInMatch = new Map<string, TeamGoals>() // key: `${matchId}:${teamId}`

  for (const event of goalEvents) {
    if (!event.team_id) continue
    const matchData = matchDataMap.get(event.match_id)
    if (!matchData) continue

    if (event.event_type === 'PENALTY_SHOOTOUT_SCORED') {
      // shootout scored: team_id = team who scored
      const key = `${event.match_id}:${event.team_id}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.shootoutGoals += 1
      teamGoalsInMatch.set(key, entry)
    } else if (event.event_type === 'OWN_GOAL') {
      // OWN_GOAL: team_id = team of the player who scored the own goal (they concede)
      // → goal goes to the OTHER team in the match
      const otherTeamId = matchData.home_team_id === event.team_id
        ? matchData.away_team_id
        : matchData.home_team_id
      const key = `${event.match_id}:${otherTeamId}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.goals += 1
      teamGoalsInMatch.set(key, entry)
    } else {
      // GOAL, PENALTY_GOAL: team_id = team who scored
      const key = `${event.match_id}:${event.team_id}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.goals += 1
      teamGoalsInMatch.set(key, entry)
    }
  }

  // 5. Aggregate W/D/L and goals per coach (from coached team's perspective)
  const result = new Map<string, CoachResultStats>()
  for (const { person_id, match_id, team_id: coachedTeamId } of filteredParticipations) {
    if (!coachedTeamId) continue
    const matchData = matchDataMap.get(match_id)
    if (!matchData) continue
    if (matchData.match_status !== 'FINISHED') continue

    const otherTeamId = matchData.home_team_id === coachedTeamId
      ? matchData.away_team_id
      : matchData.home_team_id

    const myGoalsEntry = teamGoalsInMatch.get(`${match_id}:${coachedTeamId}`) ?? { goals: 0, shootoutGoals: 0 }
    const theirGoalsEntry = teamGoalsInMatch.get(`${match_id}:${otherTeamId}`) ?? { goals: 0, shootoutGoals: 0 }
    const myGoals = myGoalsEntry.goals
    const theirGoals = theirGoalsEntry.goals

    const existing = result.get(person_id) ?? {
      coach_wins: 0, coach_draws: 0, coach_losses: 0, coach_goals_scored: 0, coach_goals_conceded: 0,
    }
    existing.coach_goals_scored += myGoals
    existing.coach_goals_conceded += theirGoals

    const rt = matchData.result_type
    if (myGoals > theirGoals) {
      existing.coach_wins += 1
    } else if (myGoals < theirGoals) {
      existing.coach_losses += 1
    } else if (rt === 'PENALTIES' || rt === 'EXTRA_TIME_AND_PENALTIES') {
      if (myGoalsEntry.shootoutGoals > theirGoalsEntry.shootoutGoals) existing.coach_wins += 1
      else if (myGoalsEntry.shootoutGoals < theirGoalsEntry.shootoutGoals) existing.coach_losses += 1
      else existing.coach_draws += 1
    } else {
      existing.coach_draws += 1
    }
    result.set(person_id, existing)
  }

  return result
}

async function getPersonStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, PersonStatRow>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  type ParticipantRow = { person_id: string; match_id: string; is_starting: boolean | null }
  const allParticipants: ParticipantRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, is_starting')
        .eq('role', 'PLAYER')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) return new Map()

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipants.length) return new Map()

  const filteredMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]

  type SubEvent = {
    match_id: string
    primary_person_id: string | null
    secondary_person_id: string | null
    minute: number
    minute_extra: number | null
  }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, primary_person_id, secondary_person_id, minute, minute_extra')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
        .not('secondary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Events (substitutions): ${error.message}`)
      const rows = (data ?? []) as SubEvent[]
      allSubEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const subEnteredSet = new Set(
    allSubEvents
      .filter((e) => e.secondary_person_id)
      .map((e) => `${e.match_id}:${e.secondary_person_id as string}`)
  )
  type SubEntry = { minute: number; extra: number }
  const subOnByMatchPerson = new Map<string, SubEntry>()
  const subOffByMatchPerson = new Map<string, SubEntry>()
  for (const e of allSubEvents) {
    if (e.secondary_person_id) {
      subOnByMatchPerson.set(`${e.match_id}:${e.secondary_person_id}`, {
        minute: e.minute,
        extra: e.minute_extra ?? 0,
      })
    }
    if (e.primary_person_id) {
      subOffByMatchPerson.set(`${e.match_id}:${e.primary_person_id}`, {
        minute: e.minute,
        extra: e.minute_extra ?? 0,
      })
    }
  }
  const playedParticipants = allParticipants.filter(
    (p) => nonWalkoverMatchIds.has(p.match_id)
      && (p.is_starting || subEnteredSet.has(`${p.match_id}:${p.person_id}`))
  )

  const benchParticipants = allParticipants.filter(
    (p) => nonWalkoverMatchIds.has(p.match_id)
      && !p.is_starting && !subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )
  const benchMap = new Map<string, number>()
  for (const p of benchParticipants) {
    benchMap.set(p.person_id, (benchMap.get(p.person_id) ?? 0) + 1)
  }

  const playedMatchIds = [...new Set(playedParticipants.map((p) => p.match_id))]
  const playedPersonIds = new Set(playedParticipants.map((p) => p.person_id))

  const matchResultTypeMap = new Map<string, string | null>()
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, result_type')
      .in('id', playedMatchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches (result_type): ${error.message}`)
    for (const m of data ?? []) {
      matchResultTypeMap.set(m.id as string, m.result_type as string | null)
    }
  }

  const appearanceMap = new Map<string, number>()
  for (const p of playedParticipants) {
    appearanceMap.set(p.person_id, (appearanceMap.get(p.person_id) ?? 0) + 1)
  }

  const startingMap = new Map<string, number>()
  for (const p of filteredParticipants) {
    if (!p.is_starting) continue
    startingMap.set(p.person_id, (startingMap.get(p.person_id) ?? 0) + 1)
  }

  const subOnMap = new Map<string, number>()
  for (const p of playedParticipants) {
    if (p.is_starting) continue
    subOnMap.set(p.person_id, (subOnMap.get(p.person_id) ?? 0) + 1)
  }

  const subOffMap = new Map<string, number>()
  for (const e of allSubEvents) {
    if (!e.primary_person_id) continue
    subOffMap.set(e.primary_person_id, (subOffMap.get(e.primary_person_id) ?? 0) + 1)
  }

  type PrimaryEvent = { primary_person_id: string }
  type SecondaryEvent = { secondary_person_id: string }

  const allGoals: PrimaryEvent[] = []
  const allAssists: SecondaryEvent[] = []
  const allYellows: PrimaryEvent[] = []
  const allReds: PrimaryEvent[] = []

  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const batch = playedMatchIds.slice(i, i + CHUNK_SIZE)
    let fromG = 0
    while (true) {
      const goalsRes = await supabase.from('tbl_Match_Events').select('primary_person_id').in('event_type', ['GOAL', 'PENALTY_GOAL']).in('match_id', batch).not('primary_person_id', 'is', null).order('id', { ascending: true }).range(fromG, fromG + PAGE_SIZE - 1)
      if (goalsRes.error) throw new Error(`tbl_Match_Events (goals): ${goalsRes.error.message}`)
      allGoals.push(...((goalsRes.data ?? []) as PrimaryEvent[]))
      if ((goalsRes.data ?? []).length < PAGE_SIZE) break
      fromG += PAGE_SIZE
    }
    let fromA = 0
    while (true) {
      const assistsRes = await supabase.from('tbl_Match_Events').select('secondary_person_id').in('event_type', ['GOAL', 'OWN_GOAL']).in('match_id', batch).not('secondary_person_id', 'is', null).order('id', { ascending: true }).range(fromA, fromA + PAGE_SIZE - 1)
      if (assistsRes.error) throw new Error(`tbl_Match_Events (assists): ${assistsRes.error.message}`)
      allAssists.push(...((assistsRes.data ?? []) as SecondaryEvent[]))
      if ((assistsRes.data ?? []).length < PAGE_SIZE) break
      fromA += PAGE_SIZE
    }
    let fromY = 0
    while (true) {
      const yellowsRes = await supabase.from('tbl_Match_Events').select('primary_person_id').eq('event_type', 'YELLOW_CARD').in('match_id', batch).not('primary_person_id', 'is', null).order('id', { ascending: true }).range(fromY, fromY + PAGE_SIZE - 1)
      if (yellowsRes.error) throw new Error(`tbl_Match_Events (yellow cards): ${yellowsRes.error.message}`)
      allYellows.push(...((yellowsRes.data ?? []) as PrimaryEvent[]))
      if ((yellowsRes.data ?? []).length < PAGE_SIZE) break
      fromY += PAGE_SIZE
    }
    let fromR = 0
    while (true) {
      const redsRes = await supabase.from('tbl_Match_Events').select('primary_person_id').in('event_type', ['RED_CARD', 'SECOND_YELLOW_CARD']).in('match_id', batch).not('primary_person_id', 'is', null).order('id', { ascending: true }).range(fromR, fromR + PAGE_SIZE - 1)
      if (redsRes.error) throw new Error(`tbl_Match_Events (red cards): ${redsRes.error.message}`)
      allReds.push(...((redsRes.data ?? []) as PrimaryEvent[]))
      if ((redsRes.data ?? []).length < PAGE_SIZE) break
      fromR += PAGE_SIZE
    }
  }

  const statsMap = new Map<string, PersonStatRow>()
  const allPersonIds = new Set([...playedPersonIds, ...benchParticipants.map((p) => p.person_id)])
  for (const personId of allPersonIds) {
    statsMap.set(personId, {
      appearance_count: appearanceMap.get(personId) ?? 0,
      starting_appearance_count: startingMap.get(personId) ?? 0,
      sub_on_count: subOnMap.get(personId) ?? 0,
      sub_off_count: subOffMap.get(personId) ?? 0,
      goal_count: 0,
      assist_count: 0,
      yellow_card_count: 0,
      red_card_count: 0,
      minute_count: 0,
      bench_count: benchMap.get(personId) ?? 0,
    })
  }
  for (const p of playedParticipants) {
    const stats = statsMap.get(p.person_id)
    if (!stats) continue

    const resultType = matchResultTypeMap.get(p.match_id) ?? null
    const hasExtraTime =
      resultType === 'EXTRA_TIME' ||
      resultType === 'EXTRA_TIME_AND_PENALTIES' ||
      resultType === 'GOLDEN_GOAL'
    const matchRegularEnd = hasExtraTime ? 120 : 90

    const isStarter = p.is_starting === true
    const subOn = isStarter ? null : (subOnByMatchPerson.get(`${p.match_id}:${p.person_id}`) ?? null)
    if (!isStarter && !subOn) continue

    const subOff = subOffByMatchPerson.get(`${p.match_id}:${p.person_id}`) ?? null

    const entryMin = isStarter ? 0 : subOn!.minute
    const entryExtra = isStarter ? 0 : subOn!.extra
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0

    // If entering during injury time of a period (minute == period end, extra > 0),
    // shift effectiveEntry back by 1 to give exactly 1 minute for that period remainder.
    const effectiveEntry = entryExtra > 0 ? entryMin - 1 : entryMin
    // If exiting during injury time, cap to the period's regular end.
    const effectiveExit = Math.min(exitExtra > 0 ? exitMin : exitMin, matchRegularEnd)

    stats.minute_count += Math.max(0, effectiveExit - effectiveEntry)
  }
  for (const e of allGoals) {
    const s = e.primary_person_id ? statsMap.get(e.primary_person_id) : null
    if (s) s.goal_count++
  }
  for (const e of allAssists) {
    const s = e.secondary_person_id ? statsMap.get(e.secondary_person_id) : null
    if (s) s.assist_count++
  }
  for (const e of allYellows) {
    const s = e.primary_person_id ? statsMap.get(e.primary_person_id) : null
    if (s) s.yellow_card_count++
  }
  for (const e of allReds) {
    const s = e.primary_person_id ? statsMap.get(e.primary_person_id) : null
    if (s) s.red_card_count++
  }

  return statsMap
}

/**
 * Computes total regular-time minutes on pitch for a single player.
 * Injury/stoppage time is ignored: a player entering during added time of any
 * half/period is credited with 1 minute for that period.
 */
async function getPlayerMinutes(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personId: string
): Promise<number> {
  const { data: participations, error: partError } = await supabase
    .from('tbl_Match_Participants')
    .select('match_id, is_starting')
    .eq('role', 'PLAYER')
    .eq('person_id', personId)
  if (partError) throw new Error(`tbl_Match_Participants (minutes): ${partError.message}`)
  if (!participations?.length) return 0

  const allMatchIds = [...new Set(participations.map((p) => p.match_id as string))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipations = participations.filter((p) => nonWalkoverMatchIds.has(p.match_id as string))
  if (!filteredParticipations.length) return 0

  const [subOnRes, subOffRes] = await Promise.all([
    supabase
      .from('tbl_Match_Events')
      .select('match_id, minute, minute_extra')
      .eq('event_type', 'SUBSTITUTION')
      .eq('secondary_person_id', personId),
    supabase
      .from('tbl_Match_Events')
      .select('match_id, minute, minute_extra')
      .eq('event_type', 'SUBSTITUTION')
      .eq('primary_person_id', personId),
  ])
  if (subOnRes.error) throw new Error(`tbl_Match_Events (sub-on): ${subOnRes.error.message}`)
  if (subOffRes.error) throw new Error(`tbl_Match_Events (sub-off): ${subOffRes.error.message}`)

  type SubEntry = { minute: number; extra: number }
  const subOnByMatch = new Map<string, SubEntry>(
    (subOnRes.data ?? []).map((e) => [e.match_id as string, { minute: e.minute as number, extra: (e.minute_extra as number | null) ?? 0 }])
  )
  const subOffByMatch = new Map<string, SubEntry>(
    (subOffRes.data ?? []).map((e) => [e.match_id as string, { minute: e.minute as number, extra: (e.minute_extra as number | null) ?? 0 }])
  )

  const subOnMatchIds = new Set(
    (subOnRes.data ?? [])
      .map((e) => e.match_id as string)
      .filter((matchId) => nonWalkoverMatchIds.has(matchId))
  )
  const playedParticipations = filteredParticipations.filter(
    (p) => p.is_starting || subOnMatchIds.has(p.match_id)
  )
  if (!playedParticipations.length) return 0

  const playedMatchIds = [...new Set(playedParticipations.map((p) => p.match_id))]
  const CHUNK = 80
  const matchResultTypeMap = new Map<string, string | null>()
  for (let i = 0; i < playedMatchIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, result_type')
      .in('id', playedMatchIds.slice(i, i + CHUNK))
    if (error) throw new Error(`tbl_Matches (result_type): ${error.message}`)
    for (const m of data ?? []) matchResultTypeMap.set(m.id as string, m.result_type as string | null)
  }

  let totalMinutes = 0
  for (const p of playedParticipations) {
    const resultType = matchResultTypeMap.get(p.match_id) ?? null
    const hasExtraTime =
      resultType === 'EXTRA_TIME' ||
      resultType === 'EXTRA_TIME_AND_PENALTIES' ||
      resultType === 'GOLDEN_GOAL'
    const matchRegularEnd = hasExtraTime ? 120 : 90

    const isStarter = p.is_starting === true
    const subOn = isStarter ? null : (subOnByMatch.get(p.match_id) ?? null)
    if (!isStarter && !subOn) continue

    const subOff = subOffByMatch.get(p.match_id) ?? null

    const entryMin = isStarter ? 0 : subOn!.minute
    const entryExtra = isStarter ? 0 : subOn!.extra
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0

    // If entering during injury time of a period (minute == period end, extra > 0),
    // shift effectiveEntry back by 1 to give exactly 1 minute for that period remainder.
    const effectiveEntry = entryExtra > 0 ? entryMin - 1 : entryMin
    // If exiting during injury time, cap to the period's regular end.
    const effectiveExit = Math.min(exitExtra > 0 ? exitMin : exitMin, matchRegularEnd)

    totalMinutes += Math.max(0, effectiveExit - effectiveEntry)
  }

  return totalMinutes
}

export async function getAdminPeople(): Promise<AdminPersonListItem[]> {
  const supabase = createServiceRoleClient()

  const { data: people, error: peopleError } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, death_date, is_active, birth_city_id, birth_country_id')

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)
  if (!people?.length) return []

  const cityIds = [...new Set(people.map((p) => p.birth_city_id).filter(Boolean))]
  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]

  // Batch cities to avoid oversized .in() queries that can fail at the fetch layer
  const CITY_CHUNK = 80
  const cityMap = new Map<string, string | null>()
  for (let i = 0; i < cityIds.length; i += CITY_CHUNK) {
    const { data: cityBatch, error: citiesError } = await supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .in('id', cityIds.slice(i, i + CITY_CHUNK))
    if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
    for (const c of cityBatch ?? []) cityMap.set(c.id, c.city_name)
  }

  const { data: countries, error: countriesError } = countryIds.length
    ? await supabase.from('tbl_Countries').select('id, name, fifa_code').in('id', countryIds)
    : { data: [] as { id: string; name: string | null; fifa_code: string | null }[], error: null }
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
  const countryFifaCodeMap = new Map((countries ?? []).map((c) => [c.id, c.fifa_code]))
  const representedCountryDataByPersonId = await getExplicitRepresentedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const coachedCountryDataByPersonId = await getCoachedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const rolesByPersonId = await getRolesByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const roleMatchCountsByPersonId = await getRoleMatchCountsByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const playerIds = people
    .filter((p) => (rolesByPersonId.get(p.id) ?? []).includes('PLAYER'))
    .map((p) => p.id)
  const coachIds = people
    .filter((p) => (rolesByPersonId.get(p.id) ?? []).includes('COACH'))
    .map((p) => p.id)
  const [statsByPersonId, coachResultStatsByPersonId] = await Promise.all([
    getPersonStats(supabase, playerIds),
    getCoachResultStatsByPersonId(supabase, coachIds),
  ])

  return people
    .map((person) => {
      const representedData = representedCountryDataByPersonId.get(person.id) ?? []
      const fallbackName = person.birth_country_id ? (countryMap.get(person.birth_country_id) ?? null) : null
      const fallbackFifaCode = person.birth_country_id ? (countryFifaCodeMap.get(person.birth_country_id) ?? null) : null
      const representedNames = representedData.length ? representedData.map((d) => d.name) : (fallbackName ? [fallbackName] : [])
      const representedFifaCodes = representedData.length ? representedData.map((d) => d.fifaCode) : (fallbackFifaCode ? [fallbackFifaCode] : [])
      const coachedData = coachedCountryDataByPersonId.get(person.id) ?? { names: [], fifaCodes: [] }
      const stats = statsByPersonId.get(person.id)
      const roleMatchCounts = roleMatchCountsByPersonId.get(person.id)
      const coachStats = coachResultStatsByPersonId.get(person.id)
      const coachMatchCount = roleMatchCounts?.coach_match_count ?? 0
      const coachWins = coachStats?.coach_wins ?? 0
      const coachDraws = coachStats?.coach_draws ?? 0

      return {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        nickname: person.nickname,
        birth_date: person.birth_date,
        death_date: person.death_date,
        is_active: person.is_active,
        birth_city_id: person.birth_city_id,
        birth_country_id: person.birth_country_id,
        birth_city_name: person.birth_city_id ? (cityMap.get(person.birth_city_id) ?? null) : null,
        birth_country_name: person.birth_country_id
          ? (countryMap.get(person.birth_country_id) ?? null)
          : null,
        birth_country_fifa_code: person.birth_country_id
          ? (countryFifaCodeMap.get(person.birth_country_id) ?? null)
          : null,
        represented_country_names: representedNames,
        represented_country_fifa_codes: representedFifaCodes,
        coached_country_names: coachedData.names,
        coached_country_fifa_codes: coachedData.fifaCodes,
        roles: rolesByPersonId.get(person.id) ?? [],
        role_labels: mapRolesToLabels(rolesByPersonId.get(person.id) ?? []),
        appearance_count: stats?.appearance_count ?? 0,
        starting_appearance_count: stats?.starting_appearance_count ?? 0,
        sub_on_count: stats?.sub_on_count ?? 0,
        sub_off_count: stats?.sub_off_count ?? 0,
        goal_count: stats?.goal_count ?? 0,
        assist_count: stats?.assist_count ?? 0,
        yellow_card_count: stats?.yellow_card_count ?? 0,
        red_card_count: stats?.red_card_count ?? 0,
        minute_count: stats?.minute_count ?? 0,
        bench_count: stats?.bench_count ?? 0,
        player_match_count: roleMatchCounts?.player_match_count ?? 0,
        coach_match_count: coachMatchCount,
        referee_match_count: roleMatchCounts?.referee_match_count ?? 0,
        coach_wins: coachWins,
        coach_draws: coachDraws,
        coach_losses: coachStats?.coach_losses ?? 0,
        coach_goals_scored: coachStats?.coach_goals_scored ?? 0,
        coach_goals_conceded: coachStats?.coach_goals_conceded ?? 0,
        coach_points_per_match: getCoachPointsPerMatch({
          coachMatchCount,
          coachWins,
          coachDraws,
        }),
      }
    })
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b), 'pl'))
}

export async function getPublicPeople(): Promise<AdminPersonListItem[]> {
  return unstable_cache(
    async () => getAdminPeople(),
    ['public-people'],
    {
      revalidate: 3600,
      tags: ['public-people'],
    }
  )()
}

export async function getAdminPeoplePage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminPersonListItem>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: people, error: peopleError, count } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, death_date, is_active, birth_city_id, birth_country_id', {
      count: 'exact',
    })
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true, nullsFirst: false })
    .order('nickname', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)
  if (!people?.length) return { items: [], total: count ?? 0 }

  const cityIds = [...new Set(people.map((p) => p.birth_city_id).filter(Boolean))]
  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]

  // Batch cities to avoid oversized .in() queries that can fail at the fetch layer
  const CITY_CHUNK = 80
  const cityMap = new Map<string, string | null>()
  for (let i = 0; i < cityIds.length; i += CITY_CHUNK) {
    const { data: cityBatch, error: citiesError } = await supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .in('id', cityIds.slice(i, i + CITY_CHUNK))
    if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
    for (const c of cityBatch ?? []) cityMap.set(c.id, c.city_name)
  }

  const { data: countries, error: countriesError } = countryIds.length
    ? await supabase.from('tbl_Countries').select('id, name, fifa_code').in('id', countryIds)
    : { data: [] as { id: string; name: string | null; fifa_code: string | null }[], error: null }
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
  const countryFifaCodeMap = new Map((countries ?? []).map((c) => [c.id, c.fifa_code]))
  const representedCountryDataByPersonId = await getExplicitRepresentedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const coachedCountryDataByPersonId = await getCoachedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const rolesByPersonId = await getRolesByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const roleMatchCountsByPersonId = await getRoleMatchCountsByPersonId(
    supabase,
    people.map((person) => person.id)
  )

  return {
    items: people.map((person) => {
      const representedData = representedCountryDataByPersonId.get(person.id) ?? []
      const fallbackName = person.birth_country_id ? (countryMap.get(person.birth_country_id) ?? null) : null
      const fallbackFifaCode = person.birth_country_id ? (countryFifaCodeMap.get(person.birth_country_id) ?? null) : null
      const representedNames = representedData.length ? representedData.map((d) => d.name) : (fallbackName ? [fallbackName] : [])
      const representedFifaCodes = representedData.length ? representedData.map((d) => d.fifaCode) : (fallbackFifaCode ? [fallbackFifaCode] : [])
      const coachedData = coachedCountryDataByPersonId.get(person.id) ?? { names: [], fifaCodes: [] }
      const roleMatchCounts = roleMatchCountsByPersonId.get(person.id)

      return {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        nickname: person.nickname,
        birth_date: person.birth_date,
        death_date: person.death_date,
        is_active: person.is_active,
        birth_city_id: person.birth_city_id,
        birth_country_id: person.birth_country_id,
        birth_city_name: person.birth_city_id ? (cityMap.get(person.birth_city_id) ?? null) : null,
        birth_country_name: person.birth_country_id
          ? (countryMap.get(person.birth_country_id) ?? null)
          : null,
        birth_country_fifa_code: person.birth_country_id
          ? (countryFifaCodeMap.get(person.birth_country_id) ?? null)
          : null,
        represented_country_names: representedNames,
        represented_country_fifa_codes: representedFifaCodes,
        coached_country_names: coachedData.names,
        coached_country_fifa_codes: coachedData.fifaCodes,
        roles: rolesByPersonId.get(person.id) ?? [],
        role_labels: mapRolesToLabels(rolesByPersonId.get(person.id) ?? []),
        appearance_count: 0,
        starting_appearance_count: 0,
        sub_on_count: 0,
        sub_off_count: 0,
        goal_count: 0,
        assist_count: 0,
        yellow_card_count: 0,
        red_card_count: 0,
        minute_count: 0,
        bench_count: 0,
        player_match_count: roleMatchCounts?.player_match_count ?? 0,
        coach_match_count: roleMatchCounts?.coach_match_count ?? 0,
        referee_match_count: roleMatchCounts?.referee_match_count ?? 0,
        coach_wins: 0,
        coach_draws: 0,
        coach_losses: 0,
        coach_goals_scored: 0,
        coach_goals_conceded: 0,
        coach_points_per_match: 0,
      }
    }),
    total: count ?? 0,
  }
}

export async function getPublicPersonDetails(id: string): Promise<AdminPersonDetails | null> {
  return unstable_cache(
    async () => getAdminPersonDetails(id),
    ['public-person-details', id],
    {
      revalidate: 3600,
      tags: ['public-people', `public-person:${id}`],
    }
  )()
}

export async function getAdminPersonDetails(id: string): Promise<AdminPersonDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: person, error: personError } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, death_date, is_active, birth_city_id, birth_country_id')
    .eq('id', id)
    .maybeSingle()

  if (personError) throw new Error(`tbl_People: ${personError.message}`)
  if (!person) return null

  const [{ data: city, error: cityError }, { data: country, error: countryError }] = await Promise.all([
    person.birth_city_id
      ? supabase
          .from('tbl_Cities')
          .select('city_name')
          .eq('id', person.birth_city_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { city_name: string | null } | null, error: null }),
    person.birth_country_id
      ? supabase
          .from('tbl_Countries')
          .select('name, fifa_code')
          .eq('id', person.birth_country_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string | null; fifa_code: string | null } | null, error: null }),
  ])

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)
  if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)

  const representedCountryDataByPersonId = await getExplicitRepresentedCountryDataByPersonId(supabase, [person.id])
  const representedCountryIdsByPersonId = await getExplicitRepresentedCountryIdsByPersonId(supabase, [person.id])
  const coachedCountryDataByPersonId = await getCoachedCountryDataByPersonId(supabase, [person.id])
  const rolesByPersonId = await getRolesByPersonId(supabase, [person.id])
  const roleMatchCountsByPersonId = await getRoleMatchCountsByPersonId(supabase, [person.id])
  const explicitRepresentedData = representedCountryDataByPersonId.get(person.id) ?? []
  const explicitRepresentedIds = representedCountryIdsByPersonId.get(person.id) ?? []
  const coachedData = coachedCountryDataByPersonId.get(person.id) ?? { names: [], fifaCodes: [] }
  const fallbackRepresented = country?.name ?? null
  const fallbackFifaCode = country?.fifa_code ?? null
  const roles = rolesByPersonId.get(person.id) ?? []
  const representedNames = explicitRepresentedData.length
    ? explicitRepresentedData.map((d) => d.name)
    : (fallbackRepresented ? [fallbackRepresented] : [])
  const representedFifaCodes = explicitRepresentedData.length
    ? explicitRepresentedData.map((d) => d.fifaCode)
    : (fallbackFifaCode ? [fallbackFifaCode] : [])

  const isPlayer = roles.includes('PLAYER')
  const isCoach = roles.includes('COACH')
  const [statsMap, minuteCount, coachResultStatsByPersonId] = await Promise.all([
    isPlayer ? getPersonStats(supabase, [person.id]) : Promise.resolve(new Map()),
    isPlayer ? getPlayerMinutes(supabase, person.id) : Promise.resolve(0),
    isCoach ? getCoachResultStatsByPersonId(supabase, [person.id]) : Promise.resolve(new Map<string, CoachResultStats>()),
  ])
  const stats = statsMap.get(person.id)
  const roleMatchCounts = roleMatchCountsByPersonId.get(person.id)
  const coachStats = coachResultStatsByPersonId.get(person.id)
  const coachMatchCount = roleMatchCounts?.coach_match_count ?? 0
  const coachWins = coachStats?.coach_wins ?? 0
  const coachDraws = coachStats?.coach_draws ?? 0

  return {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    nickname: person.nickname,
    birth_date: person.birth_date,
    death_date: person.death_date,
    is_active: person.is_active,
    birth_city_id: person.birth_city_id,
    birth_country_id: person.birth_country_id,
    birth_city_name: city?.city_name ?? null,
    birth_country_name: country?.name ?? null,
    birth_country_fifa_code: country?.fifa_code ?? null,
    represented_country_ids: explicitRepresentedIds,
    represented_country_names: representedNames,
    represented_country_fifa_codes: representedFifaCodes,
    coached_country_names: coachedData.names,
    coached_country_fifa_codes: coachedData.fifaCodes,
    roles,
    role_labels: mapRolesToLabels(roles),
    appearance_count: stats?.appearance_count ?? 0,
    starting_appearance_count: stats?.starting_appearance_count ?? 0,
    sub_on_count: stats?.sub_on_count ?? 0,
    sub_off_count: stats?.sub_off_count ?? 0,
    goal_count: stats?.goal_count ?? 0,
    assist_count: stats?.assist_count ?? 0,
    yellow_card_count: stats?.yellow_card_count ?? 0,
    red_card_count: stats?.red_card_count ?? 0,
    minute_count: minuteCount,
    bench_count: stats?.bench_count ?? 0,
    player_match_count: roleMatchCounts?.player_match_count ?? 0,
    coach_match_count: coachMatchCount,
    referee_match_count: roleMatchCounts?.referee_match_count ?? 0,
    coach_wins: coachWins,
    coach_draws: coachDraws,
    coach_losses: coachStats?.coach_losses ?? 0,
    coach_goals_scored: coachStats?.coach_goals_scored ?? 0,
    coach_goals_conceded: coachStats?.coach_goals_conceded ?? 0,
    coach_points_per_match: getCoachPointsPerMatch({
      coachMatchCount,
      coachWins,
      coachDraws,
    }),
  }
}
