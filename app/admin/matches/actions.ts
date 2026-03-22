'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdminAccess } from '@/lib/auth/admin'
import {
  getTrimmedNullable,
  getTrimmedString,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

type MatchInput = {
  matchDate: string
  matchTime: string | null
  competitionId: string
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
const STARTERS_COUNT = 11

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
    homeTeamId: getTrimmedString(formData, 'home_team_id'),
    awayTeamId: getTrimmedString(formData, 'away_team_id'),
    matchStadiumId: getTrimmedNullable(formData, 'match_stadium_id'),
    matchCityIdRaw: getTrimmedNullable(formData, 'match_city_id'),
    matchStatus,
    resultType: matchStatus === 'FINISHED' ? resultType : null,
    editorialStatus,
  }
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

export async function saveMatchFull(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/matches', 'Brak ID meczu.')
  }

  const redirectPath = `/admin/matches/${id}?mode=edit`
  const input = readMatchInput(formData, redirectPath, { requireStatuses: true })
  validateMatchInputOrRedirect(input, redirectPath)

  const supabase = createServiceRoleClient()
  const matchCityId = await resolveMatchCityId(supabase, input.matchStadiumId, input.matchCityIdRaw, redirectPath)
  await validateTeamsExistOrRedirect(supabase, input.homeTeamId, input.awayTeamId, redirectPath)

  const { data: updatedMatch, error: updateError } = await supabase
    .from('tbl_Matches')
    .update({
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
    })
    .eq('id', id)
    .select('id, match_date, home_team_id, away_team_id')
    .single()

  if (updateError || !updatedMatch) {
    redirectWithError(redirectPath, 'Nie udało się zaktualizować danych meczu.')
  }

  const matchDate = updatedMatch.match_date
  const homeTeamId = updatedMatch.home_team_id
  const awayTeamId = updatedMatch.away_team_id
  const saveHomeSquad = getTrimmedString(formData, 'home_squad_touched') === '1'
  const saveAwaySquad = getTrimmedString(formData, 'away_squad_touched') === '1'

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

  redirectWithSaved(`/admin/matches/${id}`)
}

export async function createMatch(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const input = readMatchInput(formData, '/admin/matches', { requireStatuses: false })
  validateMatchInputOrRedirect(input, '/admin/matches')

  const supabase = createServiceRoleClient()
  const matchCityId = await resolveMatchCityId(
    supabase,
    input.matchStadiumId,
    input.matchCityIdRaw,
    '/admin/matches'
  )
  await validateTeamsExistOrRedirect(supabase, input.homeTeamId, input.awayTeamId, '/admin/matches')

  const { error } = await supabase.from('tbl_Matches').insert({
    id: crypto.randomUUID(),
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    competition_id: input.competitionId,
    match_date: input.matchDate,
    match_time: input.matchTime,
    match_stadium_id: input.matchStadiumId,
    match_city_id: matchCityId,
    match_status: 'SCHEDULED',
    result_type: null,
    editorial_status: 'DRAFT',
  })

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
  const matchCityId = await resolveMatchCityId(
    supabase,
    input.matchStadiumId,
    input.matchCityIdRaw,
    redirectPath
  )

  await validateTeamsExistOrRedirect(supabase, input.homeTeamId, input.awayTeamId, redirectPath)

  const { error } = await supabase
    .from('tbl_Matches')
    .update({
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
    })
    .eq('id', id)

  if (error) {
    redirectWithError(redirectPath, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

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

  const { error } = await supabase.from('tbl_Matches').delete().eq('id', id)

  if (error) {
    redirectWithError(
      `/admin/matches/${id}`,
      error.code === '23503'
        ? 'Nie można usunąć meczu — jest powiązany z innymi danymi.'
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
