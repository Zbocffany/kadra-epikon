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
    throw new Error('Błąd walidacji kraju. Spróbuj ponownie.')
  }

  const fifaCode = data?.fifa_code?.toUpperCase() ?? ''
  const countryName = data?.name?.trim().toLowerCase() ?? ''
  return fifaCode === 'POL' || countryName === 'polska'
}

export async function getCityCurrentCountry(
  cityId: string
): Promise<{ id: string; name: string } | null> {
  if (!cityId) return null
  await requireAdminAccess()
  const supabase = createServiceRoleClient()

  const { data: periods } = await supabase
    .from('tbl_City_Country_Periods')
    .select('country_id, valid_from, valid_to')
    .eq('city_id', cityId)

  if (!periods?.length) return null

  const sorted = [...periods].sort((a, b) => {
    const aCurrent = a.valid_to === null
    const bCurrent = b.valid_to === null
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1
    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : Number.NEGATIVE_INFINITY
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : Number.NEGATIVE_INFINITY
    return bTo - aTo
  })

  const countryId = sorted[0]?.country_id
  if (!countryId) return null

  const { data: country } = await supabase
    .from('tbl_Countries')
    .select('id, name')
    .eq('id', countryId)
    .maybeSingle()

  return country ? { id: country.id, name: country.name } : null
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
    redirectWithError('/admin/cities', 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
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
    redirectWithError('/admin/cities', 'Błąd zapisu powiązania miasto–kraj. Spróbuj ponownie.')
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
      const message = error instanceof Error ? error.message : 'Błąd walidacji kraju. Spróbuj ponownie.'
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
    return inlineError(prevState, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
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
    return inlineError(prevState, 'Błąd zapisu powiązania miasto–kraj. Spróbuj ponownie.')
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
    redirectWithError(`/admin/cities/${id}`, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  if (currentPeriodId) {
    const { error: updatePeriodError } = await supabase
      .from('tbl_City_Country_Periods')
      .update({ country_id: countryId })
      .eq('id', currentPeriodId)

    if (updatePeriodError) {
      redirectWithError(`/admin/cities/${id}`, 'Błąd zapisu powiązania miasto–kraj. Spróbuj ponownie.')
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
      redirectWithError(`/admin/cities/${id}`, 'Błąd zapisu powiązania miasto–kraj. Spróbuj ponownie.')
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
    redirectWithError(`/admin/cities/${id}`, 'Nie można usunąć powiązań miasta. Spróbuj ponownie.')
  }

  const { error: cityError } = await supabase.from('tbl_Cities').delete().eq('id', id)

  if (cityError) {
    redirectWithError(
      `/admin/cities/${id}`,
      cityError.code === '23503'
        ? 'Nie można usunąć miasta — jest powiązane z innymi danymi.'
        : 'Wystąpił błąd bazy danych. Spróbuj ponownie.'
    )
  }

  redirectWithAdded('/admin/cities', `Usunięto miasto: ${city?.city_name ?? id}`)
}


