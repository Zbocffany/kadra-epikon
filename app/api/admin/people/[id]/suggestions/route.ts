import { type NextRequest } from 'next/server'
import { checkAdminApi } from '@/lib/auth/api'
import { getPlayerSuggestionsNearDate } from '@/lib/db/matches'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdminApi()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: personId } = await params
  const matchDate = request.nextUrl.searchParams.get('matchDate')
  const excludeMatchId = request.nextUrl.searchParams.get('excludeMatchId') ?? undefined

  if (!matchDate) {
    return Response.json({ error: 'matchDate is required' }, { status: 400 })
  }

  try {
    const suggestions = await getPlayerSuggestionsNearDate(personId, matchDate, { excludeMatchId })
    return Response.json(suggestions)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
