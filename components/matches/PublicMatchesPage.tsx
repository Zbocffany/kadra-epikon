import MatchesListView from '@/components/matches/MatchesListView'
import PublicMatchesClient from '@/components/matches/PublicMatchesClient'
import {
  getCachedPublicMatchYearBounds,
  getCachedPublicMatches,
  getCachedPublicMatchesYearStats,
  type AdminMatch,
  type MatchYearStatsData,
} from '@/lib/db/matches'
import type { RawSearchParams } from '@/lib/pagination'

type PublicMatchesPageProps = {
  searchParams: RawSearchParams
  basePath: string
  detailBasePath: string
  title?: string
}

const PUBLIC_CONTENT_MAX_WIDTH_CLASS = 'max-w-[74rem]'

type DecadeFilter = {
  startYear: number
  endYear: number
}

type PolandGlobalStats = {
  totalMatches: number
  wins: number
  draws: number
  losses: number
  goalsScored: number
  goalsConceded: number
}

function normalizeTeamName(name: string | null): string {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isPolandTeam(fifaCode: string | null, teamName: string | null): boolean {
  const fifa = (fifaCode ?? '').trim().toUpperCase()
  if (fifa === 'POL') return true

  const normalizedName = normalizeTeamName(teamName)
  return normalizedName.includes('polsk') || normalizedName.includes('poland')
}

function getPolandMatchOutcome(match: AdminMatch): 'WIN' | 'LOSS' | 'DRAW' | null {
  if (!match.final_score) return null

  const scoreMatch = match.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!scoreMatch) return null

  const homeGoals = Number(scoreMatch[1])
  const awayGoals = Number(scoreMatch[2])
  const isPolandHome = isPolandTeam(match.home_team_fifa_code, match.home_team_name)
  const isPolandAway = isPolandTeam(match.away_team_fifa_code, match.away_team_name)

  if (!isPolandHome && !isPolandAway) return null

  if (match.result_type === 'PENALTIES' || match.result_type === 'EXTRA_TIME_AND_PENALTIES') {
    return 'DRAW'
  }
  if (homeGoals === awayGoals) return 'DRAW'

  if (isPolandHome) return homeGoals > awayGoals ? 'WIN' : 'LOSS'
  return awayGoals > homeGoals ? 'WIN' : 'LOSS'
}

function getPolandGoals(match: AdminMatch): { scored: number; conceded: number } | null {
  if (!match.final_score) return null
  const scoreMatch = match.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!scoreMatch) return null

  const homeGoals = Number(scoreMatch[1])
  const awayGoals = Number(scoreMatch[2])
  const isPolandHome = isPolandTeam(match.home_team_fifa_code, match.home_team_name)
  const isPolandAway = isPolandTeam(match.away_team_fifa_code, match.away_team_name)

  if (!isPolandHome && !isPolandAway) return null
  return isPolandHome
    ? { scored: homeGoals, conceded: awayGoals }
    : { scored: awayGoals, conceded: homeGoals }
}

function getPolandGlobalStats(matches: AdminMatch[]): PolandGlobalStats {
  const comparableMatches = matches.filter(
    (match) =>
      match.match_status === 'FINISHED'
      && (match.editorial_status === 'COMPLETE' || match.editorial_status === 'VERIFIED')
      && match.result_type !== 'WALKOVER'
  )
  let wins = 0
  let draws = 0
  let losses = 0
  let goalsScored = 0
  let goalsConceded = 0

  for (const match of comparableMatches) {
    const outcome = getPolandMatchOutcome(match)
    if (outcome === 'WIN') wins += 1
    if (outcome === 'DRAW') draws += 1
    if (outcome === 'LOSS') losses += 1

    const goals = getPolandGoals(match)
    if (goals) {
      goalsScored += goals.scored
      goalsConceded += goals.conceded
    }
  }

  return {
    totalMatches: comparableMatches.length,
    wins,
    draws,
    losses,
    goalsScored,
    goalsConceded,
  }
}

function parseSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function decadeStartForYear(year: number): number {
  return Math.floor((year - 1) / 10) * 10 + 1
}

function buildDecades(minYear: number, maxYear: number): DecadeFilter[] {
  const firstStart = decadeStartForYear(minYear)
  const lastStart = decadeStartForYear(maxYear)
  const decades: DecadeFilter[] = []

  for (let start = firstStart; start <= lastStart; start += 10) {
    decades.push({
      startYear: start,
      endYear: start + 9,
    })
  }

  return decades.sort((a, b) => b.startYear - a.startYear)
}

function parseRequestedDecade(period: string | undefined, decades: DecadeFilter[]): DecadeFilter | null {
  if (!period) {
    return decades[0] ?? null
  }
  if (period === 'upcoming') {
    return null
  }

  const parsed = Number.parseInt(period, 10)
  if (!Number.isFinite(parsed)) {
    return decades[0] ?? null
  }

  return decades.find((decade) => decade.startYear === parsed) ?? (decades[0] ?? null)
}

export default async function PublicMatchesPage({
  searchParams,
  basePath,
  detailBasePath,
  title = 'Mecze reprezentacji Polski',
}: PublicMatchesPageProps) {
  const period = parseSingleSearchParam(searchParams.period)
  let matches: AdminMatch[] = []
  let decadeFilters: DecadeFilter[] = []
  let selectedPeriod = 'upcoming'
  let fetchError: string | null = null
  let yearStats: MatchYearStatsData | undefined = undefined
  let globalPolandStats: PolandGlobalStats | undefined = undefined

  try {
    const yearBounds = await getCachedPublicMatchYearBounds()

    if (yearBounds) {
      decadeFilters = buildDecades(yearBounds.minYear, yearBounds.maxYear)
    }

    const selectedDecade = parseRequestedDecade(period, decadeFilters)
    selectedPeriod = period === 'upcoming' ? 'upcoming' : (selectedDecade ? String(selectedDecade.startYear) : 'upcoming')

    const allPublicMatchesPromise = getCachedPublicMatches()

    if (selectedPeriod === 'upcoming') {
      matches = await getCachedPublicMatches({ status: 'SCHEDULED' })
    } else if (selectedDecade) {
      matches = await getCachedPublicMatches({
        fromDate: `${selectedDecade.startYear}-01-01`,
        toDate: `${selectedDecade.endYear}-12-31`,
      })
    }

    const allPublicMatches = await allPublicMatchesPromise
    const historyMatches = allPublicMatches.filter((match) => match.match_status !== 'SCHEDULED')
    globalPolandStats = getPolandGlobalStats(historyMatches)
    if (historyMatches.length > 0) {
      yearStats = await getCachedPublicMatchesYearStats(historyMatches)
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
    matches = []
  }

  if (fetchError) {
    return (
      <div className="public-theme">
        <MatchesListView
          title={title}
          totalMatches={0}
          matches={[]}
          fetchError={fetchError}
          detailBasePath={detailBasePath}
          maxWidthClass={PUBLIC_CONTENT_MAX_WIDTH_CLASS}
          publicUnifiedSection
          showEditorialStatus={false}
        />
      </div>
    )
  }

  return (
    <div className="public-theme">
      <PublicMatchesClient
        title={title}
        basePath={basePath}
        detailBasePath={detailBasePath}
        maxWidthClass={PUBLIC_CONTENT_MAX_WIDTH_CLASS}
        matches={matches}
        decadeFilters={decadeFilters}
        selectedPeriod={selectedPeriod}
        yearStats={yearStats}
        globalPolandStats={globalPolandStats}
      />
    </div>
  )
}