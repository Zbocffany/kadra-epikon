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
  type PersonRow = { id: string; first_name: string | null; last_name: string | null; nickname: string | null }

  const query = supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname')
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
    }
  })

  return Response.json(results)
}
