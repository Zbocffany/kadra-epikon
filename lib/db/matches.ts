import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

export type MatchStatus =
  | 'SCHEDULED'
  | 'FINISHED'
  | 'ABANDONED'
  | 'CANCELLED'

export type EditorialStatus =
  | 'DRAFT'
  | 'PARTIAL'
  | 'COMPLETE'
  | 'VERIFIED'

export type AdminMatch = {
  id: string
  match_date: string
  match_time: string | null
  match_status: MatchStatus
  editorial_status: EditorialStatus
  competition_name: string
  home_team_name: string
  away_team_name: string
}

export type AdminMatchDetails = AdminMatch & {
  competition_id: string
  home_team_id: string
  away_team_id: string
  match_city_id: string | null
  match_stadium_id: string | null
}

export type AdminCompetitionOption = {
  id: string
  name: string
}

export type AdminTeamOption = {
  id: string
  label: string
}

export type AdminCityOption = {
  id: string
  name: string
}

export type AdminStadiumOption = {
  id: string
  label: string
  stadium_city_id: string | null
}

type MatchListRow = {
  id: string
  match_date: string
  match_time: string | null
  match_status: MatchStatus
  editorial_status: EditorialStatus
  competition_id: string
  home_team_id: string
  away_team_id: string
}

async function getTeamDisplayMap(teamIds: string[]): Promise<Map<string, string>> {
  const supabase = createServiceRoleClient()

  if (!teamIds.length) {
    return new Map()
  }

  const { data: teams, error: teamError } = await supabase
    .from('tbl_Teams')
    .select('id, country_id, club_id')
    .in('id', teamIds)

  if (teamError) throw new Error(`tbl_Teams: ${teamError.message}`)

  const countryIds = [...new Set((teams ?? []).map((t) => t.country_id).filter(Boolean))]
  const clubIds = [...new Set((teams ?? []).map((t) => t.club_id).filter(Boolean))]

  const [
    { data: countries, error: countryError },
    { data: clubs, error: clubError },
  ] = await Promise.all([
    countryIds.length
      ? supabase.from('tbl_Countries').select('id, name').in('id', countryIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    clubIds.length
      ? supabase.from('tbl_Clubs').select('id, name').in('id', clubIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ])

  if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
  if (clubError) throw new Error(`tbl_Clubs: ${clubError.message}`)

  const countryMap = new Map(countries?.map((c) => [c.id, c.name]) ?? [])
  const clubMap = new Map(clubs?.map((c) => [c.id, c.name]) ?? [])

  return new Map(
    (teams ?? []).map((t) => [
      t.id,
      t.country_id
        ? (countryMap.get(t.country_id) ?? '—')
        : (clubMap.get(t.club_id) ?? '—'),
    ])
  )
}

/**
 * Returns all matches for the admin list, sorted by match_date descending.
 *
 * Data is assembled from three separate fetches to avoid PostgREST
 * FK-ambiguity issues (two FK columns from tbl_Matches → tbl_Teams).
 * Score is intentionally omitted: derive it from tbl_Match_Events if needed.
 */
export async function getAdminMatches(): Promise<AdminMatch[]> {
  const supabase = createServiceRoleClient()

  // 1. Matches
  const { data: matches, error: matchError } = await supabase
    .from('tbl_Matches')
    .select(
      'id, match_date, match_time, match_status, editorial_status, competition_id, home_team_id, away_team_id'
    )
    .order('match_date', { ascending: false })
    .order('match_time', { ascending: false })
    .order('id', { ascending: false })

  if (matchError) throw new Error(`tbl_Matches: ${matchError.message}`)
  if (!matches?.length) return []

  return mapAdminMatches(supabase, matches)
}

export async function getAdminMatchesPage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminMatch>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: matches, error: matchError, count } = await supabase
    .from('tbl_Matches')
    .select(
      'id, match_date, match_time, match_status, editorial_status, competition_id, home_team_id, away_team_id',
      { count: 'exact' }
    )
    .order('match_date', { ascending: false })
    .order('match_time', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (matchError) throw new Error(`tbl_Matches: ${matchError.message}`)
  if (!matches?.length) {
    return { items: [], total: count ?? 0 }
  }

  const items = await mapAdminMatches(supabase, matches)
  return { items, total: count ?? 0 }
}

async function mapAdminMatches(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matches: MatchListRow[]
): Promise<AdminMatch[]> {

  // 2. Competitions + teams (parallel)
  const competitionIds = [...new Set(matches.map((m) => m.competition_id))]
  const teamIds = [
    ...new Set([
      ...matches.map((m) => m.home_team_id),
      ...matches.map((m) => m.away_team_id),
    ]),
  ]

  const { data: competitions, error: compError } = await supabase
    .from('tbl_Competitions')
    .select('id, name')
    .in('id', competitionIds)

  if (compError) throw new Error(`tbl_Competitions: ${compError.message}`)

  const teamNameMap = await getTeamDisplayMap(teamIds)

  // 3. Lookup maps
  const compMap = new Map(competitions?.map((c) => [c.id, c.name]) ?? [])

  // 4. Assemble
  return matches.map((m) => ({
    id: m.id,
    match_date: m.match_date,
    match_time: m.match_time ?? null,
    match_status: m.match_status,
    editorial_status: m.editorial_status,
    competition_name: compMap.get(m.competition_id) ?? '—',
    home_team_name: teamNameMap.get(m.home_team_id) ?? '—',
    away_team_name: teamNameMap.get(m.away_team_id) ?? '—',
  }))
}

export async function getAdminMatchDetails(id: string): Promise<AdminMatchDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: match, error: matchError } = await supabase
    .from('tbl_Matches')
    .select(
      'id, match_date, match_time, match_status, editorial_status, competition_id, home_team_id, away_team_id, match_city_id, match_stadium_id'
    )
    .eq('id', id)
    .maybeSingle()

  if (matchError) throw new Error(`tbl_Matches: ${matchError.message}`)
  if (!match) return null

  const [{ data: competition, error: competitionError }, teamNameMap] = await Promise.all([
    supabase
      .from('tbl_Competitions')
      .select('id, name')
      .eq('id', match.competition_id)
      .maybeSingle(),
    getTeamDisplayMap([match.home_team_id, match.away_team_id]),
  ])

  if (competitionError) throw new Error(`tbl_Competitions: ${competitionError.message}`)

  return {
    id: match.id,
    match_date: match.match_date,
    match_time: match.match_time ?? null,
    match_status: match.match_status,
    editorial_status: match.editorial_status,
    competition_name: competition?.name ?? '—',
    home_team_name: teamNameMap.get(match.home_team_id) ?? '—',
    away_team_name: teamNameMap.get(match.away_team_id) ?? '—',
    competition_id: match.competition_id,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    match_city_id: match.match_city_id ?? null,
    match_stadium_id: match.match_stadium_id ?? null,
  }
}

export async function getAdminMatchCreateOptions(): Promise<{
  competitions: AdminCompetitionOption[]
  teams: AdminTeamOption[]
  cities: AdminCityOption[]
  stadiums: AdminStadiumOption[]
}> {
  const supabase = createServiceRoleClient()

  const [
    { data: competitions, error: competitionsError },
    { data: teams, error: teamsError },
    { data: cities, error: citiesError },
    { data: stadiums, error: stadiumsError },
  ] = await Promise.all([
    supabase
      .from('tbl_Competitions')
      .select('id, name')
      .order('name', { ascending: true }),
    supabase.from('tbl_Teams').select('id').order('id', { ascending: true }),
    supabase.from('tbl_Cities').select('id, city_name').order('city_name', { ascending: true }),
    supabase.from('tbl_Stadiums').select('id, name, stadium_city_id').order('name', { ascending: true }),
  ])

  if (competitionsError) throw new Error(`tbl_Competitions: ${competitionsError.message}`)
  if (teamsError) throw new Error(`tbl_Teams: ${teamsError.message}`)
  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (stadiumsError) throw new Error(`tbl_Stadiums: ${stadiumsError.message}`)

  const cityNameMap = new Map((cities ?? []).map((city) => [city.id, city.city_name]))

  const teamIds = (teams ?? []).map((t) => t.id)
  const teamDisplayMap = await getTeamDisplayMap(teamIds)

  const teamOptions = teamIds
    .map((id) => ({ id, label: teamDisplayMap.get(id) ?? '—' }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))

  const cityOptions = (cities ?? []).map((city) => ({
    id: city.id,
    name: city.city_name ?? '—',
  }))

  const stadiumOptions = (stadiums ?? []).map((stadium) => {
    const cityName = stadium.stadium_city_id
      ? cityNameMap.get(stadium.stadium_city_id)
      : null

    const label = cityName
      ? `${stadium.name ?? '—'} (${cityName})`
      : (stadium.name ?? '—')

    return {
      id: stadium.id,
      label,
      stadium_city_id: stadium.stadium_city_id ?? null,
    }
  })

  return {
    competitions: competitions ?? [],
    teams: teamOptions,
    cities: cityOptions,
    stadiums: stadiumOptions,
  }
}
