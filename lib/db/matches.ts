import { createServiceRoleClient } from '@/lib/supabase/server'

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

  // 2. Competitions + teams (parallel)
  const competitionIds = [...new Set(matches.map((m) => m.competition_id))]
  const teamIds = [
    ...new Set([
      ...matches.map((m) => m.home_team_id),
      ...matches.map((m) => m.away_team_id),
    ]),
  ]

  const [
    { data: competitions, error: compError },
    { data: teams, error: teamError },
  ] = await Promise.all([
    supabase
      .from('tbl_Competitions')
      .select('id, name')
      .in('id', competitionIds),
    supabase
      .from('tbl_Teams')
      .select('id, country_id, club_id')
      .in('id', teamIds),
  ])

  if (compError) throw new Error(`tbl_Competitions: ${compError.message}`)
  if (teamError) throw new Error(`tbl_Teams: ${teamError.message}`)

  // 3. Countries + clubs (parallel, skip empty sets)
  const countryIds = [
    ...new Set(teams?.map((t) => t.country_id).filter(Boolean)),
  ]
  const clubIds = [...new Set(teams?.map((t) => t.club_id).filter(Boolean))]

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

  // 4. Lookup maps
  const compMap = new Map(competitions?.map((c) => [c.id, c.name]) ?? [])
  const countryMap = new Map(countries?.map((c) => [c.id, c.name]) ?? [])
  const clubMap = new Map(clubs?.map((c) => [c.id, c.name]) ?? [])
  const teamNameMap = new Map(
    teams?.map((t) => [
      t.id,
      t.country_id
        ? (countryMap.get(t.country_id) ?? '—')
        : (clubMap.get(t.club_id) ?? '—'),
    ]) ?? []
  )

  // 5. Assemble
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
