'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdminAccess } from '@/lib/auth/admin'
import { invalidatePublicCacheVersion } from '@/lib/db/publicCache'
import { fetchAllRows } from '@/lib/db/pagination'
import { formatClubWithLocation } from '@/lib/utils/clubLabel'
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

function revalidateClubCaches(clubId: string | null = null): void {
  revalidateTag('public-clubs', 'max')
  if (clubId) revalidateTag(`public-club:${clubId}`, 'max')
  revalidatePath('/admin/clubs')
  revalidatePath('/clubs')
  if (clubId) {
    revalidatePath(`/admin/clubs/${clubId}`)
    revalidatePath(`/clubs/${clubId}`)
  }
  invalidatePublicCacheVersion()
}

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

  let cityName: string | null = null
  let fifaCode: string | null = null
  if (clubCityId) {
    const { data: city } = await supabase
      .from('tbl_Cities')
      .select('city_name, current_country_id')
      .eq('id', clubCityId)
      .maybeSingle()
    cityName = city?.city_name ?? null

    if (city?.current_country_id) {
      const { data: country } = await supabase
        .from('tbl_Countries')
        .select('fifa_code')
        .eq('id', city.current_country_id)
        .maybeSingle()
      fifaCode = country?.fifa_code ?? null
    }
  }

  revalidateClubCaches(clubId)

  return inlineSuccess(prevState, teamData.id, formatClubWithLocation(name, cityName, fifaCode))
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

  revalidateClubCaches(id)

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

  const { data: team } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('club_id', id)
    .maybeSingle()

  if (team?.id) {
    // PostgREST tnie do 1000 wierszy bez .range() — klub może mieć >1000 meczów.
    const matches = await fetchAllRows<{ id: string }>((from, to) =>
      supabase
        .from('tbl_Matches')
        .select('id')
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
        .order('id', { ascending: true })
        .range(from, to)
    )

    const matchIds = [...new Set(matches.map((match) => match.id).filter(Boolean))]
    for (const matchId of matchIds) {
      revalidateTag(`public-match:${matchId}`, 'max')
    }
  }

  revalidatePath('/admin/clubs')
  revalidatePath(`/admin/clubs/${id}`)
  revalidateTag('public-clubs', 'max')
  revalidateTag(`public-club:${id}`, 'max')
  invalidatePublicCacheVersion()

  redirectWithSaved(`/admin/clubs/${id}`)
}

export async function deleteClub(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/clubs', 'Brak ID klubu do usunięcia.')
  }

  const supabase = createServiceRoleClient()

  // Cały cascade + walidacja "czy klub ma powiązane mecze" żyje w RPC
  // (migracja 040). Dzięki temu jest transakcyjny: crash w środku cofa całość,
  // a jednoczesne dodanie meczu między walidacją a delete jest niemożliwe.
  const { data, error } = await supabase
    .rpc('admin_delete_club', { p_club_id: id })
    .single<{ deleted: boolean; match_count: number; club_name: string | null }>()

  if (error) {
    console.error('admin_delete_club RPC error:', error)
    redirectWithError(
      `/admin/clubs/${id}`,
      'Wystąpił błąd bazy danych podczas usuwania klubu. Spróbuj ponownie.'
    )
  }

  if (!data) {
    redirectWithError(`/admin/clubs/${id}`, 'Brak odpowiedzi z bazy przy usuwaniu klubu.')
  }

  if (!data.deleted) {
    if (data.club_name === null) {
      redirectWithError('/admin/clubs', 'Klub nie istnieje lub został już usunięty.')
    }
    const totalMatches = data.match_count
    redirectWithError(
      `/admin/clubs/${id}`,
      `Nie można usunąć klubu — drużyna tego klubu jest powiązana z ${totalMatches} ${
        totalMatches === 1 ? 'meczem' : 'meczami'
      }. Najpierw usuń lub przepisz te mecze.`
    )
  }

  revalidateClubCaches(id)

  redirectWithAdded('/admin/clubs', `Usunięto klub: ${data.club_name ?? id}`)
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

  revalidateClubCaches(clubId)

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

  revalidateClubCaches(clubId)

  redirectWithSaved(`/admin/clubs/${clubId}`)
}


