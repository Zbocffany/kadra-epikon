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

export async function saveCountryHistoryEvent(formData: FormData): Promise<void> {
  const countryId = getTrimmedString(formData, 'country_id')
  const eventId = getTrimmedNullable(formData, 'event_id')
  const title = getTrimmedNullable(formData, 'title')
  const description = getTrimmedNullable(formData, 'description')
  const eventType = getTrimmedNullable(formData, 'event_type')
  const eventDateRaw = getTrimmedNullable(formData, 'event_date')
  const eventDatePrecision = getTrimmedNullable(formData, 'event_date_precision')
  const eventOrderRaw = getTrimmedNullable(formData, 'event_order')
  const predecessorId = getTrimmedNullable(formData, 'predecessor_id')
  const successorId = getTrimmedNullable(formData, 'successor_id')

  if (!countryId) redirectWithError('/admin/countries', 'Brak ID kraju.')
  if (!title) redirectWithError(`/admin/countries/${countryId}`, 'Tytul zdarzenia jest wymagany.')

  if (predecessorId && predecessorId === countryId) {
    redirectWithError(`/admin/countries/${countryId}`, 'Poprzednik nie moze byc tym samym krajem.')
  }

  if (successorId && successorId === countryId) {
    redirectWithError(`/admin/countries/${countryId}`, 'Nastepnik nie moze byc tym samym krajem.')
  }

  const eventOrder = eventOrderRaw ? parseInt(eventOrderRaw, 10) : null
  const eventDate = eventDateRaw || null
  const precision = eventDate ? (eventDatePrecision || 'DAY') : null

  const supabase = createServiceRoleClient()
  const finalEventId = eventId ?? crypto.randomUUID()

  if (eventId) {
    const { error: updateError } = await supabase
      .from('tbl_Country_History')
      .update({
        title,
        description,
        event_type: eventType,
        event_date: eventDate,
        event_date_precision: precision,
        event_order: eventOrder,
      })
      .eq('id', eventId)
      .eq('country_id', countryId)

    if (updateError) {
      redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${updateError.message}`)
    }
  } else {
    const { error: insertError } = await supabase.from('tbl_Country_History').insert({
      id: finalEventId,
      country_id: countryId,
      title,
      description,
      event_type: eventType,
      event_date: eventDate,
      event_date_precision: precision,
      event_order: eventOrder,
    })

    if (insertError) {
      redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${insertError.message}`)
    }
  }

  // Successor relation: current country -> successor (scoped to this event)
  if (successorId) {
    const { data: existingSuccessor, error: existingSuccessorError } = await supabase
      .from('tbl_Successions')
      .select('id')
      .eq('precountry_id', countryId)
      .eq('source_event_id', finalEventId)
      .maybeSingle()

    if (existingSuccessorError) {
      redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${existingSuccessorError.message}`)
    }

    if (existingSuccessor) {
      const { error: updateSuccessorError } = await supabase
        .from('tbl_Successions')
        .update({
          postcountry_id: successorId,
          source_event_id: finalEventId,
          effective_date: eventDate,
        })
        .eq('id', existingSuccessor.id)

      if (updateSuccessorError) {
        if (updateSuccessorError.code === '23505') {
          redirectWithError(`/admin/countries/${countryId}`, 'Wybrany nastepnik jest juz przypisany do innej sukcesji.')
        }
        redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${updateSuccessorError.message}`)
      }
    } else {
      const { error: insertSuccessorError } = await supabase.from('tbl_Successions').insert({
        id: crypto.randomUUID(),
        precountry_id: countryId,
        postcountry_id: successorId,
        source_event_id: finalEventId,
        effective_date: eventDate,
      })

      if (insertSuccessorError) {
        if (insertSuccessorError.code === '23505') {
          redirectWithError(`/admin/countries/${countryId}`, 'Wybrany nastepnik jest juz przypisany do innej sukcesji.')
        }
        redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${insertSuccessorError.message}`)
      }
    }
  } else {
    // Only remove successor linked to THIS event, not all successors for this country
    const { error: deleteSuccessorError } = await supabase
      .from('tbl_Successions')
      .delete()
      .eq('precountry_id', countryId)
      .eq('source_event_id', finalEventId)

    if (deleteSuccessorError) {
      redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${deleteSuccessorError.message}`)
    }
  }

  // Predecessor relation: predecessor -> current country (scoped to this event)
  if (predecessorId) {
    const { data: existingPredecessor, error: existingPredecessorError } = await supabase
      .from('tbl_Successions')
      .select('id')
      .eq('postcountry_id', countryId)
      .eq('source_event_id', finalEventId)
      .maybeSingle()

    if (existingPredecessorError) {
      redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${existingPredecessorError.message}`)
    }

    if (existingPredecessor) {
      const { error: updatePredecessorError } = await supabase
        .from('tbl_Successions')
        .update({
          precountry_id: predecessorId,
          source_event_id: finalEventId,
          effective_date: eventDate,
        })
        .eq('id', existingPredecessor.id)

      if (updatePredecessorError) {
        if (updatePredecessorError.code === '23505') {
          redirectWithError(`/admin/countries/${countryId}`, 'Wybrany poprzednik ma juz przypisanego innego sukcesora.')
        }
        redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${updatePredecessorError.message}`)
      }
    } else {
      const { error: insertPredecessorError } = await supabase.from('tbl_Successions').insert({
        id: crypto.randomUUID(),
        precountry_id: predecessorId,
        postcountry_id: countryId,
        source_event_id: finalEventId,
        effective_date: eventDate,
      })

      if (insertPredecessorError) {
        if (insertPredecessorError.code === '23505') {
          redirectWithError(`/admin/countries/${countryId}`, 'Wybrany poprzednik ma juz przypisanego innego sukcesora.')
        }
        redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${insertPredecessorError.message}`)
      }
    }
  } else {
    // Only remove predecessor linked to THIS event, not all predecessors for this country
    const { error: deletePredecessorError } = await supabase
      .from('tbl_Successions')
      .delete()
      .eq('postcountry_id', countryId)
      .eq('source_event_id', finalEventId)

    if (deletePredecessorError) {
      redirectWithError(`/admin/countries/${countryId}`, `Blad bazy danych: ${deletePredecessorError.message}`)
    }
  }

  redirectWithSaved(`/admin/countries/${countryId}`)
}

export async function deleteCountryHistoryEvent(formData: FormData): Promise<void> {
  const countryId = getTrimmedString(formData, 'country_id')
  const eventId = getTrimmedString(formData, 'event_id')

  if (!countryId || !eventId) redirectWithError('/admin/countries', 'Brak danych.')

  const supabase = createServiceRoleClient()
  const { error: deleteSuccessionsError } = await supabase
    .from('tbl_Successions')
    .delete()
    .eq('source_event_id', eventId)

  if (deleteSuccessionsError) {
    redirectWithError(`/admin/countries/${countryId}`, `Blad usuwania sukcesji: ${deleteSuccessionsError.message}`)
  }

  const { error } = await supabase
    .from('tbl_Country_History')
    .delete()
    .eq('id', eventId)
    .eq('country_id', countryId)

  if (error) {
    redirectWithError(`/admin/countries/${countryId}`, `Blad usuwania: ${error.message}`)
  }

  redirectWithSaved(`/admin/countries/${countryId}`)
}
