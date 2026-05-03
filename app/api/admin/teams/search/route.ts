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

  type TeamRow = { id: string; country_id: string | null; club_id: string | null }
  type NamedRow = { id: string; name: string }

  const { data: teams, error: teamsError } = await supabase
    .from('tbl_Teams')
    .select('id, country_id, club_id')
    .order('id', { ascending: true })

  if (teamsError) {
    return Response.json({ error: teamsError.message }, { status: 500 })
  }

  const typedTeams = (teams ?? []) as TeamRow[]
  const countryIds = [...new Set(typedTeams.map((t) => t.country_id).filter(Boolean))] as string[]
  const clubIds = [...new Set(typedTeams.map((t) => t.club_id).filter(Boolean))] as string[]

  const [countriesRes, clubsRes] = await Promise.all([
    countryIds.length
      ? supabase.from('tbl_Countries').select('id, name').in('id', countryIds)
      : { data: [] as NamedRow[], error: null },
    clubIds.length
      ? supabase.from('tbl_Clubs').select('id, name').in('id', clubIds)
      : { data: [] as NamedRow[], error: null },
  ])

  if (countriesRes.error) return Response.json({ error: countriesRes.error.message }, { status: 500 })
  if (clubsRes.error) return Response.json({ error: clubsRes.error.message }, { status: 500 })

  const countryNameById = new Map((countriesRes.data ?? []).map((c) => [c.id, c.name]))
  const clubNameById = new Map((clubsRes.data ?? []).map((c) => [c.id, c.name]))

  const allOptions = typedTeams.map((team) => ({
    id: team.id,
    label: team.country_id
      ? (countryNameById.get(team.country_id) ?? '—')
      : (team.club_id ? (clubNameById.get(team.club_id) ?? '—') : '—'),
  }))

  const filtered = q
    ? allOptions.filter((opt) => opt.label.toLowerCase().includes(q.toLowerCase()))
    : allOptions

  filtered.sort((a, b) => {
    if (q) {
      const aStarts = a.label.toLowerCase().startsWith(q.toLowerCase())
      const bStarts = b.label.toLowerCase().startsWith(q.toLowerCase())
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
    }
    return a.label.localeCompare(b.label, 'pl')
  })

  return Response.json(filtered.slice(0, 30))
}
