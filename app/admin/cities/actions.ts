'use server'

import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { invalidatePublicCacheVersion } from '@/lib/db/publicCache'
import type { InlineCreateState } from '@/lib/types/admin'
import { requireAdminAccess } from '@/lib/auth/admin'
import {
  getTrimmedNullable,
  getTrimmedString,
  inlineError,
  inlineSuccess,
  inlineWarning,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

function revalidateCityCaches(cityId: string): void {
  revalidateTag('public-cities', 'max')
  revalidatePath('/admin/cities')
  revalidatePath(`/admin/cities/${cityId}`)
  revalidatePath('/cities')
  revalidatePath(`/cities/${cityId}`)
  invalidatePublicCacheVersion()
}

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

  const { data: city } = await supabase
    .from('tbl_Cities')
    .select('current_country_id')
    .eq('id', cityId)
    .maybeSingle()

  const countryId = city?.current_country_id
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
  const force = formData.get('force') === '1'

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

  if (!force) {
    const { data: existing } = await supabase
      .from('tbl_Cities')
      .select('id')
      .ilike('city_name', cityName)
    if (existing?.length) {
      redirect(`/admin/cities?create=1&warn_dup=1&pc_name=${encodeURIComponent(cityName)}`)
    }
  }

  const cityId = crypto.randomUUID()

  const { error: cityError } = await supabase.from('tbl_Cities').insert({
    id: cityId,
    city_name: cityName,
    voivodeship,
    current_country_id: countryId,
  })

  if (cityError) {
    redirectWithError('/admin/cities', 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  revalidateCityCaches(cityId)
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
  const force = getTrimmedString(formData, 'force') === '1'

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

  if (!force) {
    const { data: existing } = await supabase
      .from('tbl_Cities')
      .select('id')
      .ilike('city_name', cityName)
    if (existing?.length) {
      return inlineWarning(prevState, `Miasto "${cityName}" już istnieje w bazie. Czy na pewno chcesz dodać kolejny wpis?`)
    }
  }

  const cityId = crypto.randomUUID()

  const { error: cityError } = await supabase.from('tbl_Cities').insert({
    id: cityId,
    city_name: cityName,
    voivodeship,
    current_country_id: countryId,
  })

  if (cityError) {
    return inlineError(prevState, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  revalidateCityCaches(cityId)
  return inlineSuccess(prevState, cityId, cityName)
}

export async function updateCity(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')
  const cityName = getTrimmedString(formData, 'city_name')
  const countryId = getTrimmedString(formData, 'country_id')
  const voivodeship = getTrimmedNullable(formData, 'voivodeship')

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
    .update({ city_name: cityName, voivodeship: voivodeship, current_country_id: countryId })
    .eq('id', id)

  if (cityError) {
    redirectWithError(`/admin/cities/${id}`, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  // Jeśli miasto ma otwarty okres historyczny, zsynchronizuj jego country_id
  // (Żeby tbl_Cities.current_country_id i otwarty okres pozostawały spójne).
  // Trigger sync_city_current_country zadziała w drugą stronę i tak.
  const { data: openPeriod } = await supabase
    .from('tbl_City_Country_Periods')
    .select('id')
    .eq('city_id', id)
    .is('valid_to', null)
    .maybeSingle()

  if (openPeriod?.id) {
    const { error: updatePeriodError } = await supabase
      .from('tbl_City_Country_Periods')
      .update({ country_id: countryId })
      .eq('id', openPeriod.id)

    if (updatePeriodError) {
      redirectWithError(`/admin/cities/${id}`, 'Błąd zapisu powiązania miasto–kraj. Spróbuj ponownie.')
    }
  }

  revalidateCityCaches(id)
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

  revalidateCityCaches(id)
  redirectWithAdded('/admin/cities', `Usunięto miasto: ${city?.city_name ?? id}`)
}

export async function saveCityPeriod(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const cityId = getTrimmedString(formData, 'city_id')
  const periodId = getTrimmedNullable(formData, 'period_id')
  const countryId = getTrimmedString(formData, 'country_id')
  const validFrom = getTrimmedNullable(formData, 'valid_from')
  const validTo = getTrimmedNullable(formData, 'valid_to')
  const description = getTrimmedNullable(formData, 'description')

  if (!cityId) {
    redirectWithError('/admin/cities', 'Brak ID miasta.')
  }

  if (!countryId) {
    redirectWithError(`/admin/cities/${cityId}`, 'Kraj jest wymagany.')
  }

  const supabase = createServiceRoleClient()

  if (periodId) {
    const { error } = await supabase
      .from('tbl_City_Country_Periods')
      .update({ country_id: countryId, valid_from: validFrom, valid_to: validTo, description })
      .eq('id', periodId)

    if (error) {
      redirectWithError(`/admin/cities/${cityId}`, 'Błąd zapisu okresu. Spróbuj ponownie.')
    }
  } else {
    const { error } = await supabase.from('tbl_City_Country_Periods').insert({
      id: crypto.randomUUID(),
      city_id: cityId,
      country_id: countryId,
      valid_from: validFrom,
      valid_to: validTo,
      description,
    })

    if (error) {
      redirectWithError(`/admin/cities/${cityId}`, 'Błąd zapisu okresu. Spróbuj ponownie.')
    }
  }

  // Spójność tbl_Cities.current_country_id <-> otwarty okres pilnuje trigger
  // sync_city_current_country. Brak NULL/NULL jest egzekwowany przez CHECK
  // w tbl_City_Country_Periods (patrz migracja 038).

  revalidateCityCaches(cityId)
  redirectWithSaved(`/admin/cities/${cityId}`)
}

export async function deleteCityPeriod(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const cityId = getTrimmedString(formData, 'city_id')
  const periodId = getTrimmedString(formData, 'period_id')

  if (!cityId || !periodId) {
    redirectWithError('/admin/cities', 'Brak danych do usunięcia.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_City_Country_Periods')
    .delete()
    .eq('id', periodId)

  if (error) {
    redirectWithError(`/admin/cities/${cityId}`, 'Błąd usunięcia okresu. Spróbuj ponownie.')
  }

  revalidateCityCaches(cityId)
  redirectWithSaved(`/admin/cities/${cityId}`)
}

