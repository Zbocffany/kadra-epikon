import { createServiceRoleClient } from '@/lib/supabase/server'

export type AdminClub = {
  id: string
  name: string
  city_name: string | null
}

export type AdminCity = {
  id: string
  city_name: string
}

export async function getAdminClubs(): Promise<AdminClub[]> {
  const supabase = createServiceRoleClient()

  const { data: clubs, error: clubsError } = await supabase
    .from('tbl_Clubs')
    .select('id, name, club_city_id')
    .order('name', { ascending: true })

  if (clubsError) throw new Error(`tbl_Clubs: ${clubsError.message}`)
  if (!clubs?.length) return []

  const cityIds = [...new Set(clubs.map((c) => c.club_city_id).filter(Boolean))]

  if (!cityIds.length) {
    return clubs.map((c) => ({ id: c.id, name: c.name, city_name: null }))
  }

  const { data: cities, error: citiesError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .in('id', cityIds)

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))

  return clubs.map((c) => ({
    id: c.id,
    name: c.name,
    city_name: c.club_city_id ? (cityMap.get(c.club_city_id) ?? null) : null,
  }))
}

export async function getAdminCities(): Promise<AdminCity[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .order('city_name', { ascending: true })

  if (error) throw new Error(`tbl_Cities: ${error.message}`)
  return data ?? []
}
