import { type NextRequest } from 'next/server'
import { checkAdminApi } from '@/lib/auth/api'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const session = await checkAdminApi()
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

    const supabase = createServiceRoleClient()

    type TeamRow = { id: string; country_id: string | null; club_id: string | null }
    type NamedRow = { id: string; name: string }

    // Wszystkie 3 zapytania bez .in() na listach UUID -
    // PostgREST koduje listę do query stringa, a 400+ UUID daje URL >16KB
    // co rozsadza fetch w Node/undici ("TypeError: fetch failed").
    // Dla tych rozmiarów taniej i bezpieczniej pobrać całe słowniki.
    const [teamsRes, countriesRes, clubsRes] = await Promise.all([
      supabase.from('tbl_Teams').select('id, country_id, club_id'),
      supabase.from('tbl_Countries').select('id, name'),
      supabase.from('tbl_Clubs').select('id, name'),
    ])

    if (teamsRes.error) return Response.json({ error: teamsRes.error.message }, { status: 500 })
    if (countriesRes.error) return Response.json({ error: countriesRes.error.message }, { status: 500 })
    if (clubsRes.error) return Response.json({ error: clubsRes.error.message }, { status: 500 })

    const typedTeams = (teamsRes.data ?? []) as TeamRow[]
    const countryNameById = new Map(((countriesRes.data ?? []) as NamedRow[]).map((c) => [c.id, c.name]))

    // Filter: only country teams (reprezentacje), exclude club teams
    const countryTeams = typedTeams.filter((t) => t.country_id !== null)

    const allOptions = countryTeams.map((team) => ({
      id: team.id,
      label: countryNameById.get(team.country_id!) ?? '—',
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
  } catch (err) {
    const e = err as Error & { cause?: unknown; code?: string }
    console.error('[/api/admin/teams/search] THROWN', {
      name: e.name,
      message: e.message,
      code: e.code,
      cause: e.cause,
    })
    return Response.json({ error: `${e.name}: ${e.message}` }, { status: 500 })
  }
}
