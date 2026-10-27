import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPublicCacheKey } from '@/lib/db/publicCache'
import type { StaffPayload } from '@/lib/people/publicStaffPayload'

const fetchStaffPayload = cache(async (): Promise<StaffPayload> => {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_public_staff_payload')
  if (error) throw new Error(`get_public_staff_payload: ${error.message}`)
  return data as StaffPayload
})

// Jak getPublicPlayersPayload: jedno wywołanie RPC, cache w częściach (limit 2 MB na wpis).
export async function getPublicStaffPayload(): Promise<StaffPayload> {
  const keyBase = await getPublicCacheKey('public-people', 'staff-payload')
  const options = {
    revalidate: 3600,
    tags: ['public-people', 'public-matches', 'public-cities', 'public-countries', 'public-stadiums'],
  }

  const [meta, matches, people, coachFacts, refereeFacts] = await Promise.all([
    unstable_cache(async () => {
      const payload = await fetchStaffPayload()
      return {
        polandCountryId: payload.polandCountryId,
        countries: payload.countries,
        matchCount: payload.matches.length,
        peopleCount: payload.people.length,
        coachFactCount: payload.coachFacts.length,
        refereeFactCount: payload.refereeFacts.length,
      }
    }, [...keyBase, 'meta'], options)(),
    unstable_cache(async () => (await fetchStaffPayload()).matches, [...keyBase, 'matches'], options)(),
    unstable_cache(async () => (await fetchStaffPayload()).people, [...keyBase, 'people'], options)(),
    unstable_cache(async () => (await fetchStaffPayload()).coachFacts, [...keyBase, 'coach-facts'], options)(),
    unstable_cache(async () => (await fetchStaffPayload()).refereeFacts, [...keyBase, 'referee-facts'], options)(),
  ])

  if (
    meta.matchCount !== matches.length
    || meta.peopleCount !== people.length
    || meta.coachFactCount !== coachFacts.length
    || meta.refereeFactCount !== refereeFacts.length
  ) {
    return fetchStaffPayload()
  }

  return { polandCountryId: meta.polandCountryId, countries: meta.countries, matches, people, coachFacts, refereeFacts }
}
