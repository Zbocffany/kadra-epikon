import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

export type AdminCountry = {
  id: string
  name: string
  fifa_code: string | null
  federation_short_name: string | null
  matches: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
}

export type AdminCountryDetails = {
  id: string
  name: string
  fifa_code: string | null
  federation_id: string | null
  federation_short_name: string | null
}

export type AdminFederation = {
  id: string
  short_name: string
}

type CountryVsPolandStat = {
  matches: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
}

async function getCountryVsPolandStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
  countryIds: string[]
): Promise<Map<string, CountryVsPolandStat>> {
  const empty = new Map<string, CountryVsPolandStat>()
  if (!countryIds.length) return empty

  const { data: polandCountry } = await supabase
    .from('tbl_Countries')
    .select('id')
    .ilike('name', 'Polska')
    .maybeSingle()
  if (!polandCountry) return empty

  const { data: polandTeam } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('country_id', polandCountry.id)
    .is('club_id', null)
    .maybeSingle()
  if (!polandTeam) return empty

  const polandTeamId = (polandTeam as { id: string }).id

  const { data: opponentTeams } = await supabase
    .from('tbl_Teams')
    .select('id, country_id')
    .in('country_id', countryIds)
    .is('club_id', null)
  if (!opponentTeams?.length) return empty

  const teamToCountry = new Map(opponentTeams.map((t) => [t.id as string, t.country_id as string]))
  const opponentTeamIds = opponentTeams.map((t) => t.id as string)

  const [{ data: homeMatches }, { data: awayMatches }] = await Promise.all([
    supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id')
      .eq('match_status', 'FINISHED')
      .in('editorial_status', ['COMPLETE', 'VERIFIED'])
      .eq('home_team_id', polandTeamId)
      .in('away_team_id', opponentTeamIds),
    supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id')
      .eq('match_status', 'FINISHED')
      .in('editorial_status', ['COMPLETE', 'VERIFIED'])
      .eq('away_team_id', polandTeamId)
      .in('home_team_id', opponentTeamIds),
  ])

  const allMatches = [...(homeMatches ?? []), ...(awayMatches ?? [])]
  if (!allMatches.length) return empty

  const matchIds = allMatches.map((m) => m.id as string)

  const { data: events } = await supabase
    .from('tbl_Match_Events')
    .select('match_id, team_id, event_type')
    .in('match_id', matchIds)
    .in('event_type', ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'])

  const eventsByMatch = new Map<string, Array<{ team_id: string | null; event_type: string }>>()
  for (const e of events ?? []) {
    const arr = eventsByMatch.get(e.match_id as string) ?? []
    arr.push({ team_id: e.team_id as string | null, event_type: e.event_type as string })
    eventsByMatch.set(e.match_id as string, arr)
  }

  const result = new Map<string, CountryVsPolandStat>()

  for (const match of allMatches) {
    const isPolandHome = (match.home_team_id as string) === polandTeamId
    const opponentTeamId = isPolandHome ? (match.away_team_id as string) : (match.home_team_id as string)
    const countryId = teamToCountry.get(opponentTeamId)
    if (!countryId) continue

    let homeGoals = 0
    let awayGoals = 0
    for (const e of eventsByMatch.get(match.id as string) ?? []) {
      if (e.team_id === match.home_team_id) homeGoals++
      else if (e.team_id === match.away_team_id) awayGoals++
    }

    const polandGoals = isPolandHome ? homeGoals : awayGoals
    const opponentGoals = isPolandHome ? awayGoals : homeGoals

    const stat = result.get(countryId) ?? { matches: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 }
    stat.matches++
    stat.goals_for += polandGoals
    stat.goals_against += opponentGoals
    if (polandGoals > opponentGoals) stat.wins++
    else if (polandGoals === opponentGoals) stat.draws++
    else stat.losses++
    result.set(countryId, stat)
  }

  return result
}

export async function getAdminCountries(): Promise<AdminCountry[]> {
  const supabase = createServiceRoleClient()

  const { data: countries, error: countriesError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code, federation_id')
    .order('name', { ascending: true })

  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
  if (!countries?.length) return []

  const federationIds = [
    ...new Set(countries.map((c) => c.federation_id).filter(Boolean)),
  ]

  let federationMap = new Map<string, string>()

  if (federationIds.length) {
    const { data: federations, error: federationError } = await supabase
      .from('tbl_Federations')
      .select('id, short_name')
      .in('id', federationIds)

    if (federationError) {
      throw new Error(`tbl_Federations: ${federationError.message}`)
    }

    federationMap = new Map((federations ?? []).map((f) => [f.id, f.short_name]))
  }

  const countryIds = countries.map((c) => c.id)
  const statsMap = await getCountryVsPolandStats(supabase, countryIds)

  return countries.map((c) => {
    const s = statsMap.get(c.id)
    return {
      id: c.id,
      name: c.name,
      fifa_code: c.fifa_code,
      federation_short_name: c.federation_id ? (federationMap.get(c.federation_id) ?? null) : null,
      matches: s?.matches ?? 0,
      wins: s?.wins ?? 0,
      draws: s?.draws ?? 0,
      losses: s?.losses ?? 0,
      goals_for: s?.goals_for ?? 0,
      goals_against: s?.goals_against ?? 0,
    }
  })
}

export async function getAdminCountriesPage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminCountry>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: countries, error: countriesError, count } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code, federation_id', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to)

  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
  if (!countries?.length) return { items: [], total: count ?? 0 }

  const federationIds = [...new Set(countries.map((c) => c.federation_id).filter(Boolean))]

  let federationMap = new Map<string, string>()

  if (federationIds.length) {
    const { data: federations, error: federationError } = await supabase
      .from('tbl_Federations')
      .select('id, short_name')
      .in('id', federationIds)

    if (federationError) throw new Error(`tbl_Federations: ${federationError.message}`)
    federationMap = new Map((federations ?? []).map((f) => [f.id, f.short_name]))
  }

  return {
    items: countries.map((c) => ({
      id: c.id,
      name: c.name,
      fifa_code: c.fifa_code,
      federation_short_name: c.federation_id ? (federationMap.get(c.federation_id) ?? null) : null,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
    })),
    total: count ?? 0,
  }
}

export async function getAdminFederations(): Promise<AdminFederation[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Federations')
    .select('id, short_name')
    .order('short_name', { ascending: true })

  if (error) throw new Error(`tbl_Federations: ${error.message}`)
  return data ?? []
}

export async function getAdminCountryDetails(
  id: string
): Promise<AdminCountryDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: country, error: countryError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code, federation_id')
    .eq('id', id)
    .maybeSingle()

  if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
  if (!country) return null

  let federationShortName: string | null = null

  if (country.federation_id) {
    const { data: federation, error: federationError } = await supabase
      .from('tbl_Federations')
      .select('short_name')
      .eq('id', country.federation_id)
      .maybeSingle()

    if (federationError) {
      throw new Error(`tbl_Federations: ${federationError.message}`)
    }

    federationShortName = federation?.short_name ?? null
  }

  return {
    id: country.id,
    name: country.name,
    fifa_code: country.fifa_code,
    federation_id: country.federation_id,
    federation_short_name: federationShortName,
  }
}

export const COUNTRY_HISTORY_EVENT_TYPES = [
  { value: 'FOUNDED',      label: 'Założenie / Początek' },
  { value: 'DISSOLVED',    label: 'Rozwiązanie / Koniec' },
  { value: 'NAME_CHANGED', label: 'Zmiana nazwy' },
  { value: 'INDEPENDENCE', label: 'Niepodległość' },
  { value: 'UNIFICATION',  label: 'Zjednoczenie' },
  { value: 'PARTITION',    label: 'Podział' },
  { value: 'FIFA_JOIN',    label: 'Przystąpienie do FIFA' },
  { value: 'FIFA_LEAVE',   label: 'Wyjście / wykluczenie z FIFA' },
  { value: 'OTHER',        label: 'Inne' },
] as const

export type CountryHistoryEventType = typeof COUNTRY_HISTORY_EVENT_TYPES[number]['value']

export type AdminCountryHistoryEvent = {
  id: string
  event_date: string | null
  event_date_precision: 'YEAR' | 'MONTH' | 'DAY' | null
  title: string | null
  description: string | null
  event_type: CountryHistoryEventType | null
  event_order: number | null
}

export async function getCountryHistory(
  countryId: string
): Promise<AdminCountryHistoryEvent[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Country_History')
    .select('id, event_date, event_date_precision, title, description, event_type, event_order')
    .eq('country_id', countryId)
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('event_order', { ascending: false, nullsFirst: false })

  if (error) throw new Error(`tbl_Country_History: ${error.message}`)
  return data ?? []
}

export type AdminSuccessionRow = {
  succession_id: string
  precountry_id: string
  precountry_name: string
  precountry_fifa_code: string | null
  postcountry_id: string
  postcountry_name: string
  postcountry_fifa_code: string | null
  source_event_id: string | null
  effective_date: string | null
}

export async function getCountrySuccessions(
  countryId: string
): Promise<AdminSuccessionRow[]> {
  const supabase = createServiceRoleClient()

  const [{ data: asPreRows, error: preError }, { data: asPostRows, error: postError }] =
    await Promise.all([
      supabase
        .from('tbl_Successions')
        .select('id, precountry_id, postcountry_id, source_event_id, effective_date')
        .eq('precountry_id', countryId),
      supabase
        .from('tbl_Successions')
        .select('id, precountry_id, postcountry_id, source_event_id, effective_date')
        .eq('postcountry_id', countryId),
    ])

  if (preError) throw new Error(`tbl_Successions: ${preError.message}`)
  if (postError) throw new Error(`tbl_Successions: ${postError.message}`)

  const allRows = [...(asPreRows ?? []), ...(asPostRows ?? [])]
  if (allRows.length === 0) return []

  const countryIds = [
    ...new Set(allRows.flatMap((r) => [r.precountry_id, r.postcountry_id]).filter(Boolean)),
  ] as string[]

  const { data: countries, error: countriesError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code')
    .in('id', countryIds)

  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const countryMap = new Map(
    (countries ?? []).map((c) => [
      c.id,
      {
        name: c.name ?? '—',
        fifa_code: c.fifa_code ?? null,
      },
    ])
  )

  return allRows.map((row) => ({
    succession_id: row.id,
    precountry_id: row.precountry_id,
    precountry_name: countryMap.get(row.precountry_id)?.name ?? '—',
    precountry_fifa_code: countryMap.get(row.precountry_id)?.fifa_code ?? null,
    postcountry_id: row.postcountry_id,
    postcountry_name: countryMap.get(row.postcountry_id)?.name ?? '—',
    postcountry_fifa_code: countryMap.get(row.postcountry_id)?.fifa_code ?? null,
    source_event_id: row.source_event_id,
    effective_date: row.effective_date,
  }))
}
