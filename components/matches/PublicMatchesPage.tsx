import MatchesListView from '@/components/matches/MatchesListView'
import PublicMatchesClient from '@/components/matches/PublicMatchesClient'
import { getPublicMatches, getMatchesYearStats, type AdminMatch, type MatchYearStatsData } from '@/lib/db/matches'
import type { RawSearchParams } from '@/lib/pagination'

type PublicMatchesPageProps = {
  searchParams: RawSearchParams
  basePath: string
  detailBasePath: string
  title?: string
}

type DecadeFilter = {
  startYear: number
  endYear: number
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
  title = 'Mecze reprezentacji',
}: PublicMatchesPageProps) {
  const period = parseSingleSearchParam(searchParams.period)
  let allMatches: AdminMatch[] = []
  let decadeFilters: DecadeFilter[] = []
  let initialPeriod = 'upcoming'
  let fetchError: string | null = null
  let yearStats: MatchYearStatsData | undefined = undefined

  try {
    allMatches = await getPublicMatches()

    const historyMatches = allMatches.filter((match) => match.match_status !== 'SCHEDULED')
    if (historyMatches.length > 0) {
      const years = historyMatches.map((match) => Number(match.match_date.slice(0, 4)))
      decadeFilters = buildDecades(Math.min(...years), Math.max(...years))
      yearStats = await getMatchesYearStats(historyMatches)
    }

    const selectedDecade = parseRequestedDecade(period, decadeFilters)
    initialPeriod = period === 'upcoming' ? 'upcoming' : (selectedDecade ? String(selectedDecade.startYear) : 'upcoming')
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
    allMatches = []
  }

  if (fetchError) {
    return (
      <MatchesListView
        title={title}
        totalMatches={0}
        matches={[]}
        fetchError={fetchError}
        detailBasePath={detailBasePath}
        showEditorialStatus={false}
      />
    )
  }

  return (
    <PublicMatchesClient
      title={title}
      basePath={basePath}
      detailBasePath={detailBasePath}
      allMatches={allMatches}
      decadeFilters={decadeFilters}
      initialPeriod={initialPeriod}
      yearStats={yearStats}
    />
  )
}