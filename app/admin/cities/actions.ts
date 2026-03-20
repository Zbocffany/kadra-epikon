'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { InlineCreateState } from '@/lib/types/admin'
import { requireAdminAccess } from '@/lib/auth/admin'
import {
  getTrimmedNullable,
  getTrimmedString,
  inlineError,
  inlineSuccess,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

async function isPolandCountryId(countryId: string): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('tbl_Countries')
    .select('name, fifa_code')
    .eq('id', countryId)
    .maybeSingle()

  if (error) {
    throw new Error(`tbl_Countries: ${error.message}`)
  }

  const fifaCode = data?.fifa_code?.toUpperCase() ?? ''
  const countryName = data?.name?.trim().toLowerCase() ?? ''
  return fifaCode === 'POL' || countryName === 'polska'
}

export async function createCity(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const cityName = getTrimmedString(formData, 'city_name')
  const countryId = getTrimmedString(formData, 'country_id')
  const voivodeship = getTrimmedNullable(formData, 'voivodeship')

  if (!cityName) {
    redirectWithError('/admin/cities', 'Nazwa miasta jest wymagana.')
  }

  if (!countryId) {
    redirectWithError('/admin/cities', 'Kraj jest wymagany.')
  }

  if (voivodeship) {
    const isPoland = await isPolandCountryId(countryId)
    if (!isPoland) {
      redirectWithError('/admin/cities', 'Województwo można ustawić tylko dla miast w Polsce.')
    }
  }

  const supabase = createServiceRoleClient()
  const cityId = crypto.randomUUID()

  const { error: cityError } = await supabase.from('tbl_Cities').insert({
    id: cityId,
    city_name: cityName,
    voivodeship,
  })

  if (cityError) {
    redirectWithError('/admin/cities', `Błąd bazy danych: ${cityError.message}`)
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
    redirectWithError('/admin/cities', `Błąd relacji miasto-kraj: ${periodError.message}`)
  }

  redirectWithAdded('/admin/cities', cityName)
}

export async function createCityInline(
  prevState: InlineCreateState,
  formData: FormData
): Promise<InlineCreateState> {
  await requireAdminAccess()
  const cityName = getTrimmedString(formData, 'city_name')
  const countryId = getTrimmedString(formData, 'country_id')
  const voivodeship = getTrimmedNullable(formData, 'voivodeship')

  if (!cityName) {
    return inlineError(prevState, 'Nazwa miasta jest wymagana.')
  }

  if (!countryId) {
    return inlineError(prevState, 'Kraj jest wymagany.')
  }

  if (voivodeship) {
    try {
      const isPoland = await isPolandCountryId(countryId)
      if (!isPoland) {
        return inlineError(prevState, 'Województwo można ustawić tylko dla miast w Polsce.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany blad walidacji kraju.'
      return inlineError(prevState, message)
    }
  }

  const supabase = createServiceRoleClient()
  const cityId = crypto.randomUUID()

  const { error: cityError } = await supabase.from('tbl_Cities').insert({
    id: cityId,
    city_name: cityName,
    voivodeship,
  })

  if (cityError) {
    return inlineError(prevState, `Błąd bazy danych: ${cityError.message}`)
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
    return inlineError(prevState, `Błąd relacji miasto-kraj: ${periodError.message}`)
  }

  return inlineSuccess(prevState, cityId, cityName)
}

export async function updateCity(formData: FormData): Promise<void> {
  await requireAdminAccess()
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

  if (voivodeship) {
    const isPoland = await isPolandCountryId(countryId)
    if (!isPoland) {
      redirectWithError(`/admin/cities/${id}`, 'Województwo można ustawić tylko dla miast w Polsce.')
    }
  }

  const supabase = createServiceRoleClient()

  const { error: cityError } = await supabase
    .from('tbl_Cities')
    .update({ city_name: cityName, voivodeship: voivodeship })
    .eq('id', id)

  if (cityError) {
    redirectWithError(`/admin/cities/${id}`, `Błąd bazy danych: ${cityError.message}`)
  }

  if (currentPeriodId) {
    const { error: updatePeriodError } = await supabase
      .from('tbl_City_Country_Periods')
      .update({ country_id: countryId })
      .eq('id', currentPeriodId)

    if (updatePeriodError) {
      redirectWithError(`/admin/cities/${id}`, `Błąd relacji miasto-kraj: ${updatePeriodError.message}`)
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
      redirectWithError(`/admin/cities/${id}`, `Błąd relacji miasto-kraj: ${createPeriodError.message}`)
    }
  }

  redirectWithSaved(`/admin/cities/${id}`)
}

export async function deleteCity(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/cities', 'Brak ID miasta do usunięcia.')
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
    redirectWithError(`/admin/cities/${id}`, `Nie można usunąć relacji miasta: ${periodsError.message}`)
  }

  const { error: cityError } = await supabase.from('tbl_Cities').delete().eq('id', id)

  if (cityError) {
    redirectWithError(
      `/admin/cities/${id}`,
      `Nie można usunąć miasta (prawdopodobnie jest używane): ${cityError.message}`
    )
  }

  redirectWithAdded('/admin/cities', `Usunięto miasto: ${city?.city_name ?? id}`)
}


