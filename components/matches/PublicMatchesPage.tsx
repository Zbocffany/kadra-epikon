import MatchesListView from '@/components/matches/MatchesListView'
import PublicMatchesClient from '@/components/matches/PublicMatchesClient'
import {
  getCachedPublicMatchYearBounds,
  getCachedPublicMatches,
  getMatchesYearStats,
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

  try {
    const yearBounds = await getCachedPublicMatchYearBounds()

    if (yearBounds) {
      decadeFilters = buildDecades(yearBounds.minYear, yearBounds.maxYear)
    }

    const selectedDecade = parseRequestedDecade(period, decadeFilters)
    selectedPeriod = period === 'upcoming' ? 'upcoming' : (selectedDecade ? String(selectedDecade.startYear) : 'upcoming')

    if (selectedPeriod === 'upcoming') {
      matches = await getCachedPublicMatches({ status: 'SCHEDULED' })
    } else if (selectedDecade) {
      matches = await getCachedPublicMatches({
        fromDate: `${selectedDecade.startYear}-01-01`,
        toDate: `${selectedDecade.endYear}-12-31`,
      })
    }

    const historyMatches = matches.filter((match) => match.match_status !== 'SCHEDULED')
    if (historyMatches.length > 0) {
      yearStats = await getMatchesYearStats(historyMatches)
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
      />
    </div>
  )
}