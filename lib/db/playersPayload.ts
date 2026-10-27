import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPublicCacheKey } from '@/lib/db/publicCache'
import type { PlayersPayload } from '@/lib/players/publicPlayersPayload'

const fetchPlayersPayload = cache(async (): Promise<PlayersPayload> => {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_public_players_payload')
  if (error) throw new Error(`get_public_players_payload: ${error.message}`)
  return data as PlayersPayload
})

// Paczka z jednego wywołania RPC, ale w cache w czterech częściach,
// żeby każda mieściła się w limicie 2 MB na wpis unstable_cache.
export async function getPublicPlayersPayload(): Promise<PlayersPayload> {
  const keyBase = await getPublicCacheKey('public-people', 'players-payload')
  const options = {
    revalidate: 3600,
    tags: ['public-people', 'public-matches', 'public-cities', 'public-countries', 'public-stadiums'],
  }

  const [meta, matches, people, facts] = await Promise.all([
    unstable_cache(async () => {
      const payload = await fetchPlayersPayload()
      return {
        polandCountryId: payload.polandCountryId,
        countries: payload.countries,
        matchCount: payload.matches.length,
        peopleCount: payload.people.length,
        factCount: payload.facts.length,
      }
    }, [...keyBase, 'meta'], options)(),
    unstable_cache(async () => (await fetchPlayersPayload()).matches, [...keyBase, 'matches'], options)(),
    unstable_cache(async () => (await fetchPlayersPayload()).people, [...keyBase, 'people'], options)(),
    unstable_cache(async () => (await fetchPlayersPayload()).facts, [...keyBase, 'facts'], options)(),
  ])

  // Części z różnych przeliczeń mają inne indeksy — wtedy bierzemy świeżą paczkę w całości.
  if (meta.matchCount !== matches.length || meta.peopleCount !== people.length || meta.factCount !== facts.length) {
    return fetchPlayersPayload()
  }

  return { polandCountryId: meta.polandCountryId, countries: meta.countries, matches, people, facts }
}
