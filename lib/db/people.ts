import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/db/pagination'
import { getPublicCacheKey } from '@/lib/db/publicCache'
import {
  loadCityCountryPeriodsMap,
  loadCountryInfoMap,
  resolveCityCountry,
  buildCityCountryTimeline,
  EMPTY_RESOLVED_CITY_COUNTRY,
  type CityCountryTimelineEntry,
} from '@/lib/db/cityCountryResolver'

type CityCountryPeriod = {
  city_id: string
  country_id: string
  valid_from: string | null
  valid_to: string | null
}

type MatchScoreColumns = {
  home_team_id: string
  away_team_id: string
  home_goals: number
  away_goals: number
  home_shootout_goals: number
  away_shootout_goals: number
}

function getTeamScoreFromMatch(match: MatchScoreColumns, teamId: string): {
  goals: number
  shootoutGoals: number
} {
  if (teamId === match.home_team_id) {
    return { goals: match.home_goals, shootoutGoals: match.home_shootout_goals }
  }
  if (teamId === match.away_team_id) {
    return { goals: match.away_goals, shootoutGoals: match.away_shootout_goals }
  }
  return { goals: 0, shootoutGoals: 0 }
}

export type AdminPersonRole = 'PLAYER' | 'COACH' | 'REFEREE'

export type CoachCompetitionFilterKey = 'WORLD_CUP' | 'EURO' | 'NATIONS_LEAGUE' | 'FRIENDLY' | 'OTHER'
export type CoachStageFilterKey = 'TOURNAMENT' | 'QUALIFIERS' | 'PLAYOFFS'

export type CoachPolandFilterMatch = {
  match_id: string
  match_date: string
  match_time: string | null
  match_status: string | null
  result_type: string | null
  walkover_winner_team_id: string | null
  editorial_status: string
  competition_key: CoachCompetitionFilterKey
  competition_name: string
  stage_key: CoachStageFilterKey
  match_level_name: string | null
  home_team_name: string
  away_team_name: string
  home_team_fifa_code: string | null
  away_team_fifa_code: string | null
  coach_team_id: string | null
  coach_team_fifa_code: string | null
  coach_is_home: boolean | null
  goals_for: number
  goals_against: number
  final_score: string | null
  shootout_score: string | null
  outcome: 'W' | 'D' | 'L' | null
  venue_country_id: string | null
  venue_country_name: string | null
  venue_city_id: string | null
  venue_city_name: string | null
  venue_stadium_id: string | null
  venue_stadium_name: string | null
  // POV: Polska. 'HOME' = mecz w Polsce, 'AWAY' = w kraju rywala Polski,
  // 'NEUTRAL' = ani jedno, ani drugie. null = brak danych o miejscu.
  venue_type: 'HOME' | 'AWAY' | 'NEUTRAL' | null
}

// Per-match row for the referee filter ribbon (matches Poland played that were officiated
// by the given referee). Field semantics mirror CoachPolandFilterMatch, but the POV
// fields refer to Poland's team instead of the coached team. outcome / goals_for /
// goals_against are computed from Poland's perspective.
export type RefereeFilterMatch = {
  match_id: string
  match_date: string
  match_time: string | null
  match_status: string | null
  result_type: string | null
  walkover_winner_team_id: string | null
  editorial_status: string
  competition_key: CoachCompetitionFilterKey
  competition_name: string
  stage_key: CoachStageFilterKey
  match_level_name: string | null
  home_team_name: string
  away_team_name: string
  home_team_fifa_code: string | null
  away_team_fifa_code: string | null
  poland_team_id: string | null
  poland_team_fifa_code: string | null
  poland_is_home: boolean | null
  goals_for: number
  goals_against: number
  final_score: string | null
  shootout_score: string | null
  outcome: 'W' | 'D' | 'L' | null
  venue_country_id: string | null
  venue_country_name: string | null
  venue_city_id: string | null
  venue_city_name: string | null
  venue_stadium_id: string | null
  venue_stadium_name: string | null
  venue_type: 'HOME' | 'AWAY' | 'NEUTRAL' | null
}

// Per-match row for the players filter ribbon. Each row represents a single match in
// which Poland played, and in which the player participated (as starter or sub).
// POV fields (goals_for/against, outcome, venue_type) are computed from the player's
// team perspective. For mode='poland', player_team is Poland; for mode='rivals',
// player_team is the opponent of Poland.
export type PlayerFilterMatch = {
  match_id: string
  match_date: string
  match_time: string | null
  match_status: string | null
  result_type: string | null
  walkover_winner_team_id: string | null
  editorial_status: string
  competition_key: CoachCompetitionFilterKey
  competition_name: string
  stage_key: CoachStageFilterKey
  match_level_name: string | null
  home_team_name: string
  away_team_name: string
  home_team_fifa_code: string | null
  away_team_fifa_code: string | null
  poland_team_id: string | null
  poland_team_fifa_code: string | null
  poland_is_home: boolean | null
  player_team_id: string | null
  player_team_fifa_code: string | null
  player_is_home: boolean | null
  // True iff the player played for Poland in this match; false iff played against Poland.
  is_poland_player: boolean
  goals_for: number
  goals_against: number
  final_score: string | null
  shootout_score: string | null
  outcome: 'W' | 'D' | 'L' | null
  venue_country_id: string | null
  venue_country_name: string | null
  venue_city_id: string | null
  venue_city_name: string | null
  venue_stadium_id: string | null
  venue_stadium_name: string | null
  venue_type: 'HOME' | 'AWAY' | 'NEUTRAL' | null
  // Per-player per-match stats
  is_starting: boolean | null
  played: boolean
  bench: boolean
  goal_count: number
  assist_count: number
  yellow_card_count: number
  red_card_count: number
  minute_count: number
}

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
  // Kraj aktualnie na terenie którego znajduje się birth_city. Gdy równy historycznemu —
  // UI pokazuje tylko jedną flagę. Gdy się różni — konwencja "POL (UKR)".
  birth_country_current_id: string | null
  birth_country_current_name: string | null
  birth_country_current_fifa_code: string | null
  represented_country_names: string[]
  represented_country_fifa_codes: (string | null)[]
  has_represented_poland?: boolean
  has_played_against_poland?: boolean
  coached_country_names: string[]
  coached_country_fifa_codes: (string | null)[]
  has_coached_poland?: boolean
  has_coached_against_poland?: boolean
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
  coach_poland_match_count: number
  coach_against_poland_match_count: number
  coach_poland_first_match_date: string | null
  coach_poland_last_match_date: string | null
  coach_poland_filter_matches: CoachPolandFilterMatch[]
  referee_filter_matches: RefereeFilterMatch[]
  player_filter_matches: PlayerFilterMatch[]
  referee_match_count: number
  coach_wins: number
  coach_draws: number
  coach_losses: number
  coach_goals_scored: number
  coach_goals_conceded: number
  coach_points_per_match: number
  coach_poland_wins: number
  coach_poland_draws: number
  coach_poland_losses: number
  coach_poland_goals_scored: number
  coach_poland_goals_conceded: number
  coach_poland_points_per_match: number
  coach_against_poland_wins: number
  coach_against_poland_draws: number
  coach_against_poland_losses: number
  coach_against_poland_goals_scored: number
  coach_against_poland_goals_conceded: number
  coach_against_poland_points_per_match: number
  referee_wins: number
  referee_draws: number
  referee_losses: number
  referee_goals_scored: number
  referee_goals_conceded: number
}

export type AdminPersonDetails = AdminPersonListItem & {
  represented_country_ids: string[]
  /**
   * Chronologiczna lista państw, do których należało miasto urodzenia
   * OD daty narodzin osoby (starsze okresy są pomijane).
   * Pusta tablica gdy brak miasta urodzenia lub brak okresów w bazie.
   */
  birth_city_country_timeline: CityCountryTimelineEntry[]
}

export type AdminPersonBirthCityOption = {
  id: string
  city_name: string
  current_country_id: string | null
  current_country_name: string | null
  current_country_fifa_code: string | null
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
  type ParticipantRoleRow = { person_id: string; role: string }
  const allParticipants: ParticipantRoleRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const chunkIds = personIds.slice(i, i + CHUNK_SIZE)
    const rows = await fetchAllRows<ParticipantRoleRow>((from, to) =>
      supabase
        .from('tbl_Match_Participants')
        .select('person_id, role')
        .in('person_id', chunkIds)
        .order('id', { ascending: true })
        .range(from, to)
    )
    allParticipants.push(...rows)
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
  type PersonCountryRow = { person_id: string; country_id: string }
  const allLinks: PersonCountryRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const chunkIds = personIds.slice(i, i + CHUNK_SIZE)
    const rows = await fetchAllRows<PersonCountryRow>((from, to) =>
      supabase
        .from('tbl_Person_Countries')
        .select('person_id, country_id')
        .in('person_id', chunkIds)
        .order('person_id', { ascending: true })
        .order('country_id', { ascending: true })
        .range(from, to)
    )
    allLinks.push(...rows)
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
  type PersonCountryRow = { person_id: string; country_id: string }
  const allLinks: PersonCountryRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const chunkIds = personIds.slice(i, i + CHUNK_SIZE)
    const rows = await fetchAllRows<PersonCountryRow>((from, to) =>
      supabase
        .from('tbl_Person_Countries')
        .select('person_id, country_id')
        .in('person_id', chunkIds)
        .order('person_id', { ascending: true })
        .order('country_id', { ascending: true })
        .range(from, to)
    )
    allLinks.push(...rows)
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

/**
 * Wyprowadza reprezentowane kraje z historii meczów gracza:
 * każdy uczestnik z `role='PLAYER'` w drużynie narodowej (team z
 * `club_id IS NULL`) daje kraj = `team.country_id`.
 *
 * Używane razem z `getExplicitRepresentedCountryDataByPersonId` — łączony
 * wynik pokazuje flagi „raz zagrałeś dla reprezentacji = ten kraj Ci
 * zostaje" bez potrzeby backfillu `tbl_Person_Countries`.
 */
async function getDerivedRepresentedCountryDataByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, { name: string; fifaCode: string | null }[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  type ParticipationRow = { person_id: string; team_id: string | null }
  const participations: ParticipationRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, team_id')
        .eq('role', 'PLAYER')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .not('team_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (represented derived): ${error.message}`)

      const rows = (data ?? []) as ParticipationRow[]
      participations.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const teamIds = [
    ...new Set(participations.map((row) => row.team_id).filter((id): id is string => Boolean(id))),
  ]
  if (!teamIds.length) return new Map()

  const nationalTeamCountryById = new Map<string, string>()
  for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id, club_id')
      .in('id', teamIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Teams (represented derived): ${error.message}`)

    for (const team of (data ?? []) as Array<{ id: string; country_id: string | null; club_id: string | null }>) {
      if (team.club_id === null && team.country_id) {
        nationalTeamCountryById.set(team.id, team.country_id)
      }
    }
  }

  if (nationalTeamCountryById.size === 0) return new Map()

  const countryIds = [...new Set([...nationalTeamCountryById.values()])]
  const countryById = new Map<string, { name: string; fifaCode: string | null }>()
  for (let i = 0; i < countryIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', countryIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Countries (represented derived): ${error.message}`)

    for (const country of (data ?? []) as Array<{ id: string; name: string; fifa_code: string | null }>) {
      if (country.name) {
        countryById.set(country.id, { name: country.name, fifaCode: country.fifa_code ?? null })
      }
    }
  }

  const map = new Map<string, { name: string; fifaCode: string | null }[]>()
  for (const participation of participations) {
    if (!participation.team_id) continue
    const countryId = nationalTeamCountryById.get(participation.team_id)
    if (!countryId) continue
    const country = countryById.get(countryId)
    if (!country) continue

    const existing = map.get(participation.person_id) ?? []
    if (existing.some((entry) => entry.name === country.name)) continue
    existing.push({ name: country.name, fifaCode: country.fifaCode })
    existing.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    map.set(participation.person_id, existing)
  }

  return map
}

/**
 * Efektywna lista reprezentowanych krajów = jawne wpisy z `tbl_Person_Countries`
 * PLUS kraje wyprowadzone z historii meczów (drużyny narodowe, w których gracz
 * wystąpił jako PLAYER). Duplikaty po nazwie są usuwane, wynik jest posortowany
 * alfabetycznie.
 */
async function getEffectiveRepresentedCountryDataByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, { name: string; fifaCode: string | null }[]>> {
  if (!personIds.length) return new Map()

  const [explicit, derived] = await Promise.all([
    getExplicitRepresentedCountryDataByPersonId(supabase, personIds),
    getDerivedRepresentedCountryDataByPersonId(supabase, personIds),
  ])

  const merged = new Map<string, { name: string; fifaCode: string | null }[]>()
  const allPersonIds = new Set<string>([...explicit.keys(), ...derived.keys()])
  for (const personId of allPersonIds) {
    const seen = new Set<string>()
    const list: { name: string; fifaCode: string | null }[] = []
    for (const source of [explicit.get(personId) ?? [], derived.get(personId) ?? []]) {
      for (const entry of source) {
        if (seen.has(entry.name)) continue
        seen.add(entry.name)
        list.push(entry)
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    merged.set(personId, list)
  }
  return merged
}

async function getPolandCountryId(supabase: ReturnType<typeof createServiceRoleClient>): Promise<string | null> {
  const { data, error } = await supabase
    .from('tbl_Countries')
    .select('id')
    .ilike('name', 'Polska')
    .maybeSingle()

  if (error) throw new Error(`tbl_Countries (Polska): ${error.message}`)
  return data?.id ?? null
}

async function getPolandTeamIdByMatchId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matchIds: string[]
): Promise<Map<string, string>> {
  if (!matchIds.length) {
    return new Map()
  }

  const polandCountryId = await getPolandCountryId(supabase)
  if (!polandCountryId) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const matchPolandTeamIdMap = new Map<string, string>()

  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const { data: matchData, error } = await supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id')
      .in('id', matchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches (Poland team lookup): ${error.message}`)

    const matches = (matchData ?? []) as Array<{ id: string; home_team_id: string; away_team_id: string }>
    const teamIds = [...new Set(matches.flatMap((match) => [match.home_team_id, match.away_team_id]))]
    if (!teamIds.length) continue

    const teamCountryMap = new Map<string, string | null>()
    for (let j = 0; j < teamIds.length; j += CHUNK_SIZE) {
      const { data: teamData, error: teamError } = await supabase
        .from('tbl_Teams')
        .select('id, country_id')
        .in('id', teamIds.slice(j, j + CHUNK_SIZE))

      if (teamError) throw new Error(`tbl_Teams (Poland team lookup): ${teamError.message}`)

      for (const team of (teamData ?? []) as Array<{ id: string; country_id: string | null }>) {
        teamCountryMap.set(team.id, team.country_id)
      }
    }

    for (const match of matches) {
      const homeCountryId = teamCountryMap.get(match.home_team_id) ?? null
      const awayCountryId = teamCountryMap.get(match.away_team_id) ?? null
      if (homeCountryId === polandCountryId) {
        matchPolandTeamIdMap.set(match.id, match.home_team_id)
      } else if (awayCountryId === polandCountryId) {
        matchPolandTeamIdMap.set(match.id, match.away_team_id)
      }
    }
  }

  return matchPolandTeamIdMap
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

  type CityRow = { id: string; city_name: string | null; current_country_id: string | null }
  // tbl_Cities ma >1000 rekordów — paginujemy, bo PostgREST tnie do 1000 wierszy bez .range().
  const cities = await fetchAllRows<CityRow>((from, to) =>
    supabase
      .from('tbl_Cities')
      .select('id, city_name, current_country_id')
      .order('city_name', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, to)
  )

  if (!cities.length) return []

  const cityIds = cities.map((city) => city.id)

  // Avoid oversized `.in(...)` queries that can fail at fetch layer when city count is high,
  // and avoid silent 1000-row truncation per chunk (ZASADA #7) — paginujemy `.range()` wewnątrz chunka.
  const periods: CityCountryPeriod[] = []
  const batchSize = 250

  for (let start = 0; start < cityIds.length; start += batchSize) {
    const cityIdsBatch = cityIds.slice(start, start + batchSize)
    const rows = await fetchAllRows<CityCountryPeriod>((from, to) =>
      supabase
        .from('tbl_City_Country_Periods')
        .select('city_id, country_id, valid_from, valid_to')
        .in('city_id', cityIdsBatch)
        .order('city_id', { ascending: true })
        .range(from, to)
    )
    if (rows.length) periods.push(...rows)
  }

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const period of periods) {
    const arr = periodsByCity.get(period.city_id) ?? []
    arr.push(period)
    periodsByCity.set(period.city_id, arr)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const city of cities) {
    const best = sortPeriods(periodsByCity.get(city.id) ?? [])[0]
    const currentCountryId = city.current_country_id ?? best?.country_id ?? null
    if (currentCountryId) currentCountryIdByCity.set(city.id, currentCountryId)
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryNameById = new Map<string, string>()
  let countryFifaCodeById = new Map<string, string | null>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryNameById = new Map((countries ?? []).map((country) => [country.id, country.name]))
    countryFifaCodeById = new Map(
      (countries ?? []).map((country) => [country.id, country.fifa_code ?? null])
    )
  }

  return cities.map((city) => {
    const currentCountryId = currentCountryIdByCity.get(city.id) ?? null

    return {
      id: city.id,
      city_name: city.city_name ?? '—',
      current_country_id: currentCountryId,
      current_country_name: currentCountryId ? (countryNameById.get(currentCountryId) ?? null) : null,
      current_country_fifa_code: currentCountryId ? (countryFifaCodeById.get(currentCountryId) ?? null) : null,
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
  coach_match_count: number
  coach_wins: number
  coach_draws: number
  coach_losses: number
  coach_goals_scored: number
  coach_goals_conceded: number
  coach_poland_match_count: number
  coach_poland_wins: number
  coach_poland_draws: number
  coach_poland_losses: number
  coach_poland_goals_scored: number
  coach_poland_goals_conceded: number
  coach_against_poland_match_count: number
  coach_against_poland_wins: number
  coach_against_poland_draws: number
  coach_against_poland_losses: number
  coach_against_poland_goals_scored: number
  coach_against_poland_goals_conceded: number
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
  type MatchRow = MatchScoreColumns & { id: string; result_type: string | null; match_status: string }
  const matchDataMap = new Map<string, MatchRow>()
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id, result_type, match_status, home_goals, away_goals, home_shootout_goals, away_shootout_goals')
      .in('id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches (coach stats): ${error.message}`)
    for (const m of (data ?? []) as MatchRow[]) matchDataMap.set(m.id, m)
  }

  const matchPolandTeamIdMap = await getPolandTeamIdByMatchId(supabase, filteredMatchIds)

  function createEmptyCoachStats(): CoachResultStats {
    return {
      coach_match_count: 0,
      coach_wins: 0,
      coach_draws: 0,
      coach_losses: 0,
      coach_goals_scored: 0,
      coach_goals_conceded: 0,
      coach_poland_match_count: 0,
      coach_poland_wins: 0,
      coach_poland_draws: 0,
      coach_poland_losses: 0,
      coach_poland_goals_scored: 0,
      coach_poland_goals_conceded: 0,
      coach_against_poland_match_count: 0,
      coach_against_poland_wins: 0,
      coach_against_poland_draws: 0,
      coach_against_poland_losses: 0,
      coach_against_poland_goals_scored: 0,
      coach_against_poland_goals_conceded: 0,
    }
  }

  // 5. Aggregate W/D/L and goals per coach (from coached team's perspective)
  // and split into context: coached Poland vs coached opponents of Poland.
  const result = new Map<string, CoachResultStats>()
  for (const { person_id, match_id, team_id: coachedTeamId } of filteredParticipations) {
    if (!coachedTeamId) continue
    const matchData = matchDataMap.get(match_id)
    if (!matchData) continue

    const polandTeamId = matchPolandTeamIdMap.get(match_id) ?? null
    const coachedPoland = Boolean(polandTeamId && coachedTeamId === polandTeamId)
    const coachedAgainstPoland = Boolean(polandTeamId && coachedTeamId !== polandTeamId)

    const existing = result.get(person_id) ?? createEmptyCoachStats()
    existing.coach_match_count += 1
    if (coachedPoland) {
      existing.coach_poland_match_count += 1
    } else if (coachedAgainstPoland) {
      existing.coach_against_poland_match_count += 1
    }

    if (matchData.match_status !== 'FINISHED') {
      result.set(person_id, existing)
      continue
    }

    const otherTeamId = matchData.home_team_id === coachedTeamId
      ? matchData.away_team_id
      : matchData.home_team_id

    const myGoalsEntry = getTeamScoreFromMatch(matchData, coachedTeamId)
    const theirGoalsEntry = getTeamScoreFromMatch(matchData, otherTeamId)
    const myGoals = myGoalsEntry.goals
    const theirGoals = theirGoalsEntry.goals

    existing.coach_goals_scored += myGoals
    existing.coach_goals_conceded += theirGoals
    if (coachedPoland) {
      existing.coach_poland_goals_scored += myGoals
      existing.coach_poland_goals_conceded += theirGoals
    } else if (coachedAgainstPoland) {
      existing.coach_against_poland_goals_scored += myGoals
      existing.coach_against_poland_goals_conceded += theirGoals
    }

    const rt = matchData.result_type
    const decidedByPenalties = rt === 'PENALTIES' || rt === 'EXTRA_TIME_AND_PENALTIES'

    if (decidedByPenalties) {
      existing.coach_draws += 1
      if (coachedPoland) existing.coach_poland_draws += 1
      else if (coachedAgainstPoland) existing.coach_against_poland_draws += 1
    } else if (myGoals > theirGoals) {
      existing.coach_wins += 1
      if (coachedPoland) existing.coach_poland_wins += 1
      else if (coachedAgainstPoland) existing.coach_against_poland_wins += 1
    } else if (myGoals < theirGoals) {
      existing.coach_losses += 1
      if (coachedPoland) existing.coach_poland_losses += 1
      else if (coachedAgainstPoland) existing.coach_against_poland_losses += 1
    } else {
      existing.coach_draws += 1
      if (coachedPoland) existing.coach_poland_draws += 1
      else if (coachedAgainstPoland) existing.coach_against_poland_draws += 1
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

  type ParticipantRow = { person_id: string; match_id: string; is_starting: boolean | null; squad_role: 'STARTING' | 'BENCH' | 'CALLED_UP' | null }
  const allParticipants: ParticipantRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, is_starting, squad_role')
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
  // Wyklucz CALLED_UP z liczenia bench_count — powołani nie siedzą na ławce
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id) && p.squad_role !== 'CALLED_UP')
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
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0

    // Count full minute blocks from entry minute onward.
    const effectiveEntry = entryMin > 0 ? entryMin - 1 : entryMin
    // Exiting in a regular minute (e.g. 46) means last played minute is previous one (45).
    const effectiveExitBase = subOff ? (exitExtra > 0 ? exitMin : exitMin - 1) : matchRegularEnd
    const effectiveExit = Math.min(Math.max(0, effectiveExitBase), matchRegularEnd)

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
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0

    // Count full minute blocks from entry minute onward.
    const effectiveEntry = entryMin > 0 ? entryMin - 1 : entryMin
    // Exiting in a regular minute (e.g. 46) means last played minute is previous one (45).
    const effectiveExitBase = subOff ? (exitExtra > 0 ? exitMin : exitMin - 1) : matchRegularEnd
    const effectiveExit = Math.min(Math.max(0, effectiveExitBase), matchRegularEnd)

    totalMinutes += Math.max(0, effectiveExit - effectiveEntry)
  }

  return totalMinutes
}

export type AdminPeopleListRow = Pick<
  AdminPersonListItem,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'nickname'
  | 'birth_date'
  | 'death_date'
  | 'birth_city_name'
  | 'birth_country_name'
  | 'represented_country_names'
  | 'represented_country_fifa_codes'
  | 'coached_country_names'
  | 'appearance_count'
>

export async function getAdminPeopleList(): Promise<AdminPeopleListRow[]> {
  const supabase = createServiceRoleClient()

  type RpcRow = {
    id: string
    first_name: string | null
    last_name: string | null
    nickname: string | null
    birth_date: string | null
    death_date: string | null
    birth_city_name: string | null
    birth_country_name: string | null
    represented_countries: { name: string; fifa_code: string | null }[] | null
    coached_country_names: string[] | null
    appearance_count: number | null
  }

  const { data, error } = await supabase.rpc('get_admin_people_list')
  if (error) throw new Error(`get_admin_people_list: ${error.message}`)
  const rows = (data ?? []) as RpcRow[]

  return rows
    .map((row) => {
      const represented = [...(row.represented_countries ?? [])]
        .filter((country, index, list) => list.findIndex((c) => c.name === country.name) === index)
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
      return {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        nickname: row.nickname,
        birth_date: row.birth_date,
        death_date: row.death_date,
        birth_city_name: row.birth_city_name,
        birth_country_name: row.birth_country_name,
        represented_country_names: represented.map((c) => c.name),
        represented_country_fifa_codes: represented.map((c) => c.fifa_code),
        coached_country_names: [...(row.coached_country_names ?? [])].sort((a, b) => a.localeCompare(b, 'pl')),
        appearance_count: row.appearance_count ?? 0,
      }
    })
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b), 'pl'))
}

export async function getPublicPersonDetails(id: string): Promise<AdminPersonDetails | null> {
  const cacheKey = await getPublicCacheKey('public-person-details', id)
  return unstable_cache(
    async () => getAdminPersonDetails(id),
    cacheKey,
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
          .select('city_name, current_country_id')
          .eq('id', person.birth_city_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { city_name: string | null; current_country_id: string | null } | null, error: null }),
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

  const representedCountryDataByPersonId = await getEffectiveRepresentedCountryDataByPersonId(supabase, [person.id])
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
  const coachPolandMatchCount = coachStats?.coach_poland_match_count ?? 0
  const coachAgainstPolandMatchCount = coachStats?.coach_against_poland_match_count ?? 0
  const coachMatchCount = coachPolandMatchCount + coachAgainstPolandMatchCount
  const coachWins = coachStats?.coach_wins ?? 0
  const coachDraws = coachStats?.coach_draws ?? 0

  // Resolve historical + current birth country.
  const personBirthPeriods = person.birth_city_id
    ? await loadCityCountryPeriodsMap(supabase, [person.birth_city_id])
    : new Map()
  const periodsForPerson = person.birth_city_id ? (personBirthPeriods.get(person.birth_city_id) ?? []) : []
  const extraCountryIds = new Set<string>()
  for (const p of periodsForPerson) extraCountryIds.add(p.country_id)
  if (person.birth_country_id) extraCountryIds.add(person.birth_country_id)
  if (city?.current_country_id) extraCountryIds.add(city.current_country_id)
  const resolverCountryMap = await loadCountryInfoMap(supabase, [...extraCountryIds])
  const birthCountryFallback = person.birth_country_id ?? city?.current_country_id ?? null
  const resolvedBirth = person.birth_city_id
    ? resolveCityCountry(periodsForPerson, person.birth_date, resolverCountryMap, birthCountryFallback)
    : (person.birth_country_id
      ? {
          historical_country_id: person.birth_country_id,
          historical_country_name: country?.name ?? null,
          historical_country_fifa_code: country?.fifa_code ?? null,
          current_country_id: person.birth_country_id,
          current_country_name: country?.name ?? null,
          current_country_fifa_code: country?.fifa_code ?? null,
        }
      : EMPTY_RESOLVED_CITY_COUNTRY)

  const birthCityCountryTimeline = person.birth_city_id
    ? buildCityCountryTimeline(periodsForPerson, resolverCountryMap, person.birth_date)
    : []

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
    birth_country_name: resolvedBirth.historical_country_name,
    birth_country_fifa_code: resolvedBirth.historical_country_fifa_code,
    birth_country_current_id: resolvedBirth.current_country_id,
    birth_country_current_name: resolvedBirth.current_country_name,
    birth_country_current_fifa_code: resolvedBirth.current_country_fifa_code,
    birth_city_country_timeline: birthCityCountryTimeline,
    represented_country_ids: explicitRepresentedIds,
    represented_country_names: representedNames,
    represented_country_fifa_codes: representedFifaCodes,
    coached_country_names: coachedData.names,
    coached_country_fifa_codes: coachedData.fifaCodes,
    has_coached_poland: coachPolandMatchCount > 0,
    has_coached_against_poland: coachAgainstPolandMatchCount > 0,
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
    coach_poland_match_count: coachPolandMatchCount,
    coach_against_poland_match_count: coachAgainstPolandMatchCount,
    coach_poland_first_match_date: null,
    coach_poland_last_match_date: null,
    coach_poland_filter_matches: [],
    referee_filter_matches: [],
    player_filter_matches: [],
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
    coach_poland_wins: coachStats?.coach_poland_wins ?? 0,
    coach_poland_draws: coachStats?.coach_poland_draws ?? 0,
    coach_poland_losses: coachStats?.coach_poland_losses ?? 0,
    coach_poland_goals_scored: coachStats?.coach_poland_goals_scored ?? 0,
    coach_poland_goals_conceded: coachStats?.coach_poland_goals_conceded ?? 0,
    coach_poland_points_per_match: getCoachPointsPerMatch({
      coachMatchCount: coachPolandMatchCount,
      coachWins: coachStats?.coach_poland_wins ?? 0,
      coachDraws: coachStats?.coach_poland_draws ?? 0,
    }),
    coach_against_poland_wins: coachStats?.coach_against_poland_wins ?? 0,
    coach_against_poland_draws: coachStats?.coach_against_poland_draws ?? 0,
    coach_against_poland_losses: coachStats?.coach_against_poland_losses ?? 0,
    coach_against_poland_goals_scored: coachStats?.coach_against_poland_goals_scored ?? 0,
    coach_against_poland_goals_conceded: coachStats?.coach_against_poland_goals_conceded ?? 0,
    coach_against_poland_points_per_match: getCoachPointsPerMatch({
      coachMatchCount: coachAgainstPolandMatchCount,
      coachWins: coachStats?.coach_against_poland_wins ?? 0,
      coachDraws: coachStats?.coach_against_poland_draws ?? 0,
    }),
    referee_wins: 0,
    referee_draws: 0,
    referee_losses: 0,
    referee_goals_scored: 0,
    referee_goals_conceded: 0,
  }
}

