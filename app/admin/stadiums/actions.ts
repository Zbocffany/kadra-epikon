'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { InlineCreateState } from '@/lib/types/admin'
import {
  getTrimmedString,
  inlineError,
  inlineSuccess,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

export async function createStadium(formData: FormData): Promise<void> {
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
      redirectWithError('/admin/stadiums', 'Stadion o tej nazwie juz istnieje.')
    }

    redirectWithError('/admin/stadiums', `Blad bazy danych: ${error.message}`)
  }

  redirectWithAdded('/admin/stadiums', name)
}

export async function createStadiumInline(
  prevState: InlineCreateState,
  formData: FormData
): Promise<InlineCreateState> {
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

  const { error } = await supabase.from('tbl_Stadiums').insert({
    id,
    name,
    stadium_city_id: stadiumCityId,
  })

  if (error) {
    if (error.code === '23505') {
      return inlineError(prevState, 'Stadion o tej nazwie juz istnieje.')
    }

    return inlineError(prevState, `Blad bazy danych: ${error.message}`)
  }

  return inlineSuccess(prevState, id, name)
}

export async function updateStadium(formData: FormData): Promise<void> {
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
      redirectWithError(`/admin/stadiums/${id}`, 'Stadion o tej nazwie juz istnieje.')
    }

    redirectWithError(`/admin/stadiums/${id}`, `Blad bazy danych: ${error.message}`)
  }

  redirectWithSaved(`/admin/stadiums/${id}`)
}

export async function deleteStadium(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/stadiums', 'Brak ID stadionu do usuniecia.')
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
      `Nie mozna usunac stadionu (prawdopodobnie jest uzywany): ${error.message}`
    )
  }

  redirectWithAdded('/admin/stadiums', `Usunieto stadion: ${stadium?.name ?? id}`)
}
