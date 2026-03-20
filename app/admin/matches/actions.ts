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
  editorialStatus: 'DRAFT' | 'PARTIAL' | 'COMPLETE' | 'VERIFIED'
}

const MATCH_STATUSES = ['SCHEDULED', 'FINISHED', 'ABANDONED', 'CANCELLED'] as const
const EDITORIAL_STATUSES = ['DRAFT', 'PARTIAL', 'COMPLETE', 'VERIFIED'] as const

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

  return {
    matchDate: getTrimmedString(formData, 'match_date'),
    matchTime: getTrimmedNullable(formData, 'match_time'),
    competitionId: getTrimmedString(formData, 'competition_id'),
    homeTeamId: getTrimmedString(formData, 'home_team_id'),
    awayTeamId: getTrimmedString(formData, 'away_team_id'),
    matchStadiumId: getTrimmedNullable(formData, 'match_stadium_id'),
    matchCityIdRaw: getTrimmedNullable(formData, 'match_city_id'),
    matchStatus,
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
      redirectWithError(redirectPath, `Błąd odczytu stadionu: ${stadiumError.message}`)
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
    redirectWithError(redirectPath, `Błąd odczytu drużyn: ${teamsError.message}`)
  }

  if ((teams ?? []).length !== 2) {
    redirectWithError(redirectPath, 'Wybrano nieprawidłową drużynę.')
  }
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
    redirectWithError('/admin/matches', `Błąd bazy danych: ${error.message}`)
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
      editorial_status: input.editorialStatus,
    })
    .eq('id', id)

  if (error) {
    redirectWithError(redirectPath, `Błąd bazy danych: ${error.message}`)
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
    redirectWithError(`/admin/matches/${id}`, `Nie można usunąć meczu: ${error.message}`)
  }

  const label = match?.match_date ?? id
  redirectWithAdded('/admin/matches', `Usunięto mecz: ${label}`)
}
