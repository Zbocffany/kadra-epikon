'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdminAccess } from '@/lib/auth/admin'
import { getTrimmedNullable, getTrimmedString, redirectWithAdded, redirectWithError, redirectWithSaved } from '@/lib/actions/admin'
import { findDuplicatePeopleByBirthDateAndCountry, type DuplicatePerson } from '@/lib/db/people'

export async function checkDuplicatePeople(
  birthDate: string | null,
  birthCityId: string | null,
  birthCountryId: string | null
): Promise<DuplicatePerson[]> {
  await requireAdminAccess()
  if (!birthDate) return []
  const supabase = createServiceRoleClient()
  const resolvedCountryId = await resolveBirthCountryId(birthCityId, birthCountryId, supabase)
  if (!resolvedCountryId) return []
  return findDuplicatePeopleByBirthDateAndCountry(birthDate.trim(), resolvedCountryId)
}

async function resolveBirthCountryId(
  birthCityId: string | null,
  birthCountryId: string | null,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<string | null> {
  if (!birthCityId) {
    return birthCountryId
  }

  const { data: periods, error: periodsError } = await supabase
    .from('tbl_City_Country_Periods')
    .select('country_id, valid_from, valid_to')
    .eq('city_id', birthCityId)

  if (periodsError) {
    throw new Error('Błąd odczytu danych miasta. Spróbuj ponownie.')
  }

  const sortedPeriods = [...(periods ?? [])].sort((a, b) => {
    const aCurrent = a.valid_to === null
    const bCurrent = b.valid_to === null

    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1

    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : Number.NEGATIVE_INFINITY
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : Number.NEGATIVE_INFINITY
    if (aTo !== bTo) return bTo - aTo

    const aFrom = a.valid_from ? new Date(a.valid_from).getTime() : Number.NEGATIVE_INFINITY
    const bFrom = b.valid_from ? new Date(b.valid_from).getTime() : Number.NEGATIVE_INFINITY
    return bFrom - aFrom
  })

  return sortedPeriods[0]?.country_id ?? birthCountryId
}

function ensureAnyName(firstName: string | null, lastName: string | null, nickname: string | null): boolean {
  return Boolean(firstName || lastName || nickname)
}

async function syncPersonRepresentedCountries(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personId: string,
  representedCountryIds: string[]
): Promise<void> {
  const uniqueCountryIds = [...new Set(representedCountryIds.filter(Boolean))]

  if (uniqueCountryIds.length > 0) {
    const { data: existingCountries, error: existingCountriesError } = await supabase
      .from('tbl_Countries')
      .select('id')
      .in('id', uniqueCountryIds)

    if (existingCountriesError) {
      throw new Error('Błąd odczytu krajów reprezentacji. Spróbuj ponownie.')
    }

    if ((existingCountries ?? []).length !== uniqueCountryIds.length) {
      throw new Error('Wybrano nieprawidłowy kraj reprezentacji.')
    }
  }

  const { error: deleteLinksError } = await supabase
    .from('tbl_Person_Countries')
    .delete()
    .eq('person_id', personId)

  if (deleteLinksError) {
    throw new Error('Nie udało się zapisać krajów reprezentacji.')
  }

  if (uniqueCountryIds.length === 0) {
    return
  }

  const { error: insertLinksError } = await supabase
    .from('tbl_Person_Countries')
    .insert(uniqueCountryIds.map((countryId) => ({
      person_id: personId,
      country_id: countryId,
    })))

  if (insertLinksError) {
    throw new Error('Nie udało się zapisać krajów reprezentacji.')
  }
}

export async function createPerson(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const firstName = getTrimmedNullable(formData, 'first_name')
  const lastName = getTrimmedNullable(formData, 'last_name')
  const nickname = getTrimmedNullable(formData, 'nickname')
  const birthDate = getTrimmedNullable(formData, 'birth_date')
  const birthCityId = getTrimmedNullable(formData, 'birth_city_id')
  const birthCountryRaw = getTrimmedNullable(formData, 'birth_country_id')
  const representedCountryIds = formData
    .getAll('represented_country_ids')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
  const isActive = getTrimmedString(formData, 'is_active') === 'on'

  if (!ensureAnyName(firstName, lastName, nickname)) {
    redirectWithError('/admin/people', 'Podaj przynajmniej jedno z pól: imię, nazwisko lub pseudonim.')
  }

  const supabase = createServiceRoleClient()
  let birthCountryId: string | null

  try {
    birthCountryId = await resolveBirthCountryId(birthCityId, birthCountryRaw, supabase)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udalo sie ustalic kraju urodzenia.'
    redirectWithError('/admin/people', message)
  }

  const personId = crypto.randomUUID()

  const { error } = await supabase.from('tbl_People').insert({
    id: personId,
    first_name: firstName,
    last_name: lastName,
    nickname,
    birth_date: birthDate,
    birth_city_id: birthCityId,
    birth_country_id: birthCountryId,
    is_active: isActive,
  })

  if (error) {
    redirectWithError('/admin/people', 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  try {
    await syncPersonRepresentedCountries(supabase, personId, representedCountryIds)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udało się zapisać krajów reprezentacji.'
    redirectWithError('/admin/people', message)
  }

  const label = [firstName, lastName].filter(Boolean).join(' ').trim() || nickname || 'osoba'
  redirectWithAdded('/admin/people', label)
}

export async function updatePerson(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')
  const firstName = getTrimmedNullable(formData, 'first_name')
  const lastName = getTrimmedNullable(formData, 'last_name')
  const nickname = getTrimmedNullable(formData, 'nickname')
  const birthDate = getTrimmedNullable(formData, 'birth_date')
  const birthCityId = getTrimmedNullable(formData, 'birth_city_id')
  const birthCountryRaw = getTrimmedNullable(formData, 'birth_country_id')
  const representedCountryIds = formData
    .getAll('represented_country_ids')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
  const isActive = getTrimmedString(formData, 'is_active') === 'on'

  if (!id) {
    redirectWithError('/admin/people', 'Brak ID osoby do edycji.')
  }

  if (!ensureAnyName(firstName, lastName, nickname)) {
    redirectWithError(`/admin/people/${id}`, 'Podaj przynajmniej jedno z pól: imię, nazwisko lub pseudonim.')
  }

  const supabase = createServiceRoleClient()
  let birthCountryId: string | null

  try {
    birthCountryId = await resolveBirthCountryId(birthCityId, birthCountryRaw, supabase)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udalo sie ustalic kraju urodzenia.'
    redirectWithError(`/admin/people/${id}`, message)
  }

  const { error } = await supabase
    .from('tbl_People')
    .update({
      first_name: firstName,
      last_name: lastName,
      nickname,
      birth_date: birthDate,
      birth_city_id: birthCityId,
      birth_country_id: birthCountryId,
      is_active: isActive,
    })
    .eq('id', id)

  if (error) {
    redirectWithError(`/admin/people/${id}`, 'Wystąpił błąd bazy danych. Spróbuj ponownie.')
  }

  try {
    await syncPersonRepresentedCountries(supabase, id, representedCountryIds)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udało się zapisać krajów reprezentacji.'
    redirectWithError(`/admin/people/${id}`, message)
  }

  redirectWithSaved(`/admin/people/${id}`)
}

export async function deletePerson(formData: FormData): Promise<void> {
  await requireAdminAccess()
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/people', 'Brak ID osoby do usunięcia.')
  }

  const supabase = createServiceRoleClient()

  const { data: person } = await supabase
    .from('tbl_People')
    .select('first_name, last_name, nickname')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('tbl_People').delete().eq('id', id)

  if (error) {
    redirectWithError(
      `/admin/people/${id}`,
      error.code === '23503'
        ? 'Nie można usunąć osoby — jest powiązana z innymi danymi.'
        : 'Wystąpił błąd bazy danych. Spróbuj ponownie.'
    )
  }

  const label = [person?.first_name, person?.last_name].filter(Boolean).join(' ').trim() || person?.nickname || id
  redirectWithAdded('/admin/people', `Usunięto osóbe: ${label}`)
}


