'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdminAccess } from '@/lib/auth/admin'
import type { InlineCreateState } from '@/lib/types/admin'
import {
  getTrimmedNullable,
  getTrimmedString,
  inlineError,
  inlineSuccess,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

async function ensureClubTeamExists(clubId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_Teams')
    .upsert({ id: crypto.randomUUID(), country_id: null, club_id: clubId }, {
      onConflict: 'club_id',
      ignoreDuplicates: true,
    })

  if (error) {
    throw new Error('Nie udało się zarejestrować drużyny dla klubu.')
  }
}

export async function createClubInline(
  prevState: InlineCreateState,
  formData: FormData
): Promise<InlineCreateState> {
  await requireAdminAccess()
  const name = getTrimmedString(formData, 'name')
  const clubCityId = getTrimmedNullable(formData, 'club_city_id')

  if (!name) {
    return inlineError(prevState, 'Nazwa klubu jest wymagana.')
  }

  const supabase = createServiceRoleClient()
  const clubId = crypto.randomUUID()

  const { error: clubError } = await supabase.from('tbl_Clubs').insert({
    id: clubId,
    name,
    club_city_id: clubCityId,
  })

  if (clubError) {
    if (clubError.code === '23505') {
      return inlineError(prevState, `Klub o nazwie "${name}" już istnieje.`)
    }
    return inlineError(prevState, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  // The DB trigger (trg_tbl_clubs_create_team) auto-creates the team row on insert.
  // We query the actual team ID instead of generating our own, which would be wrong.
  const { data: teamData, error: teamQueryError } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('club_id', clubId)
    .single()

  if (teamQueryError || !teamData?.id) {
    console.error('Team lookup error after club insert:', teamQueryError)
    await supabase.from('tbl_Clubs').delete().eq('id', clubId)
    return inlineError(prevState, 'Nie udało się pobrać drużyny dla nowego klubu.')
  }

  return inlineSuccess(prevState, teamData.id, name)
}

export async function createClub(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const name = getTrimmedString(formData, 'name')
  const club_city_id = getTrimmedNullable(formData, 'club_city_id')

  if (!name) {
    redirectWithError('/admin/clubs', 'Nazwa klubu jest wymagana.')
  }

  const supabase = createServiceRoleClient()
  const id = crypto.randomUUID()

  const { error } = await supabase.from('tbl_Clubs').insert({
    id,
    name,
    club_city_id,
  })

  if (error) {
    if (error.code === '23505') {
      redirectWithError('/admin/clubs', `Klub o nazwie „${name}" już istnieje.`)
    }
    redirectWithError('/admin/clubs', 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  try {
    await ensureClubTeamExists(id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udało się utworzyć drużyny dla klubu.'
    console.error('ensureClubTeamExists error:', err)
    redirectWithError('/admin/clubs', message)
  }

  redirectWithAdded('/admin/clubs', name)
}

export async function updateClub(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')
  const name = getTrimmedString(formData, 'name')
  const club_city_id = getTrimmedNullable(formData, 'club_city_id')
  const stadium_id = getTrimmedNullable(formData, 'stadium_id')

  if (!id) {
    redirectWithError('/admin/clubs', 'Brak ID klubu do edycji.')
  }

  if (!name) {
    redirectWithError(`/admin/clubs/${id}`, 'Nazwa klubu jest wymagana.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_Clubs')
    .update({
      name,
      club_city_id,
      stadium_id,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      redirectWithError(`/admin/clubs/${id}`, 'Klub o tej nazwie już istnieje.')
    }
    redirectWithError(`/admin/clubs/${id}`, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  redirectWithSaved(`/admin/clubs/${id}`)
}

export async function deleteClub(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/clubs', 'Brak ID klubu do usunięcia.')
  }

  const supabase = createServiceRoleClient()

  const { data: club } = await supabase
    .from('tbl_Clubs')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  // Find the club's team row
  const { data: team } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('club_id', id)
    .maybeSingle()

  if (team) {
    // Block deletion if the team is used in any match (home or away)
    const { count: homeMatchCount } = await supabase
      .from('tbl_Matches')
      .select('id', { count: 'exact', head: true })
      .eq('home_team_id', team.id)

    const { count: awayMatchCount } = await supabase
      .from('tbl_Matches')
      .select('id', { count: 'exact', head: true })
      .eq('away_team_id', team.id)

    const totalMatches = (homeMatchCount ?? 0) + (awayMatchCount ?? 0)
    if (totalMatches > 0) {
      redirectWithError(
        `/admin/clubs/${id}`,
        `Nie można usunąć klubu — drużyna tego klubu jest powiązana z ${totalMatches} ${
          totalMatches === 1 ? 'meczem' : totalMatches < 5 ? 'meczami' : 'meczami'
        }. Najpierw usuń lub przepisz te mecze.`
      )
    }

    // No matches → safe to clean up dependents before deleting the team

    // 1) Nullify club_team_id in match participants (nullable FK)
    await supabase
      .from('tbl_Match_Participants')
      .update({ club_team_id: null })
      .eq('club_team_id', team.id)

    // 2) Nullify team_id in match events (nullable FK)
    await supabase
      .from('tbl_Match_Events')
      .update({ team_id: null })
      .eq('team_id', team.id)

    // 3) Delete person-team periods tied to this club's team
    await supabase
      .from('tbl_Person_Team_Periods')
      .delete()
      .eq('club_team_id', team.id)

    // 4) Delete the team row itself
    const { error: teamDeleteError } = await supabase
      .from('tbl_Teams')
      .delete()
      .eq('id', team.id)

    if (teamDeleteError) {
      redirectWithError(`/admin/clubs/${id}`, 'Błąd usuwania drużyny klubu. Spróbuj ponownie.')
    }
  }

  // 5) Delete club history (club_id NOT NULL → must go before club)
  await supabase.from('tbl_Club_History').delete().eq('club_id', id)

  // 6) Delete the club itself
  const { error: clubDeleteError } = await supabase
    .from('tbl_Clubs')
    .delete()
    .eq('id', id)

  if (clubDeleteError) {
    redirectWithError(
      `/admin/clubs/${id}`,
      'Wystąpił błąd bazy danych podczas usuwania klubu. Spróbuj ponownie.'
    )
  }

  redirectWithAdded('/admin/clubs', `Usunięto klub: ${club?.name ?? id}`)
}

export async function saveClubHistoryEvent(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const clubId = getTrimmedString(formData, 'club_id')
  const eventId = getTrimmedNullable(formData, 'event_id')
  const title = getTrimmedNullable(formData, 'title')
  const description = getTrimmedNullable(formData, 'description')
  const eventType = getTrimmedNullable(formData, 'event_type')
  const eventDateRaw = getTrimmedNullable(formData, 'event_date')
  const eventDatePrecision = getTrimmedNullable(formData, 'event_date_precision')
  const eventOrderRaw = getTrimmedNullable(formData, 'event_order')

  if (!clubId) redirectWithError('/admin/clubs', 'Brak ID klubu.')
  if (!title) redirectWithError(`/admin/clubs/${clubId}`, 'Tytuł zdarzenia jest wymagany.')

  const eventOrder = eventOrderRaw ? parseInt(eventOrderRaw, 10) : null
  const eventDate = eventDateRaw || null
  const precision = eventDate ? (eventDatePrecision || 'DAY') : null

  const supabase = createServiceRoleClient()
  const finalEventId = eventId ?? crypto.randomUUID()

  if (eventId) {
    const { error: updateError } = await supabase
      .from('tbl_Club_History')
      .update({
        title,
        description,
        event_type: eventType,
        event_date: eventDate,
        event_date_precision: precision,
        event_order: eventOrder,
      })
      .eq('id', eventId)
      .eq('club_id', clubId)

    if (updateError) {
      redirectWithError(`/admin/clubs/${clubId}`, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
    }
  } else {
    const { error: insertError } = await supabase.from('tbl_Club_History').insert({
      id: finalEventId,
      club_id: clubId,
      title,
      description,
      event_type: eventType,
      event_date: eventDate,
      event_date_precision: precision,
      event_order: eventOrder,
    })

    if (insertError) {
      redirectWithError(`/admin/clubs/${clubId}`, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
    }
  }

  redirectWithSaved(`/admin/clubs/${clubId}`)
}

export async function deleteClubHistoryEvent(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const clubId = getTrimmedString(formData, 'club_id')
  const eventId = getTrimmedString(formData, 'event_id')

  if (!clubId || !eventId) redirectWithError('/admin/clubs', 'Brak danych.')

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_Club_History')
    .delete()
    .eq('id', eventId)
    .eq('club_id', clubId)

  if (error) {
    redirectWithError(`/admin/clubs/${clubId}`, 'Wystąpił błąd serwera. Spróbuj ponownie.')
  }

  redirectWithSaved(`/admin/clubs/${clubId}`)
}


