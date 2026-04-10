'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdminAccess } from '@/lib/auth/admin'
import {
  getTrimmedNullable,
  getTrimmedString,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'
import { findDuplicatePeopleByBirthDateAndCountry, type DuplicatePerson } from '@/lib/db/people'

export async function checkDuplicatePeople(
  birthDate: string | null,
  birthCountryId: string | null
): Promise<DuplicatePerson[]> {
  await requireAdminAccess()
  if (!birthDate || !birthCountryId) return []
  return findDuplicatePeopleByBirthDateAndCountry(birthDate.trim(), birthCountryId.trim())
}

type MatchInput = {
  matchDate: string
  matchTime: string | null
  competitionId: string
  matchLevelId: string | null
  homeTeamId: string
  awayTeamId: string
  matchStadiumId: string | null
  matchCityIdRaw: string | null
  matchStatus: 'SCHEDULED' | 'FINISHED' | 'ABANDONED' | 'CANCELLED'
  resultType: 'REGULAR_TIME' | 'EXTRA_TIME' | 'PENALTIES' | 'EXTRA_TIME_AND_PENALTIES' | 'GOLDEN_GOAL' | 'WALKOVER' | null
  editorialStatus: 'DRAFT' | 'PARTIAL' | 'COMPLETE' | 'VERIFIED'
}

type MatchParticipantRole = 'PLAYER' | 'COACH' | 'REFEREE'
type PlayerPosition = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'ATTACKER'
type MatchEventType =
  | 'GOAL'
  | 'OWN_GOAL'
  | 'PENALTY_GOAL'
  | 'YELLOW_CARD'
  | 'SECOND_YELLOW_CARD'
  | 'RED_CARD'
  | 'PENALTY_SHOOTOUT_SCORED'
  | 'PENALTY_SHOOTOUT_MISSED'
  | 'PENALTY_SHOOTOUT_SAVED'
  | 'MATCH_PENALTY_SAVED'
  | 'MATCH_PENALTY_MISSED'
  | 'SUBSTITUTION'

const MATCH_STATUSES = ['SCHEDULED', 'FINISHED', 'ABANDONED', 'CANCELLED'] as const
const RESULT_TYPES = [
  'REGULAR_TIME',
  'EXTRA_TIME',
  'PENALTIES',
  'EXTRA_TIME_AND_PENALTIES',
  'GOLDEN_GOAL',
  'WALKOVER',
] as const
const EDITORIAL_STATUSES = ['DRAFT', 'PARTIAL', 'COMPLETE', 'VERIFIED'] as const
const MATCH_PARTICIPANT_ROLES = ['PLAYER', 'COACH', 'REFEREE'] as const
const PLAYER_POSITIONS = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'ATTACKER'] as const
const MATCH_EVENT_TYPES = [
  'GOAL',
  'OWN_GOAL',
  'PENALTY_GOAL',
  'YELLOW_CARD',
  'SECOND_YELLOW_CARD',
  'RED_CARD',
  'PENALTY_SHOOTOUT_SCORED',
  'PENALTY_SHOOTOUT_MISSED',
  'PENALTY_SHOOTOUT_SAVED',
  'MATCH_PENALTY_SAVED',
  'MATCH_PENALTY_MISSED',
  'SUBSTITUTION',
] as const
const STARTERS_COUNT = 11

const EVENT_TYPE_LABEL_PL: Record<MatchEventType, string> = {
  GOAL: 'Gol',
  OWN_GOAL: 'Gol samobójczy',
  PENALTY_GOAL: 'Gol z karnego',
  YELLOW_CARD: 'Żółta kartka',
  SECOND_YELLOW_CARD: 'Druga żółta kartka',
  RED_CARD: 'Czerwona kartka',
  PENALTY_SHOOTOUT_SCORED: 'Karny pomeczowy – gol',
  PENALTY_SHOOTOUT_MISSED: 'Karny pomeczowy – pudło',
  PENALTY_SHOOTOUT_SAVED: 'Karny pomeczowy – obroniony',
  MATCH_PENALTY_SAVED: 'Obroniony karny w meczu',
  MATCH_PENALTY_MISSED: 'Nietrafiony karny w meczu',
  SUBSTITUTION: 'Zmiana',
}

// Typy zdarzeń, które MUSZĄ mieć przypisaną drużynę
const REQUIRES_TEAM_TYPES = new Set<MatchEventType>([
  'GOAL', 'OWN_GOAL', 'PENALTY_GOAL',
  'YELLOW_CARD', 'SECOND_YELLOW_CARD', 'RED_CARD',
  'PENALTY_SHOOTOUT_SCORED', 'PENALTY_SHOOTOUT_MISSED', 'PENALTY_SHOOTOUT_SAVED',
  'MATCH_PENALTY_SAVED', 'MATCH_PENALTY_MISSED',
  'SUBSTITUTION',
])

// Typy zdarzeń, które MUSZĄ mieć przypisaną Osobę 1
const REQUIRES_PRIMARY_TYPES = new Set<MatchEventType>([
  'GOAL', 'OWN_GOAL', 'PENALTY_GOAL',
  'YELLOW_CARD', 'SECOND_YELLOW_CARD', 'RED_CARD',
  'PENALTY_SHOOTOUT_SCORED', 'PENALTY_SHOOTOUT_MISSED', 'PENALTY_SHOOTOUT_SAVED',
  'MATCH_PENALTY_SAVED', 'MATCH_PENALTY_MISSED',
  'SUBSTITUTION',
])

function parseOptionalInteger(raw: string): number | null {
  if (!raw) return null
  const value = Number.parseInt(raw, 10)
  return Number.isNaN(value) ? null : value
}

function readEnumValueOrRedirect<T extends string>(
  formData: FormData,
  key: string,
  allowedValues: readonly T[],
  redirectPath: string,
  errorMessage: string
): T {
  const raw = getTrimmedString(formData, key)

  if (allowedValues.includes(raw as T)) {
    return raw as T
  }

  redirectWithError(redirectPath, errorMessage)
}

function readEnumValueOrDefault<T extends string>(
  formData: FormData,
  key: string,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  const raw = getTrimmedString(formData, key)

  if (allowedValues.includes(raw as T)) {
    return raw as T
  }

  return defaultValue
}

function readMatchInput(
  formData: FormData,
  redirectPath: string,
  options: { requireStatuses: boolean }
): MatchInput {
  const matchStatus = options.requireStatuses
    ? readEnumValueOrRedirect(
      formData,
      'match_status',
      MATCH_STATUSES,
      redirectPath,
      'Wybrano nieprawidłowy status meczu.'
    )
    : readEnumValueOrDefault(formData, 'match_status', MATCH_STATUSES, 'SCHEDULED')

  const editorialStatus = options.requireStatuses
    ? readEnumValueOrRedirect(
      formData,
      'editorial_status',
      EDITORIAL_STATUSES,
      redirectPath,
      'Wybrano nieprawidłowy status redakcji.'
    )
    : readEnumValueOrDefault(formData, 'editorial_status', EDITORIAL_STATUSES, 'DRAFT')

  const resultTypeRaw = getTrimmedNullable(formData, 'result_type')
  const resultType = resultTypeRaw && RESULT_TYPES.includes(resultTypeRaw as (typeof RESULT_TYPES)[number])
    ? resultTypeRaw as MatchInput['resultType']
    : null

  return {
    matchDate: getTrimmedString(formData, 'match_date'),
    matchTime: getTrimmedNullable(formData, 'match_time'),
    competitionId: getTrimmedString(formData, 'competition_id'),
    matchLevelId: getTrimmedNullable(formData, 'match_level_id'),
    homeTeamId: getTrimmedString(formData, 'home_team_id'),
    awayTeamId: getTrimmedString(formData, 'away_team_id'),
    matchStadiumId: getTrimmedNullable(formData, 'match_stadium_id'),
    matchCityIdRaw: getTrimmedNullable(formData, 'match_city_id'),
    matchStatus,
    resultType: matchStatus === 'FINISHED' ? resultType : null,
    editorialStatus,
  }
}

async function hasMatchLevelColumn(
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<boolean> {
  const { error } = await supabase
    .from('tbl_Matches')
    .select('match_level_id')
    .limit(1)

  if (!error) return true

  const message = error.message.toLowerCase()
  const isMissingColumn = message.includes('match_level_id')
    && (
      message.includes('schema cache')
      || message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('not found')
    )

  if (isMissingColumn) return false

  throw new Error(`tbl_Matches (match_level_id): ${error.message}`)
}

function validateMatchInputOrRedirect(input: MatchInput, redirectPath: string): void {
  if (!input.matchDate) {
    redirectWithError(redirectPath, 'Data meczu jest wymagana.')
  }

  if (!input.competitionId) {
    redirectWithError(redirectPath, 'Rozgrywki są wymagane.')
  }

  if (!input.homeTeamId || !input.awayTeamId) {
    redirectWithError(redirectPath, 'Wybierz gospodarza i gościa.')
  }

  if (input.homeTeamId === input.awayTeamId) {
    redirectWithError(redirectPath, 'Gospodarz i gość muszą być różnymi drużynami.')
  }

  if (
    input.editorialStatus === 'VERIFIED'
    && !['FINISHED', 'ABANDONED', 'CANCELLED'].includes(input.matchStatus)
  ) {
    redirectWithError(
      redirectPath,
      'Status redakcji "VERIFIED" można ustawić tylko dla meczu zakończonego, przerwanego lub odwołanego.'
    )
  }

  if (input.matchStatus === 'FINISHED' && !input.resultType) {
    redirectWithError(redirectPath, 'Dla meczu zakończonego wybierz sposób zakończenia meczu.')
  }
}

async function resolveMatchCityId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matchStadiumId: string | null,
  matchCityIdRaw: string | null,
  redirectPath: string
): Promise<string | null> {
  let matchCityId = matchCityIdRaw

  if (matchStadiumId) {
    const { data: stadium, error: stadiumError } = await supabase
      .from('tbl_Stadiums')
      .select('stadium_city_id')
      .eq('id', matchStadiumId)
      .maybeSingle()

    if (stadiumError) {
      redirectWithError(redirectPath, 'Wystąpił błąd serwera. Spróbuj ponownie.')
    }

    if (!stadium) {
      redirectWithError(redirectPath, 'Wybrano nieprawidłowy stadion.')
    }

    matchCityId = stadium.stadium_city_id ?? matchCityId

    if (!matchCityId) {
      redirectWithError(
        redirectPath,
        'Wybrany stadion nie ma przypisanego miasta. Wybierz miasto meczu ręcznie.'
      )
    }
  }

  if (!matchCityId) {
    redirectWithError(redirectPath, 'Wybierz stadion albo miasto meczu.')
  }

  return matchCityId
}

async function validateTeamsExistOrRedirect(
  supabase: ReturnType<typeof createServiceRoleClient>,
  homeTeamId: string,
  awayTeamId: string,
  redirectPath: string
): Promise<void> {
  const { data: teams, error: teamsError } = await supabase
    .from('tbl_Teams')
    .select('id')
    .in('id', [homeTeamId, awayTeamId])

  if (teamsError) {
    redirectWithError(redirectPath, 'Wystąpił błąd serwera. Spróbuj ponownie.')
  }

  if ((teams ?? []).length !== 2) {
    redirectWithError(redirectPath, 'Wybrano nieprawidłową drużynę.')
  }
}

async function getMatchOrRedirect(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matchId: string,
  redirectPath: string
): Promise<{ id: string; match_date: string; home_team_id: string; away_team_id: string }> {
  const { data: match, error } = await supabase
    .from('tbl_Matches')
    .select('id, match_date, home_team_id, away_team_id')
    .eq('id', matchId)
    .maybeSingle()

  if (error) {
    redirectWithError(redirectPath, 'Wystąpił błąd serwera. Spróbuj ponownie.')
  }

  if (!match) {
    redirectWithError('/admin/matches', 'Nie znaleziono meczu.')
  }

  return match
}

async function resolveClubTeamIdForParticipant(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personId: string,
  matchDate: string
): Promise<string | null> {
  const { data: periods, error } = await supabase
    .from('tbl_Person_Team_Periods')
    .select('club_team_id, valid_from, valid_to')
    .eq('person_id', personId)
    .order('valid_from', { ascending: false })

  if (error) {
    throw new Error('Nie udało się wyliczyć klubu osoby na dzień meczu.')
  }

  const matchingPeriod = (periods ?? []).find((period) => (
    period.valid_from <= matchDate && (!period.valid_to || period.valid_to >= matchDate)
  ))

  return matchingPeriod?.club_team_id ?? null
}

export async function addMatchParticipant(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const matchId = getTrimmedString(formData, 'match_id')

  if (!matchId) {
    redirectWithError('/admin/matches', 'Brak ID meczu.')
  }

  const redirectPath = `/admin/matches/${matchId}`
  const personId = getTrimmedString(formData, 'person_id')
  const rawRole = getTrimmedString(formData, 'role')
  const role = MATCH_PARTICIPANT_ROLES.includes(rawRole as MatchParticipantRole)
    ? rawRole as MatchParticipantRole
    : null
  const teamIdRaw = getTrimmedNullable(formData, 'team_id')
  const rawPlayerPosition = getTrimmedNullable(formData, 'player_position')
  const playerPosition = rawPlayerPosition && PLAYER_POSITIONS.includes(rawPlayerPosition as PlayerPosition)
    ? rawPlayerPosition as PlayerPosition
    : null
  const isStartingRaw = getTrimmedNullable(formData, 'is_starting')
  const isStarting = role === 'PLAYER'
    ? (isStartingRaw === '1' ? true : isStartingRaw === '0' ? false : null)
    : null

  if (!personId) {
    redirectWithError(redirectPath, 'Wybierz osobę.')
  }

  if (!role) {
    redirectWithError(redirectPath, 'Wybrano nieprawidłową rolę uczestnika.')
  }

  const supabase = createServiceRoleClient()
  const match = await getMatchOrRedirect(supabase, matchId, redirectPath)

  const effectiveTeamId = role === 'REFEREE' ? null : teamIdRaw

  if (role !== 'REFEREE' && !effectiveTeamId) {
    redirectWithError(redirectPath, 'Brak drużyny uczestnika.')
  }

  if (
    effectiveTeamId
    && effectiveTeamId !== match.home_team_id
    && effectiveTeamId !== match.away_team_id
  ) {
    redirectWithError(redirectPath, 'Uczestnik może być przypisany tylko do gospodarza albo gościa.')
  }

  let clubTeamId: string | null = null

  if (role === 'REFEREE') {
    const { count: refereeCount, error: refereeCountError } = await supabase
      .from('tbl_Match_Participants')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', matchId)
      .eq('role', 'REFEREE')

    if (refereeCountError) {
      redirectWithError(redirectPath, 'Nie udało się sprawdzić przypisanego sędziego.')
    }

    if ((refereeCount ?? 0) > 0) {
      redirectWithError(redirectPath, 'Mecz może mieć tylko jednego sędziego głównego.')
    }
  }

  if (role !== 'REFEREE') {
    try {
      clubTeamId = await resolveClubTeamIdForParticipant(supabase, personId, match.match_date)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się wyliczyć klubu uczestnika.'
      redirectWithError(redirectPath, message)
    }
  }

  const { error } = await supabase.from('tbl_Match_Participants').insert({
    id: crypto.randomUUID(),
    match_id: matchId,
    team_id: effectiveTeamId,
    person_id: personId,
    role,
    is_starting: isStarting,
    player_position: role === 'PLAYER' ? playerPosition : null,
    club_team_id: clubTeamId,
  })

  if (error) {
    if (error.code === '23505') {
      redirectWithError(redirectPath, 'Ta osoba ma już przypisaną taką rolę w tym meczu.')
    }

    redirectWithError(redirectPath, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  redirectWithSaved(redirectPath)
}

export async function removeMatchParticipant(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const matchId = getTrimmedString(formData, 'match_id')
  const participantId = getTrimmedString(formData, 'participant_id')

  if (!matchId || !participantId) {
    redirectWithError('/admin/matches', 'Brak danych uczestnika do usunięcia.')
  }

  const redirectPath = `/admin/matches/${matchId}`
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_Match_Participants')
    .delete()
    .eq('id', participantId)
    .eq('match_id', matchId)

  if (error) {
    redirectWithError(redirectPath, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  redirectWithSaved(redirectPath)
}

export async function saveMatchTeamSquad(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const matchId = getTrimmedString(formData, 'match_id')
  const teamId = getTrimmedString(formData, 'team_id')

  if (!matchId || !teamId) {
    redirectWithError('/admin/matches', 'Brak danych drużyny do zapisu składu.')
  }

  const redirectPath = `/admin/matches/${matchId}`
  const supabase = createServiceRoleClient()
  const match = await getMatchOrRedirect(supabase, matchId, redirectPath)

  if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
    redirectWithError(redirectPath, 'Wybrana drużyna nie należy do tego meczu.')
  }

  const playerPersonIds = formData
    .getAll('player_person_id')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
  const playerPositionsRaw = formData
    .getAll('player_position')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))

  if (playerPersonIds.length !== playerPositionsRaw.length) {
    redirectWithError(redirectPath, 'Wystąpił błąd formularza składu. Odśwież stronę i spróbuj ponownie.')
  }

  const rows: Array<{ personId: string; playerPosition: PlayerPosition; isStarting: boolean }> = []

  for (let index = 0; index < playerPersonIds.length; index += 1) {
    const personId = playerPersonIds[index] ?? ''
    const playerPositionRaw = playerPositionsRaw[index] ?? ''
    const playerPosition = PLAYER_POSITIONS.includes(playerPositionRaw as PlayerPosition)
      ? playerPositionRaw as PlayerPosition
      : null
    const isStarterRow = index < STARTERS_COUNT

    if (isStarterRow && (!personId || !playerPosition)) {
      redirectWithError(redirectPath, 'Uzupełnij wszystkie 11 pól podstawowego składu (zawodnik i pozycja).')
    }

    if (!personId && !playerPosition) {
      continue
    }

    if (!personId || !playerPosition) {
      redirectWithError(redirectPath, 'W każdym uzupełnionym wierszu wybierz zawodnika i pozycję.')
    }

    rows.push({
      personId,
      playerPosition,
      isStarting: isStarterRow,
    })
  }

  if (rows.filter((row) => row.isStarting).length < STARTERS_COUNT) {
    redirectWithError(redirectPath, 'Skład musi zawierać 11 zawodników podstawowych.')
  }

  const uniquePlayerIds = [...new Set(rows.map((row) => row.personId))]
  if (uniquePlayerIds.length !== rows.length) {
    redirectWithError(redirectPath, 'Ten sam zawodnik nie może wystąpić dwa razy w jednym składzie.')
  }

  const { data: existingPeople, error: peopleError } = await supabase
    .from('tbl_People')
    .select('id')
    .in('id', uniquePlayerIds)

  if (peopleError) {
    redirectWithError(redirectPath, 'Wystąpił błąd serwera podczas weryfikacji zawodników.')
  }

  if ((existingPeople ?? []).length !== uniquePlayerIds.length) {
    redirectWithError(redirectPath, 'Skład zawiera nieprawidłowego zawodnika.')
  }

  const { error: deleteError } = await supabase
    .from('tbl_Match_Participants')
    .delete()
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .eq('role', 'PLAYER')

  if (deleteError) {
    redirectWithError(redirectPath, 'Nie udało się usunąć poprzedniego składu drużyny.')
  }

  const inserts = [] as Array<{
    id: string
    match_id: string
    team_id: string
    person_id: string
    role: 'PLAYER'
    is_starting: boolean
    player_position: PlayerPosition
    club_team_id: string | null
  }>

  for (const row of rows) {
    let clubTeamId: string | null = null
    try {
      clubTeamId = await resolveClubTeamIdForParticipant(supabase, row.personId, match.match_date)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się wyliczyć klubu zawodnika.'
      redirectWithError(redirectPath, message)
    }

    inserts.push({
      id: crypto.randomUUID(),
      match_id: matchId,
      team_id: teamId,
      person_id: row.personId,
      role: 'PLAYER',
      is_starting: row.isStarting,
      player_position: row.playerPosition,
      club_team_id: clubTeamId,
    })
  }

  const { error: insertError } = await supabase.from('tbl_Match_Participants').insert(inserts)

  if (insertError) {
    redirectWithError(redirectPath, 'Nie udało się zapisać składu. Spróbuj ponownie.')
  }

  redirectWithSaved(redirectPath)
}

export async function saveMatchTeamCoaches(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const matchId = getTrimmedString(formData, 'match_id')
  const teamId = getTrimmedString(formData, 'team_id')

  if (!matchId || !teamId) {
    redirectWithError('/admin/matches', 'Brak danych drużyny do zapisu trenerów.')
  }

  const redirectPath = `/admin/matches/${matchId}`
  const supabase = createServiceRoleClient()
  const match = await getMatchOrRedirect(supabase, matchId, redirectPath)

  if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
    redirectWithError(redirectPath, 'Wybrana drużyna nie należy do tego meczu.')
  }

  const coachPersonIds = formData
    .getAll('coach_person_id')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  const uniqueCoachIds = [...new Set(coachPersonIds)]
  if (uniqueCoachIds.length !== coachPersonIds.length) {
    redirectWithError(redirectPath, 'Ten sam trener nie może wystąpić dwa razy w sztabie.')
  }

  if (uniqueCoachIds.length > 0) {
    const { data: existingPeople, error: peopleError } = await supabase
      .from('tbl_People')
      .select('id')
      .in('id', uniqueCoachIds)

    if (peopleError) {
      redirectWithError(redirectPath, 'Wystąpił błąd serwera podczas weryfikacji trenerów.')
    }

    if ((existingPeople ?? []).length !== uniqueCoachIds.length) {
      redirectWithError(redirectPath, 'Sztab zawiera nieprawidłowego trenera.')
    }
  }

  const { error: deleteError } = await supabase
    .from('tbl_Match_Participants')
    .delete()
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .eq('role', 'COACH')

  if (deleteError) {
    redirectWithError(redirectPath, 'Nie udało się usunąć poprzedniego sztabu trenerskiego.')
  }

  if (uniqueCoachIds.length === 0) {
    redirectWithSaved(redirectPath)
  }

  const inserts = [] as Array<{
    id: string
    match_id: string
    team_id: string
    person_id: string
    role: 'COACH'
    is_starting: null
    player_position: null
    club_team_id: string | null
  }>

  for (const personId of uniqueCoachIds) {
    let clubTeamId: string | null = null
    try {
      clubTeamId = await resolveClubTeamIdForParticipant(supabase, personId, match.match_date)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się wyliczyć klubu trenera.'
      redirectWithError(redirectPath, message)
    }

    inserts.push({
      id: crypto.randomUUID(),
      match_id: matchId,
      team_id: teamId,
      person_id: personId,
      role: 'COACH',
      is_starting: null,
      player_position: null,
      club_team_id: clubTeamId,
    })
  }

  const { error: insertError } = await supabase.from('tbl_Match_Participants').insert(inserts)

  if (insertError) {
    redirectWithError(redirectPath, 'Nie udało się zapisać sztabu trenerskiego. Spróbuj ponownie.')
  }

  redirectWithSaved(redirectPath)
}

async function saveSquadForTeam(
  supabase: ReturnType<typeof createServiceRoleClient>,
  formData: FormData,
  matchId: string,
  teamId: string,
  prefix: string,
  redirectPath: string
): Promise<void> {
  const playerPersonIds = formData
    .getAll(`${prefix}player_person_id`)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
  const playerPositionsRaw = formData
    .getAll(`${prefix}player_position`)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
  const playerClubTeamIdsRaw = formData
    .getAll(`${prefix}player_club_team_id`)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))

  if (
    playerPersonIds.length !== playerPositionsRaw.length
    || playerPersonIds.length !== playerClubTeamIdsRaw.length
  ) {
    redirectWithError(redirectPath, 'Wystąpił błąd formularza składu. Odśwież stronę i spróbuj ponownie.')
  }

  const anySquadFieldFilled = playerPersonIds.some(Boolean)
    || playerPositionsRaw.some(Boolean)
    || playerClubTeamIdsRaw.some(Boolean)

  if (!anySquadFieldFilled) {
    const { error: deleteError } = await supabase
      .from('tbl_Match_Participants')
      .delete()
      .eq('match_id', matchId)
      .eq('team_id', teamId)
      .eq('role', 'PLAYER')

    if (deleteError) {
      redirectWithError(redirectPath, 'Nie udało się usunąć poprzedniego składu drużyny.')
    }

    return
  }

  const rows: Array<{
    personId: string
    playerPosition: PlayerPosition
    isStarting: boolean
    clubTeamId: string | null
  }> = []

  for (let i = 0; i < playerPersonIds.length; i += 1) {
    const personId = playerPersonIds[i] ?? ''
    const positionRaw = playerPositionsRaw[i] ?? ''
    const clubTeamIdRaw = playerClubTeamIdsRaw[i] ?? ''
    const position = PLAYER_POSITIONS.includes(positionRaw as PlayerPosition) ? positionRaw as PlayerPosition : null
    const isStarter = i < STARTERS_COUNT
    const clubTeamId = clubTeamIdRaw || null

    if (!personId && !position && !clubTeamId) continue

    if (!personId || !position) {
      redirectWithError(redirectPath, 'W każdym uzupełnionym wierszu wybierz zawodnika i pozycję.')
    }

    rows.push({ personId, playerPosition: position, isStarting: isStarter, clubTeamId })
  }

  const uniquePlayerIds = [...new Set(rows.map((r) => r.personId))]
  if (uniquePlayerIds.length !== rows.length) {
    redirectWithError(redirectPath, 'Ten sam zawodnik nie może wystąpić dwa razy w jednym składzie.')
  }

  const { data: existingPeople, error: peopleError } = await supabase
    .from('tbl_People').select('id').in('id', uniquePlayerIds)

  if (peopleError) redirectWithError(redirectPath, 'Wystąpił błąd serwera podczas weryfikacji zawodników.')

  if ((existingPeople ?? []).length !== uniquePlayerIds.length) {
    redirectWithError(redirectPath, 'Skład zawiera nieprawidłowego zawodnika.')
  }

  const uniqueClubTeamIds = [...new Set(rows.map((r) => r.clubTeamId).filter((id): id is string => Boolean(id)))]
  if (uniqueClubTeamIds.length > 0) {
    const { data: existingClubTeams, error: clubTeamsError } = await supabase
      .from('tbl_Teams')
      .select('id, club_id')
      .in('id', uniqueClubTeamIds)

    if (clubTeamsError) {
      redirectWithError(redirectPath, 'Wystąpił błąd serwera podczas weryfikacji klubów zawodników.')
    }

    const validClubTeamRows = (existingClubTeams ?? []).filter((team) => team.club_id)
    if (validClubTeamRows.length !== uniqueClubTeamIds.length) {
      redirectWithError(redirectPath, 'Skład zawiera nieprawidłowy klub zawodnika.')
    }
  }

  const { error: deleteError } = await supabase
    .from('tbl_Match_Participants')
    .delete()
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .eq('role', 'PLAYER')

  if (deleteError) redirectWithError(redirectPath, 'Nie udało się usunąć poprzedniego składu drużyny.')

  const inserts: Array<{
    id: string
    match_id: string
    team_id: string
    person_id: string
    role: 'PLAYER'
    is_starting: boolean
    player_position: PlayerPosition
    club_team_id: string | null
  }> = []

  for (const row of rows) {
    inserts.push({
      id: crypto.randomUUID(),
      match_id: matchId,
      team_id: teamId,
      person_id: row.personId,
      role: 'PLAYER',
      is_starting: row.isStarting,
      player_position: row.playerPosition,
      club_team_id: row.clubTeamId,
    })
  }

  const { error: insertError } = await supabase.from('tbl_Match_Participants').insert(inserts)
  if (insertError) redirectWithError(redirectPath, 'Nie udało się zapisać składu. Spróbuj ponownie.')
}

async function saveCoachesForTeam(
  supabase: ReturnType<typeof createServiceRoleClient>,
  formData: FormData,
  matchId: string,
  matchDate: string,
  teamId: string,
  prefix: string,
  redirectPath: string
): Promise<void> {
  const coachPersonIds = formData
    .getAll(`${prefix}coach_person_id`)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)

  const uniqueCoachIds = [...new Set(coachPersonIds)]
  if (uniqueCoachIds.length !== coachPersonIds.length) {
    redirectWithError(redirectPath, 'Ten sam trener nie może wystąpić dwa razy w sztabie.')
  }

  if (uniqueCoachIds.length > 0) {
    const { data: existingPeople, error: peopleError } = await supabase
      .from('tbl_People').select('id').in('id', uniqueCoachIds)

    if (peopleError) redirectWithError(redirectPath, 'Wystąpił błąd serwera podczas weryfikacji trenerów.')

    if ((existingPeople ?? []).length !== uniqueCoachIds.length) {
      redirectWithError(redirectPath, 'Sztab zawiera nieprawidłowego trenera.')
    }
  }

  const { error: deleteError } = await supabase
    .from('tbl_Match_Participants')
    .delete()
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .eq('role', 'COACH')

  if (deleteError) redirectWithError(redirectPath, 'Nie udało się usunąć poprzedniego sztabu trenerskiego.')

  if (uniqueCoachIds.length === 0) return

  const inserts: Array<{
    id: string
    match_id: string
    team_id: string
    person_id: string
    role: 'COACH'
    is_starting: null
    player_position: null
    club_team_id: string | null
  }> = []

  for (const personId of uniqueCoachIds) {
    let clubTeamId: string | null = null
    try {
      clubTeamId = await resolveClubTeamIdForParticipant(supabase, personId, matchDate)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nie udało się wyliczyć klubu trenera.'
      redirectWithError(redirectPath, msg)
    }

    inserts.push({
      id: crypto.randomUUID(),
      match_id: matchId,
      team_id: teamId,
      person_id: personId,
      role: 'COACH',
      is_starting: null,
      player_position: null,
      club_team_id: clubTeamId,
    })
  }

  const { error: insertError } = await supabase.from('tbl_Match_Participants').insert(inserts)
  if (insertError) redirectWithError(redirectPath, 'Nie udało się zapisać sztabu trenerskiego. Spróbuj ponownie.')
}

async function saveMatchEvents(
  supabase: ReturnType<typeof createServiceRoleClient>,
  formData: FormData,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  redirectPath: string
): Promise<void> {
  const minutes = formData.getAll('event_minute').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const eventTypes = formData.getAll('event_type').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const teamIds = formData.getAll('event_team_id').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const primaryPersonIds = formData.getAll('event_primary_person_id').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const secondaryPersonIds = formData.getAll('event_secondary_person_id').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const minuteExtras = formData.getAll('event_minute_extra').map((v) => (typeof v === 'string' ? v.trim() : ''))

  const rowsCount = minutes.length

  if (
    ![
      eventTypes.length,
      teamIds.length,
      primaryPersonIds.length,
      secondaryPersonIds.length,
      minuteExtras.length,
    ].every((length) => length === rowsCount)
  ) {
    redirectWithError(redirectPath, 'Wystąpił błąd formularza zdarzeń. Odśwież stronę i spróbuj ponownie.')
  }

  const inserts: Array<{
    id: string
    match_id: string
    team_id: string | null
    event_type: MatchEventType
    minute: number
    minute_extra: number | null
    primary_person_id: string | null
    secondary_person_id: string | null
    notes: string | null
    event_order: number | null
  }> = []

  let nextEventOrder = 1

  for (let i = 0; i < rowsCount; i += 1) {
    const minuteRaw = minutes[i] ?? ''
    const eventTypeRaw = eventTypes[i] ?? ''
    const teamIdRaw = teamIds[i] ?? ''
    const primaryPersonIdRaw = primaryPersonIds[i] ?? ''
    const secondaryPersonIdRaw = secondaryPersonIds[i] ?? ''
    const minuteExtraRaw = minuteExtras[i] ?? ''

    const rowHasAnyValue = Boolean(
      minuteRaw
      || eventTypeRaw
      || teamIdRaw
      || primaryPersonIdRaw
      || secondaryPersonIdRaw
      || minuteExtraRaw
    )

    if (!rowHasAnyValue) {
      continue
    }

    const minute = parseOptionalInteger(minuteRaw)
    if (minute === null || minute < 0 || minute > 130) {
      redirectWithError(redirectPath, `Nieprawidłowa minuta w wierszu ${i + 1}.`) 
    }

    if (!MATCH_EVENT_TYPES.includes(eventTypeRaw as MatchEventType)) {
      redirectWithError(redirectPath, `Nieprawidłowy typ zdarzenia w wierszu ${i + 1}.`)
    }

    const minuteExtra = parseOptionalInteger(minuteExtraRaw)
    if (minuteExtra !== null && (minuteExtra < 0 || minuteExtra > 30)) {
      redirectWithError(redirectPath, `Nieprawidłowy doliczony czas w wierszu ${i + 1}.`)
    }

    const teamId = teamIdRaw || null
    if (teamId && teamId !== homeTeamId && teamId !== awayTeamId) {
      redirectWithError(redirectPath, `Nieprawidłowa drużyna zdarzenia w wierszu ${i + 1}.`)
    }

    inserts.push({
      id: crypto.randomUUID(),
      match_id: matchId,
      team_id: teamId,
      event_type: eventTypeRaw as MatchEventType,
      minute,
      minute_extra: minuteExtra,
      primary_person_id: primaryPersonIdRaw || null,
      secondary_person_id: secondaryPersonIdRaw || null,
      notes: null,
      event_order: nextEventOrder,
    })

    nextEventOrder += 1
  }

  const personIds = [...new Set(
    inserts
      .flatMap((row) => [row.primary_person_id, row.secondary_person_id])
      .filter((personId): personId is string => Boolean(personId))
  )]

  if (personIds.length > 0) {
    const { data: participants, error: participantsError } = await supabase
      .from('tbl_Match_Participants')
      .select('person_id')
      .eq('match_id', matchId)
      .in('person_id', personIds)

    if (participantsError) {
      redirectWithError(redirectPath, 'Wystąpił błąd podczas weryfikacji osób zdarzeń.')
    }

    const participantPersonIds = new Set((participants ?? []).map((row) => row.person_id))
    for (const personId of personIds) {
      if (!participantPersonIds.has(personId)) {
        redirectWithError(redirectPath, 'Zdarzenie zawiera osobę, która nie jest uczestnikiem meczu.')
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('tbl_Match_Events')
    .delete()
    .eq('match_id', matchId)

  if (deleteError) {
    redirectWithError(redirectPath, 'Nie udało się usunąć poprzednich zdarzeń meczu.')
  }

  if (inserts.length === 0) {
    return
  }

  const { error: insertError } = await supabase
    .from('tbl_Match_Events')
    .insert(inserts)

  if (insertError) {
    redirectWithError(redirectPath, 'Nie udało się zapisać zdarzeń meczu.')
  }
}

type ParsedEventValidationRow = {
  rowNumber: number
  eventType: MatchEventType
  minute: number
  minuteExtra: number
  eventOrder: number
  teamId: string | null
  primaryPersonId: string | null
  secondaryPersonId: string | null
}

function readPlayerIdsFromSquadForm(formData: FormData, prefix: string): { all: Set<string>; starters: Set<string> } {
  const ids = formData
    .getAll(`${prefix}player_person_id`)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))

  const all = new Set<string>()
  const starters = new Set<string>()

  for (let index = 0; index < ids.length; index += 1) {
    const personId = ids[index]
    if (!personId) continue

    all.add(personId)
    if (index < STARTERS_COUNT) {
      starters.add(personId)
    }
  }

  return { all, starters }
}

function parseEventRowsForValidation(
  formData: FormData,
  homeTeamId: string,
  awayTeamId: string
): { rows: ParsedEventValidationRow[]; errors: string[] } {
  const errors: string[] = []
  const rows: ParsedEventValidationRow[] = []

  const minutes = formData.getAll('event_minute').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const eventTypes = formData.getAll('event_type').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const teamIds = formData.getAll('event_team_id').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const primaryPersonIds = formData.getAll('event_primary_person_id').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const secondaryPersonIds = formData.getAll('event_secondary_person_id').map((v) => (typeof v === 'string' ? v.trim() : ''))
  const minuteExtras = formData.getAll('event_minute_extra').map((v) => (typeof v === 'string' ? v.trim() : ''))

  const rowsCount = minutes.length
  const sameLength = [
    eventTypes.length,
    teamIds.length,
    primaryPersonIds.length,
    secondaryPersonIds.length,
    minuteExtras.length,
  ].every((length) => length === rowsCount)

  if (!sameLength) {
    errors.push('Wystąpił błąd formularza zdarzeń. Odśwież stronę i spróbuj ponownie.')
    return { rows, errors }
  }

  let nextOrder = 1

  for (let i = 0; i < rowsCount; i += 1) {
    const minuteRaw = minutes[i] ?? ''
    const eventTypeRaw = eventTypes[i] ?? ''
    const teamIdRaw = teamIds[i] ?? ''
    const primaryPersonIdRaw = primaryPersonIds[i] ?? ''
    const secondaryPersonIdRaw = secondaryPersonIds[i] ?? ''
    const minuteExtraRaw = minuteExtras[i] ?? ''

    const hasAnyValue = Boolean(
      minuteRaw
      || eventTypeRaw
      || teamIdRaw
      || primaryPersonIdRaw
      || secondaryPersonIdRaw
      || minuteExtraRaw
    )

    if (!hasAnyValue) continue

    const minute = parseOptionalInteger(minuteRaw)
    if (minute === null || minute < 0 || minute > 130) {
      errors.push(`Wiersz ${i + 1}: nieprawidłowa minuta.`)
      continue
    }

    if (!MATCH_EVENT_TYPES.includes(eventTypeRaw as MatchEventType)) {
      errors.push(`Wiersz ${i + 1}: nieprawidłowy typ zdarzenia.`)
      continue
    }

    const minuteExtra = parseOptionalInteger(minuteExtraRaw)
    if (minuteExtra !== null && (minuteExtra < 0 || minuteExtra > 30)) {
      errors.push(`Wiersz ${i + 1}: nieprawidłowa wartość +Min.`)
      continue
    }

    const teamId = teamIdRaw || null
    if (teamId && teamId !== homeTeamId && teamId !== awayTeamId) {
      errors.push(`Wiersz ${i + 1}: wskazana drużyna nie należy do tego meczu.`)
      continue
    }

    const eventType = eventTypeRaw as MatchEventType
    const primaryPersonId = primaryPersonIdRaw || null
    const secondaryPersonId = secondaryPersonIdRaw || null

    const label = EVENT_TYPE_LABEL_PL[eventType]

    if (!teamId && REQUIRES_TEAM_TYPES.has(eventType)) {
      errors.push(`Wiersz ${i + 1} (${label}): brak drużyny – wskaż, do której drużyny należy to zdarzenie.`)
      continue
    }

    if (!primaryPersonId && REQUIRES_PRIMARY_TYPES.has(eventType)) {
      errors.push(`Wiersz ${i + 1} (${label}): brak Osoby 1 – ten typ zdarzenia wymaga wskazania zawodnika.`)
      continue
    }

    rows.push({
      rowNumber: i + 1,
      eventType,
      minute,
      minuteExtra: minuteExtra ?? 0,
      eventOrder: nextOrder,
      teamId,
      primaryPersonId,
      secondaryPersonId,
    })

    nextOrder += 1
  }

  return { rows, errors }
}

function collectConsistencyValidationErrors(
  formData: FormData,
  homeTeamId: string,
  awayTeamId: string
): string[] {
  const errors: string[] = []

  const home = readPlayerIdsFromSquadForm(formData, 'home_')
  const away = readPlayerIdsFromSquadForm(formData, 'away_')

  const personTeam = new Map<string, string>()
  for (const personId of home.all) personTeam.set(personId, homeTeamId)
  for (const personId of away.all) {
    if (!personTeam.has(personId)) personTeam.set(personId, awayTeamId)
  }

  const { rows, errors: parseErrors } = parseEventRowsForValidation(formData, homeTeamId, awayTeamId)
  errors.push(...parseErrors)

  const orderedEvents = [...rows].sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute
    if (a.minuteExtra !== b.minuteExtra) return a.minuteExtra - b.minuteExtra
    return a.eventOrder - b.eventOrder
  })

  const currentOnPitchByTeam = new Map<string, Set<string>>([
    [homeTeamId, new Set(home.starters)],
    [awayTeamId, new Set(away.starters)],
  ])
  const wentOffByTeam = new Map<string, Set<string>>([
    [homeTeamId, new Set<string>()],
    [awayTeamId, new Set<string>()],
  ])
  const firstYellowByPlayer = new Set<string>()
  const redCardedPlayers = new Set<string>()

  const isOnPitch = (personId: string): boolean => (
    currentOnPitchByTeam.get(homeTeamId)?.has(personId)
    || currentOnPitchByTeam.get(awayTeamId)?.has(personId)
    || false
  )

  const SHOOTOUT_TYPES: MatchEventType[] = [
    'PENALTY_SHOOTOUT_SCORED',
    'PENALTY_SHOOTOUT_MISSED',
    'PENALTY_SHOOTOUT_SAVED',
  ]
  const GOAL_TYPES: MatchEventType[] = ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL']

  let shootoutEligiblePlayers: Set<string> | null = null

  for (const event of orderedEvents) {
    if (event.primaryPersonId && redCardedPlayers.has(event.primaryPersonId)) {
      errors.push(`Wiersz ${event.rowNumber}: zawodnik, który wcześniej dostał czerwoną kartkę, nie może uczestniczyć w kolejnych zdarzeniach (Osoba 1).`)
    }

    if (event.secondaryPersonId && redCardedPlayers.has(event.secondaryPersonId)) {
      errors.push(`Wiersz ${event.rowNumber}: zawodnik, który wcześniej dostał czerwoną kartkę, nie może uczestniczyć w kolejnych zdarzeniach (Osoba 2).`)
    }

    if (event.eventType === 'YELLOW_CARD' && event.primaryPersonId) {
      firstYellowByPlayer.add(event.primaryPersonId)
    }

    if (event.eventType === 'SECOND_YELLOW_CARD') {
      if (!event.primaryPersonId || !firstYellowByPlayer.has(event.primaryPersonId)) {
        errors.push(`Wiersz ${event.rowNumber}: druga żółta kartka wymaga wcześniejszej pierwszej żółtej kartki dla tego samego zawodnika.`)
      }
    }

    if (GOAL_TYPES.includes(event.eventType) && event.primaryPersonId && !isOnPitch(event.primaryPersonId)) {
      errors.push(`Wiersz ${event.rowNumber}: gola nie może zdobyć zawodnik, który nie przebywał wtedy na boisku.`)
    }

    if (SHOOTOUT_TYPES.includes(event.eventType)) {
      if (!shootoutEligiblePlayers) {
        shootoutEligiblePlayers = new Set([
          ...(currentOnPitchByTeam.get(homeTeamId) ?? new Set<string>()),
          ...(currentOnPitchByTeam.get(awayTeamId) ?? new Set<string>()),
        ])
      }

      if (event.primaryPersonId && !shootoutEligiblePlayers.has(event.primaryPersonId)) {
        errors.push(`Wiersz ${event.rowNumber}: karne w serii pomeczowej mogą wykonywać tylko zawodnicy będący na boisku w chwili zakończenia meczu.`)
      }
    }

    if (event.eventType === 'MATCH_PENALTY_SAVED' && event.secondaryPersonId) {
      const defenderTeamId = personTeam.get(event.secondaryPersonId)
      const shooterTeamId = event.primaryPersonId
        ? (personTeam.get(event.primaryPersonId) ?? event.teamId)
        : event.teamId

      if (!defenderTeamId) {
        errors.push(`Wiersz ${event.rowNumber}: broniący musi być zawodnikiem jednej z drużyn meczu.`)
      } else {
        const defenderOnPitch = currentOnPitchByTeam.get(defenderTeamId)?.has(event.secondaryPersonId) ?? false
        if (!defenderOnPitch) {
          errors.push(`Wiersz ${event.rowNumber}: karnego może obronić tylko zawodnik, który w tej minucie przebywał na boisku.`)
        }

        if (shooterTeamId && shooterTeamId === defenderTeamId) {
          errors.push(`Wiersz ${event.rowNumber}: karnego może obronić tylko zawodnik drużyny przeciwnej.`)
        }
      }
    }

    if (event.eventType === 'SUBSTITUTION') {
      if (!event.teamId) {
        errors.push(`Wiersz ${event.rowNumber}: zmiana musi mieć wskazaną drużynę.`)
        continue
      }

      const offPlayerId = event.primaryPersonId
      const onPlayerId = event.secondaryPersonId

      if (!offPlayerId || !onPlayerId) {
        errors.push(`Wiersz ${event.rowNumber}: zmiana wymaga zawodnika schodzącego i wchodzącego.`)
        continue
      }

      if (personTeam.get(offPlayerId) !== event.teamId || personTeam.get(onPlayerId) !== event.teamId) {
        errors.push(`Wiersz ${event.rowNumber}: zawodnicy zmiany muszą należeć do wybranej drużyny.`)
        continue
      }

      const wentOff = wentOffByTeam.get(event.teamId) ?? new Set<string>()
      const currentOnPitch = currentOnPitchByTeam.get(event.teamId) ?? new Set<string>()
      let hasBlockingSubstitutionError = false

      if (!currentOnPitch.has(offPlayerId)) {
        errors.push(`Wiersz ${event.rowNumber}: zawodnik schodzący musi przebywać na boisku w momencie zmiany.`)
        hasBlockingSubstitutionError = true
      }

      if (currentOnPitch.has(onPlayerId)) {
        errors.push(`Wiersz ${event.rowNumber}: zawodnik wchodzący nie może już przebywać na boisku w momencie zmiany.`)
        hasBlockingSubstitutionError = true
      }

      if (wentOff.has(onPlayerId)) {
        errors.push(`Wiersz ${event.rowNumber}: zawodnik, który zszedł z boiska, nie może ponownie na nie wejść.`)
        hasBlockingSubstitutionError = true
      }

      if (hasBlockingSubstitutionError) {
        continue
      }

      if (currentOnPitch.has(offPlayerId)) {
        currentOnPitch.delete(offPlayerId)
        wentOff.add(offPlayerId)
      }

      currentOnPitch.add(onPlayerId)
      currentOnPitchByTeam.set(event.teamId, currentOnPitch)
      wentOffByTeam.set(event.teamId, wentOff)
    }

    if (event.eventType === 'RED_CARD' && event.primaryPersonId) {
      redCardedPlayers.add(event.primaryPersonId)

      const teamId = personTeam.get(event.primaryPersonId)
      if (teamId) {
        const currentOnPitch = currentOnPitchByTeam.get(teamId) ?? new Set<string>()
        currentOnPitch.delete(event.primaryPersonId)
        currentOnPitchByTeam.set(teamId, currentOnPitch)
      }
    }
  }

  return [...new Set(errors)]
}

export async function saveMatchFull(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/matches', 'Brak ID meczu.')
  }

  const redirectPath = `/admin/matches/${id}?mode=edit`
  const input = readMatchInput(formData, redirectPath, { requireStatuses: true })
  validateMatchInputOrRedirect(input, redirectPath)

  const saveHomeSquad = getTrimmedString(formData, 'home_squad_touched') === '1'
  const saveAwaySquad = getTrimmedString(formData, 'away_squad_touched') === '1'
  const saveEvents = getTrimmedString(formData, 'events_touched') === '1'

  if (saveHomeSquad || saveAwaySquad || saveEvents) {
    const consistencyErrors = collectConsistencyValidationErrors(
      formData,
      input.homeTeamId,
      input.awayTeamId
    )

    if (consistencyErrors.length > 0) {
      redirectWithError(redirectPath, `VALIDATION_LIST::${consistencyErrors.join('||')}`)
    }
  }

  const supabase = createServiceRoleClient()
  const supportsMatchLevel = await hasMatchLevelColumn(supabase)
  const matchCityId = await resolveMatchCityId(supabase, input.matchStadiumId, input.matchCityIdRaw, redirectPath)
  await validateTeamsExistOrRedirect(supabase, input.homeTeamId, input.awayTeamId, redirectPath)

  const payload: Record<string, unknown> = {
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    competition_id: input.competitionId,
    match_date: input.matchDate,
    match_time: input.matchTime,
    match_stadium_id: input.matchStadiumId,
    match_city_id: matchCityId,
    match_status: input.matchStatus,
    result_type: input.resultType,
    editorial_status: input.editorialStatus,
  }

  if (supportsMatchLevel) {
    payload.match_level_id = input.matchLevelId
  }

  const { data: updatedMatch, error: updateError } = await supabase
    .from('tbl_Matches')
    .update(payload)
    .eq('id', id)
    .select('id, match_date, home_team_id, away_team_id')
    .single()

  if (updateError || !updatedMatch) {
    redirectWithError(redirectPath, 'Nie udało się zaktualizować danych meczu.')
  }

  const matchDate = updatedMatch.match_date
  const homeTeamId = updatedMatch.home_team_id
  const awayTeamId = updatedMatch.away_team_id
  // Referee
  const refereePersonId = getTrimmedNullable(formData, 'referee_person_id')
  await supabase.from('tbl_Match_Participants').delete().eq('match_id', id).eq('role', 'REFEREE')
  if (refereePersonId) {
    await supabase.from('tbl_Match_Participants').insert({
      id: crypto.randomUUID(),
      match_id: id,
      team_id: null,
      person_id: refereePersonId,
      role: 'REFEREE',
      is_starting: null,
      player_position: null,
      club_team_id: null,
    })
  }

  // Squads & coaches
  if (saveHomeSquad) {
    await saveSquadForTeam(supabase, formData, id, homeTeamId, 'home_', redirectPath)
  }
  if (saveAwaySquad) {
    await saveSquadForTeam(supabase, formData, id, awayTeamId, 'away_', redirectPath)
  }
  await saveCoachesForTeam(supabase, formData, id, matchDate, homeTeamId, 'home_', redirectPath)
  await saveCoachesForTeam(supabase, formData, id, matchDate, awayTeamId, 'away_', redirectPath)

  if (saveEvents) {
    await saveMatchEvents(supabase, formData, id, homeTeamId, awayTeamId, redirectPath)
  }

  revalidatePath('/')
  revalidatePath('/matches')
  revalidatePath(`/matches/${id}`)

  redirectWithSaved(`/admin/matches/${id}`)
}

export async function createMatch(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const input = readMatchInput(formData, '/admin/matches', { requireStatuses: false })
  validateMatchInputOrRedirect(input, '/admin/matches')

  const supabase = createServiceRoleClient()
  const supportsMatchLevel = await hasMatchLevelColumn(supabase)
  const matchCityId = await resolveMatchCityId(
    supabase,
    input.matchStadiumId,
    input.matchCityIdRaw,
    '/admin/matches'
  )
  await validateTeamsExistOrRedirect(supabase, input.homeTeamId, input.awayTeamId, '/admin/matches')

  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(),
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    competition_id: input.competitionId,
    match_date: input.matchDate,
    match_time: input.matchTime,
    match_stadium_id: input.matchStadiumId,
    match_city_id: matchCityId,
    match_status: input.matchStatus,
    result_type: input.resultType,
    editorial_status: 'DRAFT',
  }

  if (supportsMatchLevel) {
    payload.match_level_id = input.matchLevelId
  }

  const { error } = await supabase.from('tbl_Matches').insert(payload)

  if (error) {
    redirectWithError('/admin/matches', 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  redirectWithAdded('/admin/matches', `Dodano mecz z datą ${input.matchDate}`)
}

export async function updateMatch(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/matches', 'Brak ID meczu do edycji.')
  }

  const redirectPath = `/admin/matches/${id}`
  const input = readMatchInput(formData, redirectPath, { requireStatuses: true })
  validateMatchInputOrRedirect(input, redirectPath)

  const supabase = createServiceRoleClient()
  const supportsMatchLevel = await hasMatchLevelColumn(supabase)
  const matchCityId = await resolveMatchCityId(
    supabase,
    input.matchStadiumId,
    input.matchCityIdRaw,
    redirectPath
  )

  await validateTeamsExistOrRedirect(supabase, input.homeTeamId, input.awayTeamId, redirectPath)

  const payload: Record<string, unknown> = {
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    competition_id: input.competitionId,
    match_date: input.matchDate,
    match_time: input.matchTime,
    match_stadium_id: input.matchStadiumId,
    match_city_id: matchCityId,
    match_status: input.matchStatus,
    result_type: input.resultType,
    editorial_status: input.editorialStatus,
  }

  if (supportsMatchLevel) {
    payload.match_level_id = input.matchLevelId
  }

  const { error } = await supabase
    .from('tbl_Matches')
    .update(payload)
    .eq('id', id)

  if (error) {
    redirectWithError(redirectPath, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  revalidatePath('/')
  revalidatePath('/matches')
  revalidatePath(`/matches/${id}`)

  redirectWithSaved(redirectPath)
}

export async function deleteMatch(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/matches', 'Brak ID meczu do usunięcia.')
  }

  const supabase = createServiceRoleClient()

  const { data: match } = await supabase
    .from('tbl_Matches')
    .select('match_date')
    .eq('id', id)
    .maybeSingle()

  const { error: deleteEventsError } = await supabase
    .from('tbl_Match_Events')
    .delete()
    .eq('match_id', id)

  if (deleteEventsError) {
    redirectWithError(`/admin/matches/${id}`, 'Nie udało się usunąć zdarzeń meczu. Spróbuj ponownie.')
  }

  const { error: deleteParticipantsError } = await supabase
    .from('tbl_Match_Participants')
    .delete()
    .eq('match_id', id)

  if (deleteParticipantsError) {
    redirectWithError(`/admin/matches/${id}`, 'Nie udało się usunąć przypisań osób do meczu. Spróbuj ponownie.')
  }

  const { error } = await supabase.from('tbl_Matches').delete().eq('id', id)

  if (error) {
    redirectWithError(
      `/admin/matches/${id}`,
      error.code === '23503'
        ? 'Nie można usunąć meczu — istnieją jeszcze inne powiązane dane blokujące usunięcie.'
        : 'Wystąpił błąd bazy danych. Spróbuj ponownie.'
    )
  }

  const label = match?.match_date ?? id
  redirectWithAdded('/admin/matches', `Usunięto mecz: ${label}`)
}

export async function addPerson(
  firstName: string,
  lastName: string,
  nickname: string,
  birthDate: string | null = null,
  birthCityId: string | null = null,
  birthCountryId: string | null = null,
  representedCountryIds: string[] = [],
  isActive: boolean = true
): Promise<{ id: string; label: string; firstName: string; lastName: string; nickname: string }> {
  await requireAdminAccess()

  const firstNameTrimmed = firstName?.trim() || null
  const lastNameTrimmed = lastName?.trim() || null
  const nicknameTrimmed = nickname?.trim() || null
  const birthDateTrimmed = birthDate?.trim() || null
  const birthCityIdTrimmed = birthCityId?.trim() || null
  const birthCountryIdTrimmed = birthCountryId?.trim() || null
  const representedCountryIdsTrimmed = [...new Set(representedCountryIds.map((id) => id?.trim()).filter(Boolean))]

  if (!firstNameTrimmed && !lastNameTrimmed && !nicknameTrimmed) {
    throw new Error('Podaj przynajmniej jedno z pól: imię, nazwisko lub przydomek.')
  }

  const supabase = createServiceRoleClient()
  const personId = crypto.randomUUID()

  const { error } = await supabase.from('tbl_People').insert({
    id: personId,
    first_name: firstNameTrimmed,
    last_name: lastNameTrimmed,
    nickname: nicknameTrimmed,
    birth_date: birthDateTrimmed,
    birth_city_id: birthCityIdTrimmed,
    birth_country_id: birthCountryIdTrimmed,
    is_active: isActive,
  })

  if (error) {
    console.error('Error adding person:', error)
    throw new Error('Nie udało się dodać nowej osoby. Spróbuj ponownie.')
  }

  if (representedCountryIdsTrimmed.length > 0) {
    const { data: existingCountries, error: existingCountriesError } = await supabase
      .from('tbl_Countries')
      .select('id')
      .in('id', representedCountryIdsTrimmed)

    if (existingCountriesError) {
      throw new Error('Błąd odczytu krajów reprezentacji. Spróbuj ponownie.')
    }

    if ((existingCountries ?? []).length !== representedCountryIdsTrimmed.length) {
      throw new Error('Wybrano nieprawidłowy kraj reprezentacji.')
    }

    const { error: representedCountriesError } = await supabase
      .from('tbl_Person_Countries')
      .insert(
        representedCountryIdsTrimmed.map((countryId) => ({
          person_id: personId,
          country_id: countryId,
        }))
      )

    if (representedCountriesError) {
      throw new Error('Nie udało się zapisać krajów reprezentacji.')
    }
  }

  const fullName = firstNameTrimmed && lastNameTrimmed
    ? `${firstNameTrimmed} ${lastNameTrimmed}`
    : firstNameTrimmed || lastNameTrimmed || nicknameTrimmed || '—'

  return {
    id: personId,
    label: fullName,
    firstName: firstNameTrimmed || '',
    lastName: lastNameTrimmed || '',
    nickname: nicknameTrimmed || '',
  }
}
