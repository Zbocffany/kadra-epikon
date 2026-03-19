'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  getTrimmedNullable,
  getTrimmedString,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

export async function createClub(formData: FormData): Promise<void> {
  const name = getTrimmedString(formData, 'name')
  const club_city_id = getTrimmedNullable(formData, 'club_city_id')

  if (!name) {
    redirectWithError('/admin/clubs', 'Nazwa klubu jest wymagana.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase.from('tbl_Clubs').insert({
    id: crypto.randomUUID(),
    name,
    club_city_id,
  })

  if (error) {
    if (error.code === '23505') {
      redirectWithError('/admin/clubs', `Klub o nazwie „${name}" już istnieje.`)
    }
    redirectWithError('/admin/clubs', `Błąd bazy danych: ${error.message}`)
  }

  redirectWithAdded('/admin/clubs', name)
}

export async function updateClub(formData: FormData): Promise<void> {
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
    redirectWithError(`/admin/clubs/${id}`, `Błąd bazy danych: ${error.message}`)
  }

  redirectWithSaved(`/admin/clubs/${id}`)
}

export async function deleteClub(formData: FormData): Promise<void> {
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

  const { error } = await supabase.from('tbl_Clubs').delete().eq('id', id)

  if (error) {
    redirectWithError(
      `/admin/clubs/${id}`,
      `Nie można usunąć klubu (prawdopodobnie jest używany): ${error.message}`
    )
  }

  redirectWithAdded('/admin/clubs', `Usunięto klub: ${club?.name ?? id}`)
}

export async function saveClubHistoryEvent(formData: FormData): Promise<void> {
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
      redirectWithError(`/admin/clubs/${clubId}`, `Błąd bazy danych: ${updateError.message}`)
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
      redirectWithError(`/admin/clubs/${clubId}`, `Błąd bazy danych: ${insertError.message}`)
    }
  }

  redirectWithSaved(`/admin/clubs/${clubId}`)
}

export async function deleteClubHistoryEvent(formData: FormData): Promise<void> {
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
    redirectWithError(`/admin/clubs/${clubId}`, `Błąd usuwania: ${error.message}`)
  }

  redirectWithSaved(`/admin/clubs/${clubId}`)
}


