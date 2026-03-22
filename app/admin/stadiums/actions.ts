'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { InlineCreateState } from '@/lib/types/admin'
import { requireAdminAccess } from '@/lib/auth/admin'
import {
  getTrimmedString,
  inlineError,
  inlineSuccess,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

export async function createStadium(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const name = getTrimmedString(formData, 'name')
  const stadiumCityId = getTrimmedString(formData, 'stadium_city_id')

  if (!name) {
    redirectWithError('/admin/stadiums', 'Nazwa stadionu jest wymagana.')
  }

  if (!stadiumCityId) {
    redirectWithError('/admin/stadiums', 'Miasto stadionu jest wymagane.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase.from('tbl_Stadiums').insert({
    id: crypto.randomUUID(),
    name,
    stadium_city_id: stadiumCityId,
  })

  if (error) {
    if (error.code === '23505') {
      redirectWithError('/admin/stadiums', 'Stadion o tej nazwie już istnieje.')
    }

    redirectWithError('/admin/stadiums', 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  redirectWithAdded('/admin/stadiums', name)
}

export async function createStadiumInline(
  prevState: InlineCreateState,
  formData: FormData
): Promise<InlineCreateState> {
  await requireAdminAccess()
  const name = getTrimmedString(formData, 'name')
  const stadiumCityId = getTrimmedString(formData, 'stadium_city_id')

  if (!name) {
    return inlineError(prevState, 'Nazwa stadionu jest wymagana.')
  }

  if (!stadiumCityId) {
    return inlineError(prevState, 'Miasto stadionu jest wymagane.')
  }

  const supabase = createServiceRoleClient()
  const id = crypto.randomUUID()

  const { data: city, error: cityError } = await supabase
    .from('tbl_Cities')
    .select('city_name')
    .eq('id', stadiumCityId)
    .maybeSingle()

  if (cityError || !city) {
    return inlineError(prevState, 'Wybrano nieprawidłowe miasto stadionu.')
  }

  const { error } = await supabase.from('tbl_Stadiums').insert({
    id,
    name,
    stadium_city_id: stadiumCityId,
  })

  if (error) {
    if (error.code === '23505') {
      return inlineError(prevState, 'Stadion o tej nazwie już istnieje.')
    }

    return inlineError(prevState, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  const label = city.city_name ? `${name} (${city.city_name})` : name

  return inlineSuccess(prevState, id, label)
}

export async function updateStadium(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')
  const name = getTrimmedString(formData, 'name')
  const stadiumCityId = getTrimmedString(formData, 'stadium_city_id')

  if (!id) {
    redirectWithError('/admin/stadiums', 'Brak ID stadionu do edycji.')
  }

  if (!name) {
    redirectWithError(`/admin/stadiums/${id}`, 'Nazwa stadionu jest wymagana.')
  }

  if (!stadiumCityId) {
    redirectWithError(`/admin/stadiums/${id}`, 'Miasto stadionu jest wymagane.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_Stadiums')
    .update({
      name,
      stadium_city_id: stadiumCityId,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      redirectWithError(`/admin/stadiums/${id}`, 'Stadion o tej nazwie już istnieje.')
    }

    redirectWithError(`/admin/stadiums/${id}`, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  redirectWithSaved(`/admin/stadiums/${id}`)
}

export async function deleteStadium(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/stadiums', 'Brak ID stadionu do usunięcia.')
  }

  const supabase = createServiceRoleClient()

  const { data: stadium } = await supabase
    .from('tbl_Stadiums')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('tbl_Stadiums').delete().eq('id', id)

  if (error) {
    redirectWithError(
      `/admin/stadiums/${id}`,
      error.code === '23503'
        ? 'Nie można usunąć stadionu — jest powiązany z innymi danymi.'
        : 'Wystąpił błąd bazy danych. Spróbuj ponownie.'
    )
  }

  redirectWithAdded('/admin/stadiums', `Usunięto stadion: ${stadium?.name ?? id}`)
}


