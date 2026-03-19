'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
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

export async function createCity(formData: FormData): Promise<void> {
  const cityName = getTrimmedString(formData, 'city_name')
  const countryId = getTrimmedString(formData, 'country_id')

  if (!cityName) {
    redirectWithError('/admin/cities', 'Nazwa miasta jest wymagana.')
  }

  if (!countryId) {
    redirectWithError('/admin/cities', 'Kraj jest wymagany.')
  }

  const supabase = createServiceRoleClient()
  const cityId = crypto.randomUUID()

  const { error: cityError } = await supabase.from('tbl_Cities').insert({
    id: cityId,
    city_name: cityName,
  })

  if (cityError) {
    redirectWithError('/admin/cities', `Blad bazy danych: ${cityError.message}`)
  }

  const { error: periodError } = await supabase.from('tbl_City_Country_Periods').insert({
    id: crypto.randomUUID(),
    city_id: cityId,
    country_id: countryId,
    valid_from: null,
    valid_to: null,
    description: 'Dodane z panelu admina',
  })

  if (periodError) {
    // Best effort cleanup when linking country fails after city insert.
    await supabase.from('tbl_Cities').delete().eq('id', cityId)
    redirectWithError('/admin/cities', `Blad relacji miasto-kraj: ${periodError.message}`)
  }

  redirectWithAdded('/admin/cities', cityName)
}

export async function createCityInline(
  prevState: InlineCreateState,
  formData: FormData
): Promise<InlineCreateState> {
  const cityName = getTrimmedString(formData, 'city_name')
  const countryId = getTrimmedString(formData, 'country_id')

  if (!cityName) {
    return inlineError(prevState, 'Nazwa miasta jest wymagana.')
  }

  if (!countryId) {
    return inlineError(prevState, 'Kraj jest wymagany.')
  }

  const supabase = createServiceRoleClient()
  const cityId = crypto.randomUUID()

  const { error: cityError } = await supabase.from('tbl_Cities').insert({
    id: cityId,
    city_name: cityName,
  })

  if (cityError) {
    return inlineError(prevState, `Blad bazy danych: ${cityError.message}`)
  }

  const { error: periodError } = await supabase.from('tbl_City_Country_Periods').insert({
    id: crypto.randomUUID(),
    city_id: cityId,
    country_id: countryId,
    valid_from: null,
    valid_to: null,
    description: 'Dodane z panelu admina',
  })

  if (periodError) {
    await supabase.from('tbl_Cities').delete().eq('id', cityId)
    return inlineError(prevState, `Blad relacji miasto-kraj: ${periodError.message}`)
  }

  return inlineSuccess(prevState, cityId, cityName)
}

export async function updateCity(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')
  const cityName = getTrimmedString(formData, 'city_name')
  const countryId = getTrimmedString(formData, 'country_id')
  const voivodeship = getTrimmedNullable(formData, 'voivodeship')
  const currentPeriodId = getTrimmedString(formData, 'current_period_id')

  if (!id) {
    redirectWithError('/admin/cities', 'Brak ID miasta do edycji.')
  }

  if (!cityName) {
    redirectWithError(`/admin/cities/${id}`, 'Nazwa miasta jest wymagana.')
  }

  if (!countryId) {
    redirectWithError(`/admin/cities/${id}`, 'Kraj jest wymagany.')
  }

  const supabase = createServiceRoleClient()

  const { error: cityError } = await supabase
    .from('tbl_Cities')
    .update({ city_name: cityName, voivodeship: voivodeship })
    .eq('id', id)

  if (cityError) {
    redirectWithError(`/admin/cities/${id}`, `Blad bazy danych: ${cityError.message}`)
  }

  if (currentPeriodId) {
    const { error: updatePeriodError } = await supabase
      .from('tbl_City_Country_Periods')
      .update({ country_id: countryId })
      .eq('id', currentPeriodId)

    if (updatePeriodError) {
      redirectWithError(`/admin/cities/${id}`, `Blad relacji miasto-kraj: ${updatePeriodError.message}`)
    }
  } else {
    const { error: createPeriodError } = await supabase
      .from('tbl_City_Country_Periods')
      .insert({
        id: crypto.randomUUID(),
        city_id: id,
        country_id: countryId,
        valid_from: null,
        valid_to: null,
        description: 'Dodane z panelu admina',
      })

    if (createPeriodError) {
      redirectWithError(`/admin/cities/${id}`, `Blad relacji miasto-kraj: ${createPeriodError.message}`)
    }
  }

  redirectWithSaved(`/admin/cities/${id}`)
}

export async function deleteCity(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/cities', 'Brak ID miasta do usuniecia.')
  }

  const supabase = createServiceRoleClient()

  const { data: city } = await supabase
    .from('tbl_Cities')
    .select('city_name')
    .eq('id', id)
    .maybeSingle()

  const { error: periodsError } = await supabase
    .from('tbl_City_Country_Periods')
    .delete()
    .eq('city_id', id)

  if (periodsError) {
    redirectWithError(`/admin/cities/${id}`, `Nie mozna usunac relacji miasta: ${periodsError.message}`)
  }

  const { error: cityError } = await supabase.from('tbl_Cities').delete().eq('id', id)

  if (cityError) {
    redirectWithError(
      `/admin/cities/${id}`,
      `Nie mozna usunac miasta (prawdopodobnie jest uzywane): ${cityError.message}`
    )
  }

  redirectWithAdded('/admin/cities', `Usunieto miasto: ${city?.city_name ?? id}`)
}
