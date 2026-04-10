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
  roles: AdminPersonRole[]
  role_labels: string[]
  appearance_count: number
  goal_count: number
  assist_count: number
  yellow_card_count: number
  red_card_count: number
  bench_count: number
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
  if (fullName) return fullName
  if (nick) return nick
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

type PersonStatRow = { appearance_count: number; goal_count: number; assist_count: number; yellow_card_count: number; red_card_count: number; bench_count: number }

async function getPersonStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, PersonStatRow>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80

  type ParticipantRow = { person_id: string; match_id: string; is_starting: boolean | null }
  const allParticipants: ParticipantRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Participants')
      .select('person_id, match_id, is_starting')
      .eq('role', 'PLAYER')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
    allParticipants.push(...((data ?? []) as ParticipantRow[]))
  }

  if (!allParticipants.length) return new Map()

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]

  type SubEvent = { match_id: string; secondary_person_id: string }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < allMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Events')
      .select('match_id, secondary_person_id')
      .eq('event_type', 'SUBSTITUTION')
      .in('match_id', allMatchIds.slice(i, i + CHUNK_SIZE))
      .not('secondary_person_id', 'is', null)
    if (error) throw new Error(`tbl_Match_Events (substitutions): ${error.message}`)
    allSubEvents.push(...((data ?? []) as SubEvent[]))
  }

  const subEnteredSet = new Set(allSubEvents.map((e) => `${e.match_id}:${e.secondary_person_id}`))
  const playedParticipants = allParticipants.filter(
    (p) => p.is_starting || subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )

  const benchParticipants = allParticipants.filter(
    (p) => !p.is_starting && !subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )
  const benchMap = new Map<string, number>()
  for (const p of benchParticipants) {
    benchMap.set(p.person_id, (benchMap.get(p.person_id) ?? 0) + 1)
  }

  const playedMatchIds = [...new Set(playedParticipants.map((p) => p.match_id))]
  const playedPersonIds = new Set(playedParticipants.map((p) => p.person_id))

  const appearanceMap = new Map<string, number>()
  for (const p of playedParticipants) {
    appearanceMap.set(p.person_id, (appearanceMap.get(p.person_id) ?? 0) + 1)
  }

  type PrimaryEvent = { primary_person_id: string }
  type SecondaryEvent = { secondary_person_id: string }

  const allGoals: PrimaryEvent[] = []
  const allAssists: SecondaryEvent[] = []
  const allYellows: PrimaryEvent[] = []
  const allReds: PrimaryEvent[] = []

  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const batch = playedMatchIds.slice(i, i + CHUNK_SIZE)
    const [goalsRes, assistsRes, yellowsRes, redsRes] = await Promise.all([
      supabase.from('tbl_Match_Events').select('primary_person_id').in('event_type', ['GOAL', 'PENALTY_GOAL']).in('match_id', batch).not('primary_person_id', 'is', null),
      supabase.from('tbl_Match_Events').select('secondary_person_id').in('event_type', ['GOAL', 'OWN_GOAL']).in('match_id', batch).not('secondary_person_id', 'is', null),
      supabase.from('tbl_Match_Events').select('primary_person_id').eq('event_type', 'YELLOW_CARD').in('match_id', batch).not('primary_person_id', 'is', null),
      supabase.from('tbl_Match_Events').select('primary_person_id').in('event_type', ['RED_CARD', 'SECOND_YELLOW_CARD']).in('match_id', batch).not('primary_person_id', 'is', null),
    ])
    if (goalsRes.error) throw new Error(`tbl_Match_Events (goals): ${goalsRes.error.message}`)
    if (assistsRes.error) throw new Error(`tbl_Match_Events (assists): ${assistsRes.error.message}`)
    if (yellowsRes.error) throw new Error(`tbl_Match_Events (yellow cards): ${yellowsRes.error.message}`)
    if (redsRes.error) throw new Error(`tbl_Match_Events (red cards): ${redsRes.error.message}`)
    allGoals.push(...((goalsRes.data ?? []) as PrimaryEvent[]))
    allAssists.push(...((assistsRes.data ?? []) as SecondaryEvent[]))
    allYellows.push(...((yellowsRes.data ?? []) as PrimaryEvent[]))
    allReds.push(...((redsRes.data ?? []) as PrimaryEvent[]))
  }

  const statsMap = new Map<string, PersonStatRow>()
  const allPersonIds = new Set([...playedPersonIds, ...benchParticipants.map((p) => p.person_id)])
  for (const personId of allPersonIds) {
    statsMap.set(personId, { appearance_count: appearanceMap.get(personId) ?? 0, goal_count: 0, assist_count: 0, yellow_card_count: 0, red_card_count: 0, bench_count: benchMap.get(personId) ?? 0 })
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

export async function getAdminPeople(): Promise<AdminPersonListItem[]> {
  const supabase = createServiceRoleClient()

  const { data: people, error: peopleError } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, death_date, is_active, birth_city_id, birth_country_id')

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)
  if (!people?.length) return []

  const cityIds = [...new Set(people.map((p) => p.birth_city_id).filter(Boolean))]
  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]

  const [{ data: cities, error: citiesError }, { data: countries, error: countriesError }] =
    await Promise.all([
      cityIds.length
        ? supabase.from('tbl_Cities').select('id, city_name').in('id', cityIds)
        : Promise.resolve({ data: [] as { id: string; city_name: string | null }[], error: null }),
      countryIds.length
        ? supabase.from('tbl_Countries').select('id, name, fifa_code').in('id', countryIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; fifa_code: string | null }[], error: null }),
    ])

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))
  const countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
  const countryFifaCodeMap = new Map((countries ?? []).map((c) => [c.id, c.fifa_code]))
  const representedCountryDataByPersonId = await getExplicitRepresentedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const rolesByPersonId = await getRolesByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const playerIds = people
    .filter((p) => (rolesByPersonId.get(p.id) ?? []).includes('PLAYER'))
    .map((p) => p.id)
  const statsByPersonId = await getPersonStats(supabase, playerIds)

  return people
    .map((person) => {
      const representedData = representedCountryDataByPersonId.get(person.id) ?? []
      const fallbackName = person.birth_country_id ? (countryMap.get(person.birth_country_id) ?? null) : null
      const fallbackFifaCode = person.birth_country_id ? (countryFifaCodeMap.get(person.birth_country_id) ?? null) : null
      const representedNames = representedData.length ? representedData.map((d) => d.name) : (fallbackName ? [fallbackName] : [])
      const representedFifaCodes = representedData.length ? representedData.map((d) => d.fifaCode) : (fallbackFifaCode ? [fallbackFifaCode] : [])
      const stats = statsByPersonId.get(person.id)

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
        roles: rolesByPersonId.get(person.id) ?? [],
        role_labels: mapRolesToLabels(rolesByPersonId.get(person.id) ?? []),
        appearance_count: stats?.appearance_count ?? 0,
        goal_count: stats?.goal_count ?? 0,
        assist_count: stats?.assist_count ?? 0,
        yellow_card_count: stats?.yellow_card_count ?? 0,
        red_card_count: stats?.red_card_count ?? 0,
        bench_count: stats?.bench_count ?? 0,
      }
    })
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b), 'pl'))
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

  const [{ data: cities, error: citiesError }, { data: countries, error: countriesError }] =
    await Promise.all([
      cityIds.length
        ? supabase.from('tbl_Cities').select('id, city_name').in('id', cityIds)
        : Promise.resolve({ data: [] as { id: string; city_name: string | null }[], error: null }),
      countryIds.length
        ? supabase.from('tbl_Countries').select('id, name, fifa_code').in('id', countryIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; fifa_code: string | null }[], error: null }),
    ])

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))
  const countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
  const countryFifaCodeMap = new Map((countries ?? []).map((c) => [c.id, c.fifa_code]))
  const representedCountryDataByPersonId = await getExplicitRepresentedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const rolesByPersonId = await getRolesByPersonId(
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
        roles: rolesByPersonId.get(person.id) ?? [],
        role_labels: mapRolesToLabels(rolesByPersonId.get(person.id) ?? []),
        appearance_count: 0,
        goal_count: 0,
        assist_count: 0,
        yellow_card_count: 0,
        red_card_count: 0,
        bench_count: 0,
      }
    }),
    total: count ?? 0,
  }
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
  const rolesByPersonId = await getRolesByPersonId(supabase, [person.id])
  const explicitRepresentedData = representedCountryDataByPersonId.get(person.id) ?? []
  const explicitRepresentedIds = representedCountryIdsByPersonId.get(person.id) ?? []
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
  const statsMap = isPlayer ? await getPersonStats(supabase, [person.id]) : new Map()
  const stats = statsMap.get(person.id)

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
    roles,
    role_labels: mapRolesToLabels(roles),
    appearance_count: stats?.appearance_count ?? 0,
    goal_count: stats?.goal_count ?? 0,
    assist_count: stats?.assist_count ?? 0,
    yellow_card_count: stats?.yellow_card_count ?? 0,
    red_card_count: stats?.red_card_count ?? 0,
    bench_count: stats?.bench_count ?? 0,
  }
}
