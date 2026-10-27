import { NextRequest, NextResponse } from 'next/server'
import { getPublicMatchesList, type AdminMatch, type MatchYearStatsData } from '@/lib/db/matches'

export type PublicMatchesApiResponse = {
  matches: AdminMatch[]
  yearStats: MatchYearStatsData | null
}

export async function GET(req: NextRequest): Promise<NextResponse<PublicMatchesApiResponse>> {
  const period = req.nextUrl.searchParams.get('period') ?? 'upcoming'
  const { matches: allMatches, yearStats } = await getPublicMatchesList()

  if (period === 'upcoming') {
    const matches = allMatches.filter((m) => m.match_status === 'SCHEDULED')
    return NextResponse.json({ matches, yearStats })
  }

  const startYear = Number.parseInt(period, 10)
  if (!Number.isFinite(startYear) || startYear < 1900 || startYear > 2200) {
    return NextResponse.json({ matches: [], yearStats: null }, { status: 400 })
  }

  const from = `${startYear}-01-01`
  const to = `${startYear + 9}-12-31`
  const matches = allMatches.filter((m) => m.match_date >= from && m.match_date <= to)

  return NextResponse.json({ matches, yearStats })
}
