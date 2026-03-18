'use server'

import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'

type InlineCreateState = {
  ok: boolean
  id?: string
  label?: string
  error?: string
  version: number
}

export async function createCity(formData: FormData): Promise<void> {
  const cityName = (formData.get('city_name') as string | null)?.trim() ?? ''
  const countryId = (formData.get('country_id') as string | null)?.trim() ?? ''

  if (!cityName) {
    redirect('/admin/cities?error=' + encodeURIComponent('Nazwa miasta jest wymagana.'))
  }

  if (!countryId) {
    redirect('/admin/cities?error=' + encodeURIComponent('Kraj jest wymagany.'))
  }

  const supabase = createServiceRoleClient()
  const cityId = crypto.randomUUID()

  const { error: cityError } = await supabase.from('tbl_Cities').insert({
    id: cityId,
    city_name: cityName,
  })

  if (cityError) {
    redirect('/admin/cities?error=' + encodeURIComponent(`Blad bazy danych: ${cityError.message}`))
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
    redirect('/admin/cities?error=' + encodeURIComponent(`Blad relacji miasto-kraj: ${periodError.message}`))
  }

  redirect('/admin/cities?added=' + encodeURIComponent(cityName))
}

export async function createCityInline(
  prevState: InlineCreateState,
  formData: FormData
): Promise<InlineCreateState> {
  const cityName = (formData.get('city_name') as string | null)?.trim() ?? ''
  const countryId = (formData.get('country_id') as string | null)?.trim() ?? ''

  if (!cityName) {
    return {
      ok: false,
      error: 'Nazwa miasta jest wymagana.',
      version: prevState.version + 1,
    }
  }

  if (!countryId) {
    return {
      ok: false,
      error: 'Kraj jest wymagany.',
      version: prevState.version + 1,
    }
  }

  const supabase = createServiceRoleClient()
  const cityId = crypto.randomUUID()

  const { error: cityError } = await supabase.from('tbl_Cities').insert({
    id: cityId,
    city_name: cityName,
  })

  if (cityError) {
    return {
      ok: false,
      error: `Blad bazy danych: ${cityError.message}`,
      version: prevState.version + 1,
    }
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
    return {
      ok: false,
      error: `Blad relacji miasto-kraj: ${periodError.message}`,
      version: prevState.version + 1,
    }
  }

  return {
    ok: true,
    id: cityId,
    label: cityName,
    version: prevState.version + 1,
  }
}

export async function updateCity(formData: FormData): Promise<void> {
  const id = (formData.get('id') as string | null)?.trim() ?? ''
  const cityName = (formData.get('city_name') as string | null)?.trim() ?? ''
  const countryId = (formData.get('country_id') as string | null)?.trim() ?? ''
  const currentPeriodId =
    (formData.get('current_period_id') as string | null)?.trim() ?? ''

  if (!id) {
    redirect('/admin/cities?error=' + encodeURIComponent('Brak ID miasta do edycji.'))
  }

  if (!cityName) {
    redirect(`/admin/cities/${id}?error=` + encodeURIComponent('Nazwa miasta jest wymagana.'))
  }

  if (!countryId) {
    redirect(`/admin/cities/${id}?error=` + encodeURIComponent('Kraj jest wymagany.'))
  }

  const supabase = createServiceRoleClient()

  const { error: cityError } = await supabase
    .from('tbl_Cities')
    .update({ city_name: cityName })
    .eq('id', id)

  if (cityError) {
    redirect(
      `/admin/cities/${id}?error=` +
        encodeURIComponent(`Blad bazy danych: ${cityError.message}`)
    )
  }

  if (currentPeriodId) {
    const { error: updatePeriodError } = await supabase
      .from('tbl_City_Country_Periods')
      .update({ country_id: countryId })
      .eq('id', currentPeriodId)

    if (updatePeriodError) {
      redirect(
        `/admin/cities/${id}?error=` +
          encodeURIComponent(
            `Blad relacji miasto-kraj: ${updatePeriodError.message}`
          )
      )
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
      redirect(
        `/admin/cities/${id}?error=` +
          encodeURIComponent(
            `Blad relacji miasto-kraj: ${createPeriodError.message}`
          )
      )
    }
  }

  redirect(`/admin/cities/${id}?saved=1`)
}

export async function deleteCity(formData: FormData): Promise<void> {
  const id = (formData.get('id') as string | null)?.trim() ?? ''

  if (!id) {
    redirect('/admin/cities?error=' + encodeURIComponent('Brak ID miasta do usuniecia.'))
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
    redirect(
      `/admin/cities/${id}?error=` +
        encodeURIComponent(`Nie mozna usunac relacji miasta: ${periodsError.message}`)
    )
  }

  const { error: cityError } = await supabase.from('tbl_Cities').delete().eq('id', id)

  if (cityError) {
    redirect(
      `/admin/cities/${id}?error=` +
        encodeURIComponent(
          `Nie mozna usunac miasta (prawdopodobnie jest uzywane): ${cityError.message}`
        )
    )
  }

  redirect('/admin/cities?added=' + encodeURIComponent(`Usunieto miasto: ${city?.city_name ?? id}`))
}
