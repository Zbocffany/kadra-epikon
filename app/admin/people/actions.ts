'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { getTrimmedNullable, getTrimmedString, redirectWithAdded, redirectWithError, redirectWithSaved } from '@/lib/actions/admin'

function resolveBirthCountryId(birthCityId: string | null, birthCountryId: string | null): string | null {
  // If city is set, country should be derived from the city context.
  if (birthCityId) return null
  return birthCountryId
}

function ensureAnyName(firstName: string | null, lastName: string | null, nickname: string | null): boolean {
  return Boolean(firstName || lastName || nickname)
}

export async function createPerson(formData: FormData): Promise<void> {
  const firstName = getTrimmedNullable(formData, 'first_name')
  const lastName = getTrimmedNullable(formData, 'last_name')
  const nickname = getTrimmedNullable(formData, 'nickname')
  const birthDate = getTrimmedNullable(formData, 'birth_date')
  const birthCityId = getTrimmedNullable(formData, 'birth_city_id')
  const birthCountryRaw = getTrimmedNullable(formData, 'birth_country_id')
  const birthCountryId = resolveBirthCountryId(birthCityId, birthCountryRaw)
  const isActive = getTrimmedString(formData, 'is_active') === 'on'

  if (!ensureAnyName(firstName, lastName, nickname)) {
    redirectWithError('/admin/people', 'Podaj przynajmniej jedno z pol: imie, nazwisko lub pseudonim.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase.from('tbl_People').insert({
    id: crypto.randomUUID(),
    first_name: firstName,
    last_name: lastName,
    nickname,
    birth_date: birthDate,
    birth_city_id: birthCityId,
    birth_country_id: birthCountryId,
    is_active: isActive,
  })

  if (error) {
    redirectWithError('/admin/people', `Blad bazy danych: ${error.message}`)
  }

  const label = [firstName, lastName].filter(Boolean).join(' ').trim() || nickname || 'osoba'
  redirectWithAdded('/admin/people', label)
}

export async function updatePerson(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')
  const firstName = getTrimmedNullable(formData, 'first_name')
  const lastName = getTrimmedNullable(formData, 'last_name')
  const nickname = getTrimmedNullable(formData, 'nickname')
  const birthDate = getTrimmedNullable(formData, 'birth_date')
  const birthCityId = getTrimmedNullable(formData, 'birth_city_id')
  const birthCountryRaw = getTrimmedNullable(formData, 'birth_country_id')
  const birthCountryId = resolveBirthCountryId(birthCityId, birthCountryRaw)
  const isActive = getTrimmedString(formData, 'is_active') === 'on'

  if (!id) {
    redirectWithError('/admin/people', 'Brak ID osoby do edycji.')
  }

  if (!ensureAnyName(firstName, lastName, nickname)) {
    redirectWithError(`/admin/people/${id}`, 'Podaj przynajmniej jedno z pol: imie, nazwisko lub pseudonim.')
  }

  const supabase = createServiceRoleClient()

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
    redirectWithError(`/admin/people/${id}`, `Blad bazy danych: ${error.message}`)
  }

  redirectWithSaved(`/admin/people/${id}`)
}

export async function deletePerson(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/people', 'Brak ID osoby do usuniecia.')
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
      `Nie mozna usunac osoby (prawdopodobnie jest uzywana): ${error.message}`
    )
  }

  const label = [person?.first_name, person?.last_name].filter(Boolean).join(' ').trim() || person?.nickname || id
  redirectWithAdded('/admin/people', `Usunieto osobe: ${label}`)
}
