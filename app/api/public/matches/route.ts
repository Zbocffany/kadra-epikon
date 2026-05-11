import { NextRequest, NextResponse } from 'next/server'
import { getCachedPublicMatches, getMatchesYearStats, type AdminMatch, type MatchYearStatsData } from '@/lib/db/matches'

export type PublicMatchesApiResponse = {
  matches: AdminMatch[]
  yearStats: MatchYearStatsData | null
}

export async function GET(req: NextRequest): Promise<NextResponse<PublicMatchesApiResponse>> {
  const period = req.nextUrl.searchParams.get('period') ?? 'upcoming'
  const allPublicMatchesPromise = getCachedPublicMatches()

  if (period === 'upcoming') {
    const matches = await getCachedPublicMatches({ status: 'SCHEDULED' })
    const allPublicMatches = await allPublicMatchesPromise
    const historyMatches = allPublicMatches.filter((m) => m.match_status !== 'SCHEDULED')
    const yearStats = historyMatches.length > 0 ? await getMatchesYearStats(historyMatches) : null
    return NextResponse.json({ matches, yearStats })
  }

  const startYear = Number.parseInt(period, 10)
  if (!Number.isFinite(startYear) || startYear < 1900 || startYear > 2200) {
    return NextResponse.json({ matches: [], yearStats: null }, { status: 400 })
  }

  const matches = await getCachedPublicMatches({
    fromDate: `${startYear}-01-01`,
    toDate: `${startYear + 9}-12-31`,
  })

  const allPublicMatches = await allPublicMatchesPromise
  const historyMatches = allPublicMatches.filter((m) => m.match_status !== 'SCHEDULED')
  const yearStats = historyMatches.length > 0 ? await getMatchesYearStats(historyMatches) : null

  return NextResponse.json({ matches, yearStats })
}
