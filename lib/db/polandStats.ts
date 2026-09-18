import { unstable_cache } from 'next/cache'
import { getPublicCacheKey } from '@/lib/db/publicCache'
import { createServiceRoleClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Statystyki per województwo (16 województw + 'NIEZNANE' dla reprezentantów
// urodzonych w Polsce bez znanego województwa)
// ---------------------------------------------------------------------------

export type PolandVoivodeshipStat = {
  voivodeshipCode: string
  playerCount: number
  appearanceCount: number
  goalCount: number
  yellowCardCount: number
  redCardCount: number
  clubCount: number
}

type PolandVoivodeshipStatRow = {
  voivodeship_code: string
  player_count: number | string
  appearance_count: number | string
  goal_count: number | string
  yellow_card_count: number | string
  red_card_count: number | string
  club_count: number | string
}

async function loadPolandVoivodeshipStatistics(): Promise<PolandVoivodeshipStat[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_poland_voivodeship_statistics')
  if (error) throw new Error(`get_poland_voivodeship_statistics: ${error.message}`)

  return ((data ?? []) as PolandVoivodeshipStatRow[]).map((row) => ({
    voivodeshipCode: row.voivodeship_code,
    playerCount: Number(row.player_count),
    appearanceCount: Number(row.appearance_count),
    goalCount: Number(row.goal_count),
    yellowCardCount: Number(row.yellow_card_count),
    redCardCount: Number(row.red_card_count),
    clubCount: Number(row.club_count),
  }))
}

export async function getPublicPolandVoivodeshipStatistics(): Promise<PolandVoivodeshipStat[]> {
  const cacheKey = await getPublicCacheKey('public-poland', 'voivodeship-stats')
  return unstable_cache(loadPolandVoivodeshipStatistics, cacheKey, {
    revalidate: 3600,
    tags: ['public-poland', 'public-people', 'public-matches'],
  })()
}

// ---------------------------------------------------------------------------
// Reprezentanci Polski urodzeni poza granicami kraju
// ---------------------------------------------------------------------------

export type PolandPlayerBornAbroad = {
  personId: string
  firstName: string | null
  lastName: string | null
  birthCountryId: string | null
  birthCountryName: string | null
  birthCountryFifa: string | null
  birthCityName: string | null
  appearanceCount: number
  goalCount: number
}

type PolandPlayerBornAbroadRow = {
  person_id: string
  first_name: string | null
  last_name: string | null
  birth_country_id: string | null
  birth_country_name: string | null
  birth_country_fifa: string | null
  birth_city_name: string | null
  appearance_count: number | string
  goal_count: number | string
}

async function loadPolandPlayersBornAbroad(): Promise<PolandPlayerBornAbroad[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_poland_players_born_abroad')
  if (error) throw new Error(`get_poland_players_born_abroad: ${error.message}`)

  return ((data ?? []) as PolandPlayerBornAbroadRow[]).map((row) => ({
    personId: row.person_id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthCountryId: row.birth_country_id,
    birthCountryName: row.birth_country_name,
    birthCountryFifa: row.birth_country_fifa?.trim().toUpperCase() || null,
    birthCityName: row.birth_city_name,
    appearanceCount: Number(row.appearance_count),
    goalCount: Number(row.goal_count),
  }))
}

export async function getPublicPolandPlayersBornAbroad(): Promise<PolandPlayerBornAbroad[]> {
  const cacheKey = await getPublicCacheKey('public-poland', 'players-born-abroad')
  return unstable_cache(loadPolandPlayersBornAbroad, cacheKey, {
    revalidate: 3600,
    tags: ['public-poland', 'public-people', 'public-matches'],
  })()
}

// ---------------------------------------------------------------------------
// Reprezentanci Polski bez znanego województwa urodzenia
// (urodzeni w Polsce lub bez informacji o kraju, ale brak birth_city / voivodeship).
// ---------------------------------------------------------------------------

export type PolandPlayerUnknownVoivodeship = {
  personId: string
  firstName: string | null
  lastName: string | null
  birthCityId: string | null
  birthCityName: string | null
  appearanceCount: number
  goalCount: number
}

type PolandPlayerUnknownVoivodeshipRow = {
  person_id: string
  first_name: string | null
  last_name: string | null
  birth_city_id: string | null
  birth_city_name: string | null
  appearance_count: number | string
  goal_count: number | string
}

async function loadPolandPlayersUnknownVoivodeship(): Promise<PolandPlayerUnknownVoivodeship[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_poland_players_unknown_voivodeship')
  if (error) throw new Error(`get_poland_players_unknown_voivodeship: ${error.message}`)

  return ((data ?? []) as PolandPlayerUnknownVoivodeshipRow[]).map((row) => ({
    personId: row.person_id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthCityId: row.birth_city_id,
    birthCityName: row.birth_city_name,
    appearanceCount: Number(row.appearance_count),
    goalCount: Number(row.goal_count),
  }))
}

export async function getPublicPolandPlayersUnknownVoivodeship(): Promise<PolandPlayerUnknownVoivodeship[]> {
  const cacheKey = await getPublicCacheKey('public-poland', 'players-unknown-voivodeship')
  return unstable_cache(loadPolandPlayersUnknownVoivodeship, cacheKey, {
    revalidate: 3600,
    tags: ['public-poland', 'public-people', 'public-matches'],
  })()
}
