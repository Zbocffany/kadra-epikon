import { createServiceRoleClient } from '@/lib/supabase/server'

export type AdminCountry = {
  id: string
  name: string
  fifa_code: string | null
  federation_short_name: string | null
}

export type AdminCountryDetails = {
  id: string
  name: string
  fifa_code: string | null
  federation_id: string | null
  federation_short_name: string | null
}

export type AdminFederation = {
  id: string
  short_name: string
}

export async function getAdminCountries(): Promise<AdminCountry[]> {
  const supabase = createServiceRoleClient()

  const { data: countries, error: countriesError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code, federation_id')
    .order('name', { ascending: true })

  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
  if (!countries?.length) return []

  const federationIds = [
    ...new Set(countries.map((c) => c.federation_id).filter(Boolean)),
  ]

  let federationMap = new Map<string, string>()

  if (federationIds.length) {
    const { data: federations, error: federationError } = await supabase
      .from('tbl_Federations')
      .select('id, short_name')
      .in('id', federationIds)

    if (federationError) {
      throw new Error(`tbl_Federations: ${federationError.message}`)
    }

    federationMap = new Map((federations ?? []).map((f) => [f.id, f.short_name]))
  }

  return countries.map((c) => ({
    id: c.id,
    name: c.name,
    fifa_code: c.fifa_code,
    federation_short_name: c.federation_id
      ? (federationMap.get(c.federation_id) ?? null)
      : null,
  }))
}

export async function getAdminFederations(): Promise<AdminFederation[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Federations')
    .select('id, short_name')
    .order('short_name', { ascending: true })

  if (error) throw new Error(`tbl_Federations: ${error.message}`)
  return data ?? []
}

export async function getAdminCountryDetails(
  id: string
): Promise<AdminCountryDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: country, error: countryError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code, federation_id')
    .eq('id', id)
    .maybeSingle()

  if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
  if (!country) return null

  let federationShortName: string | null = null

  if (country.federation_id) {
    const { data: federation, error: federationError } = await supabase
      .from('tbl_Federations')
      .select('short_name')
      .eq('id', country.federation_id)
      .maybeSingle()

    if (federationError) {
      throw new Error(`tbl_Federations: ${federationError.message}`)
    }

    federationShortName = federation?.short_name ?? null
  }

  return {
    id: country.id,
    name: country.name,
    fifa_code: country.fifa_code,
    federation_id: country.federation_id,
    federation_short_name: federationShortName,
  }
}

export const COUNTRY_HISTORY_EVENT_TYPES = [
  { value: 'FOUNDED',      label: 'Założenie / Początek' },
  { value: 'DISSOLVED',    label: 'Rozwiązanie / Koniec' },
  { value: 'NAME_CHANGED', label: 'Zmiana nazwy' },
  { value: 'INDEPENDENCE', label: 'Niepodległość' },
  { value: 'UNIFICATION',  label: 'Zjednoczenie' },
  { value: 'PARTITION',    label: 'Podział' },
  { value: 'FIFA_JOIN',    label: 'Przystąpienie do FIFA' },
  { value: 'UEFA_JOIN',    label: 'Przystąpienie do UEFA' },
  { value: 'FIFA_LEAVE',   label: 'Wyjście / wykluczenie z FIFA' },
  { value: 'UEFA_LEAVE',   label: 'Wyjście / wykluczenie z UEFA' },
  { value: 'OTHER',        label: 'Inne' },
] as const

export type CountryHistoryEventType = typeof COUNTRY_HISTORY_EVENT_TYPES[number]['value']

export type AdminCountryHistoryEvent = {
  id: string
  event_date: string | null
  event_date_precision: 'YEAR' | 'MONTH' | 'DAY' | null
  title: string | null
  description: string | null
  event_type: CountryHistoryEventType | null
  event_order: number | null
}

export async function getCountryHistory(
  countryId: string
): Promise<AdminCountryHistoryEvent[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Country_History')
    .select('id, event_date, event_date_precision, title, description, event_type, event_order')
    .eq('country_id', countryId)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('event_order', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`tbl_Country_History: ${error.message}`)
  return data ?? []
}

export type AdminSuccessionStateEntry = {
  succession_id: string
  country_id: string
  country_name: string
  source_event_id: string | null
  effective_date: string | null
}

export type AdminSuccessionState = {
  predecessor: AdminSuccessionStateEntry | null
  successor: AdminSuccessionStateEntry | null
}

export async function getCountrySuccessionState(
  countryId: string
): Promise<AdminSuccessionState> {
  const supabase = createServiceRoleClient()

  const { data: successorRow, error: successorError } = await supabase
    .from('tbl_Successions')
    .select('id, postcountry_id, source_event_id, effective_date')
    .eq('precountry_id', countryId)
    .maybeSingle()

  const { data: predecessorRow, error: predecessorError } = await supabase
    .from('tbl_Successions')
    .select('id, precountry_id, source_event_id, effective_date')
    .eq('postcountry_id', countryId)
    .maybeSingle()

  if (successorError) throw new Error(`tbl_Successions: ${successorError.message}`)
  if (predecessorError) throw new Error(`tbl_Successions: ${predecessorError.message}`)

  const countryIds = [
    successorRow?.postcountry_id,
    predecessorRow?.precountry_id,
  ].filter(Boolean) as string[]

  const countryNameMap = new Map<string, string>()

  if (countryIds.length > 0) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    ;(countries ?? []).forEach((c) => countryNameMap.set(c.id, c.name ?? '—'))
  }

  return {
    predecessor: predecessorRow
      ? {
          succession_id: predecessorRow.id,
          country_id: predecessorRow.precountry_id,
          country_name: countryNameMap.get(predecessorRow.precountry_id) ?? '—',
          source_event_id: predecessorRow.source_event_id,
          effective_date: predecessorRow.effective_date,
        }
      : null,
    successor: successorRow
      ? {
          succession_id: successorRow.id,
          country_id: successorRow.postcountry_id,
          country_name: countryNameMap.get(successorRow.postcountry_id) ?? '—',
          source_event_id: successorRow.source_event_id,
          effective_date: successorRow.effective_date,
        }
      : null,
  }
}
