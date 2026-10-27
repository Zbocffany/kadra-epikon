// Dekodowanie zwartej paczki z get_public_players_payload() (migracja 057)
// do kształtu używanego przez publiczną listę piłkarzy. Bez zależności serwerowych —
// działa tak samo na serwerze i w przeglądarce.

import type {
  AdminPersonListItem,
  AdminPersonRole,
  CoachCompetitionFilterKey,
  CoachStageFilterKey,
  PlayerFilterMatch,
} from '@/lib/db/people'

export type PlayersPayloadMatch = {
  id: string
  match_date: string
  match_time: string | null
  match_status: string | null
  result_type: string | null
  walkover_winner_team_id: string | null
  editorial_status: string
  competition_name: string
  match_level_name: string | null
  home_team_id: string
  away_team_id: string
  home_country_id: string | null
  away_country_id: string | null
  home_team_name: string
  away_team_name: string
  home_team_fifa_code: string | null
  away_team_fifa_code: string | null
  poland_team_id: string
  home_goals: number
  away_goals: number
  home_shootout_goals: number
  away_shootout_goals: number
  venue_city_id: string | null
  venue_city_name: string | null
  venue_country_id: string | null
  venue_country_name: string | null
  venue_stadium_id: string | null
  venue_stadium_name: string | null
}

// [id, first_name, last_name, nickname, birth_date, death_date,
//  birthCountryIdx, birthCountryCurrentIdx, representedIdx[], coachedIdx[], rolesBits, polandBits]
export type PlayersPayloadPerson = [
  string,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  number | null,
  number | null,
  number[],
  number[],
  number,
  number,
]

// [name, fifa_code]
export type PlayersPayloadCountry = [string, string | null]

// [personIdx, matchIdx, side, flags, goals, assists, yellow, red, minutes]
export type PlayersPayloadFact = [number, number, number, number, number, number, number, number, number]

export type PlayersPayload = {
  polandCountryId: string | null
  countries: PlayersPayloadCountry[]
  matches: PlayersPayloadMatch[]
  people: PlayersPayloadPerson[]
  facts: PlayersPayloadFact[]
}

export type PublicPlayerListItem = Pick<
  AdminPersonListItem,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'nickname'
  | 'birth_date'
  | 'death_date'
  | 'birth_country_name'
  | 'birth_country_fifa_code'
  | 'birth_country_current_name'
  | 'birth_country_current_fifa_code'
  | 'represented_country_names'
  | 'represented_country_fifa_codes'
  | 'coached_country_names'
  | 'roles'
  | 'has_represented_poland'
  | 'has_played_against_poland'
  | 'player_filter_matches'
>

const FLAG_STARTING = 1
const FLAG_STARTING_NULL = 2
const FLAG_PLAYED = 4
const FLAG_POLAND_PLAYER = 8

const ROLE_BITS: [number, AdminPersonRole][] = [[1, 'PLAYER'], [2, 'COACH'], [4, 'REFEREE']]
const POLAND_REPRESENTED = 1
const POLAND_PLAYED_AGAINST = 2

export function mapCompetitionNameToFilterKey(name: string | null): CoachCompetitionFilterKey {
  if (name === 'Mistrzostwa Świata') return 'WORLD_CUP'
  if (name === 'Mistrzostwa Europy') return 'EURO'
  if (name === 'Liga Narodów') return 'NATIONS_LEAGUE'
  if (name === 'Towarzyski') return 'FRIENDLY'
  return 'OTHER'
}

export function mapLevelNameToStageKey(name: string | null): CoachStageFilterKey {
  if (name === 'Eliminacje') return 'QUALIFIERS'
  if (name === 'Baraż') return 'PLAYOFFS'
  return 'TOURNAMENT'
}

export function teamGoals(match: PlayersPayloadMatch, teamId: string): { goals: number; shootoutGoals: number } {
  if (teamId === match.home_team_id) return { goals: match.home_goals, shootoutGoals: match.home_shootout_goals }
  if (teamId === match.away_team_id) return { goals: match.away_goals, shootoutGoals: match.away_shootout_goals }
  return { goals: 0, shootoutGoals: 0 }
}

function buildFilterRow(match: PlayersPayloadMatch, fact: PlayersPayloadFact, polandCountryId: string | null): PlayerFilterMatch {
  const [, , side, flags, goals, assists, yellow, red, minutes] = fact
  const polandTeamId = match.poland_team_id
  const polandIsHome = match.home_team_id === polandTeamId
  const playerTeamId = side === 1 ? match.home_team_id : side === 2 ? match.away_team_id : null
  const playerIsHome = side === 1 ? true : side === 2 ? false : null
  const playerTeamFifaCode = side === 1 ? match.home_team_fifa_code : side === 2 ? match.away_team_fifa_code : null
  const playerCountryId = side === 1 ? match.home_country_id : side === 2 ? match.away_country_id : null
  const isPolandPlayer = (flags & FLAG_POLAND_PLAYER) !== 0
  const played = (flags & FLAG_PLAYED) !== 0

  let goalsFor = 0
  let goalsAgainst = 0
  let outcome: 'W' | 'D' | 'L' | null = null
  let finalScore: string | null = null
  let shootoutScore: string | null = null
  if (match.match_status === 'FINISHED') {
    const myTeamId = playerTeamId ?? polandTeamId
    const otherTeamId = myTeamId === match.home_team_id ? match.away_team_id : match.home_team_id
    goalsFor = teamGoals(match, myTeamId).goals
    goalsAgainst = teamGoals(match, otherTeamId).goals
    finalScore = `${match.home_goals}:${match.away_goals}`
    if (match.result_type === 'PENALTIES' || match.result_type === 'EXTRA_TIME_AND_PENALTIES') {
      shootoutScore = `${match.home_shootout_goals}:${match.away_shootout_goals}`
      outcome = 'D'
    } else if (goalsFor > goalsAgainst) outcome = 'W'
    else if (goalsFor < goalsAgainst) outcome = 'L'
    else outcome = 'D'
  }

  const opponentIsAway = playerTeamId ? playerTeamId === match.home_team_id : polandIsHome
  const opponentCountryId = opponentIsAway ? match.away_country_id : match.home_country_id
  let venueType: 'HOME' | 'AWAY' | 'NEUTRAL' | null = null
  if (match.venue_country_id) {
    const homeCountryRef = isPolandPlayer ? polandCountryId : playerCountryId
    if (homeCountryRef && match.venue_country_id === homeCountryRef) venueType = 'HOME'
    else if (opponentCountryId && match.venue_country_id === opponentCountryId) venueType = 'AWAY'
    else venueType = 'NEUTRAL'
  }

  return {
    match_id: match.id,
    match_date: match.match_date,
    match_time: match.match_time,
    match_status: match.match_status,
    result_type: match.result_type,
    walkover_winner_team_id: match.walkover_winner_team_id,
    editorial_status: match.editorial_status,
    competition_key: mapCompetitionNameToFilterKey(match.competition_name || null),
    competition_name: match.competition_name,
    stage_key: mapLevelNameToStageKey(match.match_level_name),
    match_level_name: match.match_level_name,
    home_team_name: match.home_team_name,
    away_team_name: match.away_team_name,
    home_team_fifa_code: match.home_team_fifa_code,
    away_team_fifa_code: match.away_team_fifa_code,
    poland_team_id: polandTeamId,
    poland_team_fifa_code: polandIsHome ? match.home_team_fifa_code : match.away_team_fifa_code,
    poland_is_home: polandIsHome,
    player_team_id: playerTeamId,
    player_team_fifa_code: playerTeamFifaCode,
    player_is_home: playerIsHome,
    is_poland_player: isPolandPlayer,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    final_score: finalScore,
    shootout_score: shootoutScore,
    outcome,
    venue_country_id: match.venue_country_id,
    venue_country_name: match.venue_country_name,
    venue_city_id: match.venue_city_id,
    venue_city_name: match.venue_city_name,
    venue_stadium_id: match.venue_stadium_id,
    venue_stadium_name: match.venue_stadium_name,
    venue_type: venueType,
    is_starting: (flags & FLAG_STARTING) !== 0 ? true : (flags & FLAG_STARTING_NULL) !== 0 ? null : false,
    played,
    bench: !played,
    goal_count: goals,
    assist_count: assists,
    yellow_card_count: yellow,
    red_card_count: red,
    minute_count: minutes,
  }
}

export function displayName(person: { first_name: string | null; last_name: string | null; nickname: string | null }): string {
  const fullName = `${person.first_name?.trim() ?? ''} ${person.last_name?.trim() ?? ''}`.trim()
  const nickname = person.nickname?.trim() ?? ''
  return nickname || fullName || '—'
}

function uniqueSortedByName<T extends { name: string }>(items: T[]): T[] {
  return items
    .filter((item, i, list) => list.findIndex((other) => other.name === item.name) === i)
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}

export type DecodedPersonBase = Pick<
  AdminPersonListItem,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'nickname'
  | 'birth_date'
  | 'death_date'
  | 'birth_country_name'
  | 'birth_country_fifa_code'
  | 'birth_country_current_name'
  | 'birth_country_current_fifa_code'
  | 'represented_country_names'
  | 'represented_country_fifa_codes'
  | 'coached_country_names'
  | 'coached_country_fifa_codes'
  | 'roles'
>

// Wspólny format osoby w paczkach 058/059; ostatni element (bity kontekstu) interpretuje wywołujący.
export function decodePersonBase(row: PlayersPayloadPerson, countries: PlayersPayloadCountry[]): DecodedPersonBase {
  const [id, firstName, lastName, nickname, birthDate, deathDate, birthIdx, currentIdx, representedIdx, coachedIdx, rolesBits] = row
  const country = (idx: number | null) => (idx === null ? null : countries[idx] ?? null)
  const toCountries = (indexes: number[]) =>
    uniqueSortedByName(
      indexes.map((i) => country(i)).filter((c): c is PlayersPayloadCountry => Boolean(c)).map(([name, fifa]) => ({ name, fifa }))
    )
  const represented = toCountries(representedIdx)
  const coached = toCountries(coachedIdx)
  const birth = country(birthIdx)
  const current = country(currentIdx)
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    nickname,
    birth_date: birthDate,
    death_date: deathDate,
    birth_country_name: birth?.[0] ?? null,
    birth_country_fifa_code: birth?.[1] ?? null,
    birth_country_current_name: current?.[0] ?? null,
    birth_country_current_fifa_code: current?.[1] ?? null,
    represented_country_names: represented.map((c) => c.name),
    represented_country_fifa_codes: represented.map((c) => c.fifa),
    coached_country_names: coached.map((c) => c.name),
    coached_country_fifa_codes: coached.map((c) => c.fifa),
    roles: ROLE_BITS.filter(([bit]) => (rolesBits & bit) !== 0).map(([, role]) => role),
  }
}

export function decodePlayersPayload(payload: PlayersPayload): PublicPlayerListItem[] {
  const rowsByPerson: PlayerFilterMatch[][] = payload.people.map(() => [])
  for (const fact of payload.facts) {
    const match = payload.matches[fact[1]]
    if (match) rowsByPerson[fact[0]]?.push(buildFilterRow(match, fact, payload.polandCountryId))
  }

  return payload.people
    .map((row, index) => {
      const polandBits = row[11]
      return {
        ...decodePersonBase(row, payload.countries),
        has_represented_poland: (polandBits & POLAND_REPRESENTED) !== 0,
        has_played_against_poland: (polandBits & POLAND_PLAYED_AGAINST) !== 0,
        player_filter_matches: rowsByPerson[index],
      }
    })
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'pl'))
}
