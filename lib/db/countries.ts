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
