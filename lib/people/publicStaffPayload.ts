// Dekodowanie paczki get_public_staff_payload() (migracja 059) do kształtu
// używanego przez publiczne listy trenerów i sędziów. Bez zależności serwerowych.

import type { AdminPersonListItem, CoachPolandFilterMatch, RefereeFilterMatch } from '@/lib/db/people'
import {
  decodePersonBase,
  displayName,
  mapCompetitionNameToFilterKey,
  mapLevelNameToStageKey,
  teamGoals,
  type DecodedPersonBase,
  type PlayersPayloadCountry,
  type PlayersPayloadMatch,
  type PlayersPayloadPerson,
} from '@/lib/players/publicPlayersPayload'

export type StaffPayload = {
  polandCountryId: string | null
  countries: PlayersPayloadCountry[]
  matches: PlayersPayloadMatch[]
  people: PlayersPayloadPerson[]
  coachFacts: [number, number, number][]
  refereeFacts: [number, number][]
}

export type PublicCoachListItem = DecodedPersonBase & Pick<
  AdminPersonListItem,
  | 'has_coached_poland'
  | 'has_coached_against_poland'
  | 'coach_poland_filter_matches'
  | 'coach_poland_first_match_date'
  | 'coach_poland_last_match_date'
  | 'coach_poland_match_count'
  | 'coach_poland_wins'
  | 'coach_poland_draws'
  | 'coach_poland_losses'
  | 'coach_poland_goals_scored'
  | 'coach_poland_goals_conceded'
  | 'coach_poland_points_per_match'
  | 'coach_against_poland_match_count'
  | 'coach_against_poland_wins'
  | 'coach_against_poland_draws'
  | 'coach_against_poland_losses'
  | 'coach_against_poland_goals_scored'
  | 'coach_against_poland_goals_conceded'
  | 'coach_against_poland_points_per_match'
>

export type PublicRefereeListItem = DecodedPersonBase & Pick<AdminPersonListItem, 'referee_filter_matches'>

const COACHED_POLAND = 1
const COACHED_AGAINST_POLAND = 2
const ROLE_COACH = 2
const ROLE_REFEREE = 4

type ScorePov = Pick<CoachPolandFilterMatch, 'goals_for' | 'goals_against' | 'final_score' | 'shootout_score' | 'outcome'>

function scoreFromTeam(match: PlayersPayloadMatch, teamId: string, isHome: boolean): ScorePov {
  if (match.match_status !== 'FINISHED') {
    return { goals_for: 0, goals_against: 0, final_score: null, shootout_score: null, outcome: null }
  }
  const otherTeamId = isHome ? match.away_team_id : match.home_team_id
  const goalsFor = teamGoals(match, teamId).goals
  const goalsAgainst = teamGoals(match, otherTeamId).goals
  const isPenalties = match.result_type === 'PENALTIES' || match.result_type === 'EXTRA_TIME_AND_PENALTIES'
  return {
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    final_score: `${match.home_goals}:${match.away_goals}`,
    shootout_score: isPenalties ? `${match.home_shootout_goals}:${match.away_shootout_goals}` : null,
    outcome: isPenalties ? 'D' : goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D',
  }
}

// Perspektywa Polski: u siebie = mecz w Polsce, wyjazd = w kraju rywala Polski.
function polandVenueType(match: PlayersPayloadMatch, polandCountryId: string | null): 'HOME' | 'AWAY' | 'NEUTRAL' | null {
  if (!match.venue_country_id) return null
  const opponentCountryId = match.poland_team_id === match.home_team_id ? match.away_country_id : match.home_country_id
  if (polandCountryId && match.venue_country_id === polandCountryId) return 'HOME'
  if (opponentCountryId && match.venue_country_id === opponentCountryId) return 'AWAY'
  return 'NEUTRAL'
}

function matchBase(match: PlayersPayloadMatch, polandCountryId: string | null) {
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
    venue_country_id: match.venue_country_id,
    venue_country_name: match.venue_country_name,
    venue_city_id: match.venue_city_id,
    venue_city_name: match.venue_city_name,
    venue_stadium_id: match.venue_stadium_id,
    venue_stadium_name: match.venue_stadium_name,
    venue_type: polandVenueType(match, polandCountryId),
  }
}

function buildCoachRow(match: PlayersPayloadMatch, side: number, polandCountryId: string | null): CoachPolandFilterMatch {
  const coachTeamId = side === 1 ? match.home_team_id : side === 2 ? match.away_team_id : null
  const coachIsHome = side === 1
  return {
    ...matchBase(match, polandCountryId),
    coach_team_id: coachTeamId,
    coach_team_fifa_code: side === 1 ? match.home_team_fifa_code : side === 2 ? match.away_team_fifa_code : null,
    coach_is_home: coachIsHome,
    ...(coachTeamId
      ? scoreFromTeam(match, coachTeamId, coachIsHome)
      : { goals_for: 0, goals_against: 0, final_score: null, shootout_score: null, outcome: null }),
  }
}

function buildRefereeRow(match: PlayersPayloadMatch, polandCountryId: string | null): RefereeFilterMatch {
  const polandIsHome = match.home_team_id === match.poland_team_id
  return {
    ...matchBase(match, polandCountryId),
    poland_team_id: match.poland_team_id,
    poland_team_fifa_code: polandIsHome ? match.home_team_fifa_code : match.away_team_fifa_code,
    poland_is_home: polandIsHome,
    ...scoreFromTeam(match, match.poland_team_id, polandIsHome),
  }
}

function summarize(rows: CoachPolandFilterMatch[]) {
  let wins = 0
  let draws = 0
  let losses = 0
  let scored = 0
  let conceded = 0
  for (const row of rows) {
    if (row.match_status !== 'FINISHED') continue
    scored += row.goals_for
    conceded += row.goals_against
    if (row.outcome === 'W') wins += 1
    else if (row.outcome === 'L') losses += 1
    else if (row.outcome === 'D') draws += 1
  }
  const count = rows.length
  return { count, wins, draws, losses, scored, conceded, ppm: count > 0 ? (wins * 3 + draws) / count : 0 }
}

function decodeStaff(payload: StaffPayload) {
  const coachRows: CoachPolandFilterMatch[][] = payload.people.map(() => [])
  for (const [personIdx, matchIdx, side] of payload.coachFacts) {
    const match = payload.matches[matchIdx]
    if (match) coachRows[personIdx]?.push(buildCoachRow(match, side, payload.polandCountryId))
  }
  const refereeRows: RefereeFilterMatch[][] = payload.people.map(() => [])
  for (const [personIdx, matchIdx] of payload.refereeFacts) {
    const match = payload.matches[matchIdx]
    if (match) refereeRows[personIdx]?.push(buildRefereeRow(match, payload.polandCountryId))
  }
  return { coachRows, refereeRows }
}

export function decodeCoachesPayload(payload: StaffPayload): PublicCoachListItem[] {
  const { coachRows } = decodeStaff(payload)
  const polandTeamByMatchId = new Map(payload.matches.map((m) => [m.id, m.poland_team_id]))
  return payload.people
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => (row[10] & ROLE_COACH) !== 0 && (row[11] & (COACHED_POLAND | COACHED_AGAINST_POLAND)) !== 0)
    .map(({ row, index }) => {
      const rows = coachRows[index]
      const polandRows = rows.filter((r) => r.coach_team_id !== null && r.coach_team_id === polandTeamByMatchId.get(r.match_id))
      const rivalRows = rows.filter((r) => !polandRows.includes(r))
      const poland = summarize(polandRows)
      const rivals = summarize(rivalRows)
      const polandDates = polandRows.map((r) => r.match_date).sort()
      return {
        ...decodePersonBase(row, payload.countries),
        has_coached_poland: (row[11] & COACHED_POLAND) !== 0,
        has_coached_against_poland: (row[11] & COACHED_AGAINST_POLAND) !== 0,
        coach_poland_filter_matches: rows,
        coach_poland_first_match_date: polandDates[0] ?? null,
        coach_poland_last_match_date: polandDates[polandDates.length - 1] ?? null,
        coach_poland_match_count: poland.count,
        coach_poland_wins: poland.wins,
        coach_poland_draws: poland.draws,
        coach_poland_losses: poland.losses,
        coach_poland_goals_scored: poland.scored,
        coach_poland_goals_conceded: poland.conceded,
        coach_poland_points_per_match: poland.ppm,
        coach_against_poland_match_count: rivals.count,
        coach_against_poland_wins: rivals.wins,
        coach_against_poland_draws: rivals.draws,
        coach_against_poland_losses: rivals.losses,
        coach_against_poland_goals_scored: rivals.scored,
        coach_against_poland_goals_conceded: rivals.conceded,
        coach_against_poland_points_per_match: rivals.ppm,
      }
    })
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'pl'))
}

export function decodeRefereesPayload(payload: StaffPayload): PublicRefereeListItem[] {
  const { refereeRows } = decodeStaff(payload)
  return payload.people
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => (row[10] & ROLE_REFEREE) !== 0)
    .map(({ row, index }) => ({
      ...decodePersonBase(row, payload.countries),
      referee_filter_matches: refereeRows[index],
    }))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'pl'))
}
