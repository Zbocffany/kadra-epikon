import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

type CityCountryPeriod = {
  city_id: string
  country_id: string
  valid_from: string | null
  valid_to: string | null
}

export type AdminPersonListItem = {
  id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  birth_date: string | null
  is_active: boolean | null
  birth_city_id: string | null
  birth_country_id: string | null
  birth_city_name: string | null
  birth_country_name: string | null
}

export type AdminPersonDetails = AdminPersonListItem

export type AdminPersonBirthCityOption = {
  id: string
  city_name: string
  current_country_id: string | null
  current_country_name: string | null
}

function sortPeriods(periods: CityCountryPeriod[]): CityCountryPeriod[] {
  return [...periods].sort((a, b) => {
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
}

function buildDisplayName(person: Pick<AdminPersonListItem, 'first_name' | 'last_name' | 'nickname'>): string {
  const first = person.first_name?.trim() ?? ''
  const last = person.last_name?.trim() ?? ''
  const nick = person.nickname?.trim() ?? ''

  const fullName = `${first} ${last}`.trim()
  if (fullName) return fullName
  if (nick) return nick
  return '—'
}

export function getPersonDisplayName(person: Pick<AdminPersonListItem, 'first_name' | 'last_name' | 'nickname'>): string {
  return buildDisplayName(person)
}

export async function getAdminPersonBirthCityOptions(): Promise<AdminPersonBirthCityOption[]> {
  const supabase = createServiceRoleClient()

  const { data: cities, error: citiesError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .order('city_name', { ascending: true })

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (!cities?.length) return []

  const cityIds = cities.map((city) => city.id)

  const { data: periods, error: periodsError } = await supabase
    .from('tbl_City_Country_Periods')
    .select('city_id, country_id, valid_from, valid_to')
    .in('city_id', cityIds)

  if (periodsError) {
    throw new Error(`tbl_City_Country_Periods: ${periodsError.message}`)
  }

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const period of periods ?? []) {
    const arr = periodsByCity.get(period.city_id) ?? []
    arr.push(period)
    periodsByCity.set(period.city_id, arr)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const best = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (best?.country_id) currentCountryIdByCity.set(cityId, best.country_id)
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryNameById = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryNameById = new Map((countries ?? []).map((country) => [country.id, country.name]))
  }

  return cities.map((city) => {
    const currentCountryId = currentCountryIdByCity.get(city.id) ?? null

    return {
      id: city.id,
      city_name: city.city_name ?? '—',
      current_country_id: currentCountryId,
      current_country_name: currentCountryId ? (countryNameById.get(currentCountryId) ?? null) : null,
    }
  })
}

export async function getAdminPeople(): Promise<AdminPersonListItem[]> {
  const supabase = createServiceRoleClient()

  const { data: people, error: peopleError } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, is_active, birth_city_id, birth_country_id')

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)
  if (!people?.length) return []

  const cityIds = [...new Set(people.map((p) => p.birth_city_id).filter(Boolean))]
  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]

  const [{ data: cities, error: citiesError }, { data: countries, error: countriesError }] =
    await Promise.all([
      cityIds.length
        ? supabase.from('tbl_Cities').select('id, city_name').in('id', cityIds)
        : Promise.resolve({ data: [] as { id: string; city_name: string | null }[], error: null }),
      countryIds.length
        ? supabase.from('tbl_Countries').select('id, name').in('id', countryIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
    ])

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))
  const countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))

  return people
    .map((person) => ({
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      nickname: person.nickname,
      birth_date: person.birth_date,
      is_active: person.is_active,
      birth_city_id: person.birth_city_id,
      birth_country_id: person.birth_country_id,
      birth_city_name: person.birth_city_id ? (cityMap.get(person.birth_city_id) ?? null) : null,
      birth_country_name: person.birth_country_id
        ? (countryMap.get(person.birth_country_id) ?? null)
        : null,
    }))
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b), 'pl'))
}

export async function getAdminPeoplePage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminPersonListItem>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: people, error: peopleError, count } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, is_active, birth_city_id, birth_country_id', {
      count: 'exact',
    })
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true, nullsFirst: false })
    .order('nickname', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)
  if (!people?.length) return { items: [], total: count ?? 0 }

  const cityIds = [...new Set(people.map((p) => p.birth_city_id).filter(Boolean))]
  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]

  const [{ data: cities, error: citiesError }, { data: countries, error: countriesError }] =
    await Promise.all([
      cityIds.length
        ? supabase.from('tbl_Cities').select('id, city_name').in('id', cityIds)
        : Promise.resolve({ data: [] as { id: string; city_name: string | null }[], error: null }),
      countryIds.length
        ? supabase.from('tbl_Countries').select('id, name').in('id', countryIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
    ])

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))
  const countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))

  return {
    items: people.map((person) => ({
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      nickname: person.nickname,
      birth_date: person.birth_date,
      is_active: person.is_active,
      birth_city_id: person.birth_city_id,
      birth_country_id: person.birth_country_id,
      birth_city_name: person.birth_city_id ? (cityMap.get(person.birth_city_id) ?? null) : null,
      birth_country_name: person.birth_country_id
        ? (countryMap.get(person.birth_country_id) ?? null)
        : null,
    })),
    total: count ?? 0,
  }
}

export async function getAdminPersonDetails(id: string): Promise<AdminPersonDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: person, error: personError } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, is_active, birth_city_id, birth_country_id')
    .eq('id', id)
    .maybeSingle()

  if (personError) throw new Error(`tbl_People: ${personError.message}`)
  if (!person) return null

  const [{ data: city, error: cityError }, { data: country, error: countryError }] = await Promise.all([
    person.birth_city_id
      ? supabase
          .from('tbl_Cities')
          .select('city_name')
          .eq('id', person.birth_city_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { city_name: string | null } | null, error: null }),
    person.birth_country_id
      ? supabase
          .from('tbl_Countries')
          .select('name')
          .eq('id', person.birth_country_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string | null } | null, error: null }),
  ])

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)
  if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)

  return {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    nickname: person.nickname,
    birth_date: person.birth_date,
    is_active: person.is_active,
    birth_city_id: person.birth_city_id,
    birth_country_id: person.birth_country_id,
    birth_city_name: city?.city_name ?? null,
    birth_country_name: country?.name ?? null,
  }
}
