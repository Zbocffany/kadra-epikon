import { unstable_cache } from 'next/cache'
import { getPublicCacheKey } from '@/lib/db/publicCache'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type PolandCountryStatistic = {
  countryId: string
  countryName: string
  fifaCode: string | null
  matches: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

type PolandCountryStatisticRow = {
  country_id: string
  country_name: string
  fifa_code: string | null
  matches: number | string
  wins: number | string
  draws: number | string
  losses: number | string
  goals_for: number | string
  goals_against: number | string
}

async function loadPolandCountryStatistics(): Promise<PolandCountryStatistic[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_poland_country_statistics')

  if (error) throw new Error(`get_poland_country_statistics: ${error.message}`)

  return ((data ?? []) as PolandCountryStatisticRow[]).map((row) => ({
    countryId: row.country_id,
    countryName: row.country_name,
    fifaCode: row.fifa_code?.trim().toUpperCase() || null,
    matches: Number(row.matches),
    wins: Number(row.wins),
    draws: Number(row.draws),
    losses: Number(row.losses),
    goalsFor: Number(row.goals_for),
    goalsAgainst: Number(row.goals_against),
  }))
}

export async function getPublicPolandCountryStatistics(): Promise<PolandCountryStatistic[]> {
  const cacheKey = await getPublicCacheKey('public-statistics', 'poland-countries')
  return unstable_cache(
    loadPolandCountryStatistics,
    cacheKey,
    {
      revalidate: 3600,
      tags: ['public-statistics', 'public-countries'],
    },
  )()
}

async function loadPolandMatchIdsForFootballCountry(countryId: string): Promise<string[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_poland_match_ids_for_football_country', {
    p_country_id: countryId,
  })

  if (error) throw new Error(`get_poland_match_ids_for_football_country: ${error.message}`)
  return ((data ?? []) as Array<{ match_id: string }>).map((row) => row.match_id)
}

export async function getPublicPolandMatchIdsForFootballCountry(
  countryId: string,
): Promise<string[]> {
  const cacheKey = await getPublicCacheKey('public-statistics', 'country-matches', countryId)
  return unstable_cache(
    () => loadPolandMatchIdsForFootballCountry(countryId),
    cacheKey,
    {
      revalidate: 3600,
      tags: ['public-statistics', 'public-countries', `public-statistics:${countryId}`],
    },
  )()
}