'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { InlineCreateState } from '@/lib/types/admin'
import {
  getTrimmedNullable,
  getTrimmedString,
  inlineError,
  inlineSuccess,
  mapDbError,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

function normalizeFifaCode(raw: FormDataEntryValue | null): string | null {
  const val = (typeof raw === 'string' ? raw : '').trim().toUpperCase()
  return val ? val : null
}

export async function createCountry(formData: FormData): Promise<void> {
  const name = getTrimmedString(formData, 'name')
  const fifaCode = normalizeFifaCode(formData.get('fifa_code'))
  const federationId = getTrimmedNullable(formData, 'federation_id')

  if (!name) {
    redirectWithError('/admin/countries', 'Nazwa kraju jest wymagana.')
  }

  if (fifaCode && !/^[A-Z]{3}$/.test(fifaCode)) {
    redirectWithError('/admin/countries', 'Kod FIFA musi miec 3 wielkie litery, np. POL.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase.from('tbl_Countries').insert({
    id: crypto.randomUUID(),
    name,
    fifa_code: fifaCode,
    federation_id: federationId,
  })

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('fifa_code')) {
        redirectWithError('/admin/countries', `Kod FIFA ${fifaCode} juz istnieje.`)
      }
      redirectWithError('/admin/countries', 'Rekord z taka wartoscia juz istnieje.')
    }

    redirectWithError('/admin/countries', `Blad bazy danych: ${error.message}`)
  }

  redirectWithAdded('/admin/countries', name)
}

export async function createCountryInline(
  prevState: InlineCreateState,
  formData: FormData
): Promise<InlineCreateState> {
  const name = getTrimmedString(formData, 'name')
  const fifaCode = normalizeFifaCode(formData.get('fifa_code'))
  const federationId = getTrimmedNullable(formData, 'federation_id')

  if (!name) {
    return inlineError(prevState, 'Nazwa kraju jest wymagana.')
  }

  if (fifaCode && !/^[A-Z]{3}$/.test(fifaCode)) {
    return inlineError(prevState, 'Kod FIFA musi miec 3 wielkie litery, np. POL.')
  }

  const supabase = createServiceRoleClient()
  const id = crypto.randomUUID()

  const { error } = await supabase.from('tbl_Countries').insert({
    id,
    name,
    fifa_code: fifaCode,
    federation_id: federationId,
  })

  if (error) {
    return inlineError(prevState, mapDbError(error, 'Rekord z taka wartoscia juz istnieje.'))
  }

  return inlineSuccess(prevState, id, name)
}

export async function createFederationInline(
  prevState: InlineCreateState,
  formData: FormData
): Promise<InlineCreateState> {
  const shortName = (formData.get('short_name') as string | null)?.trim().toUpperCase() ?? ''
  const fullName = (formData.get('full_name') as string | null)?.trim() ?? ''
  const foundationYearRaw = (formData.get('foundation_year') as string | null)?.trim() ?? ''

  if (!shortName) {
    return {
      ok: false,
      error: 'Skrot federacji jest wymagany.',
      version: prevState.version + 1,
    }
  }

  if (!fullName) {
    return {
      ok: false,
      error: 'Pelna nazwa federacji jest wymagana.',
      version: prevState.version + 1,
    }
  }

  const foundationYear = foundationYearRaw ? Number(foundationYearRaw) : null
  if (foundationYearRaw && Number.isNaN(foundationYear)) {
    return {
      ok: false,
      error: 'Rok zalozenia musi byc liczba.',
      version: prevState.version + 1,
    }
  }

  const supabase = createServiceRoleClient()
  const id = crypto.randomUUID()

  const { error } = await supabase.from('tbl_Federations').insert({
    id,
    short_name: shortName,
    full_name: fullName,
    foundation_year: foundationYear,
  })

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Federacja o tym skrocie juz istnieje.'
          : `Blad bazy danych: ${error.message}`,
      version: prevState.version + 1,
    }
  }

  return {
    ok: true,
    id,
    label: shortName,
    version: prevState.version + 1,
  }
}

export async function updateCountry(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')
  const name = getTrimmedString(formData, 'name')
  const fifaCode = normalizeFifaCode(formData.get('fifa_code'))
  const federationId = getTrimmedNullable(formData, 'federation_id')

  if (!id) {
    redirectWithError('/admin/countries', 'Brak ID kraju do edycji.')
  }

  if (!name) {
    redirectWithError(`/admin/countries/${id}`, 'Nazwa kraju jest wymagana.')
  }

  if (fifaCode && !/^[A-Z]{3}$/.test(fifaCode)) {
    redirectWithError(`/admin/countries/${id}`, 'Kod FIFA musi miec 3 wielkie litery, np. POL.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_Countries')
    .update({
      name,
      fifa_code: fifaCode,
      federation_id: federationId,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      redirectWithError(`/admin/countries/${id}`, 'Rekord z taka wartoscia juz istnieje.')
    }

    redirectWithError(`/admin/countries/${id}`, `Blad bazy danych: ${error.message}`)
  }

  redirectWithSaved(`/admin/countries/${id}`)
}

export async function deleteCountry(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/countries', 'Brak ID kraju do usuniecia.')
  }

  const supabase = createServiceRoleClient()

  const { data: country } = await supabase
    .from('tbl_Countries')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('tbl_Countries').delete().eq('id', id)

  if (error) {
    redirectWithError(
      `/admin/countries/${id}`,
      `Nie mozna usunac kraju (prawdopodobnie jest uzywany): ${error.message}`
    )
  }

  redirectWithAdded('/admin/countries', `Usunieto kraj: ${country?.name ?? id}`)
}
