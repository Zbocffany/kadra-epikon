import { type NextRequest } from 'next/server'
import { checkAdminApi } from '@/lib/auth/api'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const session = await checkAdminApi()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  const supabase = createServiceRoleClient()
  type PersonRow = { id: string; first_name: string | null; last_name: string | null; nickname: string | null; birth_date: string | null }

  const query = supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date')
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true, nullsFirst: false })
    .limit(50)

  const { data, error } = q
    ? await query.or(
        `last_name.ilike.%${q}%,first_name.ilike.%${q}%,nickname.ilike.%${q}%`
      )
    : await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const personIds = ((data ?? []) as PersonRow[]).map((p) => p.id)
  
  // Fetch represented countries for all people
  let representedCountriesByPersonId = new Map<string, string | null>()
  if (personIds.length > 0) {
    const { data: countryLinks, error: linksError } = await supabase
      .from('tbl_Person_Countries')
      .select('person_id, country_id')
      .in('person_id', personIds)

    if (!linksError && countryLinks) {
      const countryIds = [...new Set(countryLinks.map((link) => link.country_id).filter(Boolean))]
      if (countryIds.length > 0) {
        const { data: countries } = await supabase
          .from('tbl_Countries')
          .select('id, fifa_code')
          .in('id', countryIds)

        const countryFifaCodeById = new Map((countries ?? []).map((c) => [c.id, c.fifa_code ?? null]))
        
        // For each person, take the first (primary) represented country
        for (const link of countryLinks) {
          if (!representedCountriesByPersonId.has(link.person_id)) {
            representedCountriesByPersonId.set(link.person_id, countryFifaCodeById.get(link.country_id) ?? null)
          }
        }
      }
    }
  }

  const results = ((data ?? []) as PersonRow[]).map((person) => {
    const first = person.first_name?.trim() ?? ''
    const last = person.last_name?.trim() ?? ''
    const nickname = person.nickname?.trim() ?? ''
    const fullName = `${first} ${last}`.trim()
    const label = (fullName && nickname) ? nickname : (nickname || fullName || '—')

    return {
      id: person.id,
      label,
      firstName: first,
      lastName: last,
      nickname,
      birth_date: person.birth_date ?? null,
      represented_country_fifa_code: representedCountriesByPersonId.get(person.id) ?? null,
    }
  })

  return Response.json(results)
}
