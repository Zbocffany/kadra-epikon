import MatchesListView from '@/components/matches/MatchesListView'
import { getAdminMatchYearBounds, getAdminMatches, getMatchesYearStats, type AdminMatch, type MatchYearStatsData } from '@/lib/db/matches'
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
  let matches: AdminMatch[] = []
  let decadeFilters: DecadeFilter[] = []
  let selectedPeriod = 'upcoming'
  let fetchError: string | null = null
  let yearStats: MatchYearStatsData | undefined = undefined

  try {
    const yearBounds = await getAdminMatchYearBounds()
    decadeFilters = yearBounds ? buildDecades(yearBounds.minYear, yearBounds.maxYear) : []

    const selectedDecade = parseRequestedDecade(period, decadeFilters)
    selectedPeriod = period === 'upcoming' ? 'upcoming' : (selectedDecade ? String(selectedDecade.startYear) : 'upcoming')

    if (selectedPeriod === 'upcoming') {
      matches = await getAdminMatches({ status: 'SCHEDULED' })
    } else if (selectedDecade) {
      matches = await getAdminMatches({
        fromDate: `${selectedDecade.startYear}-01-01`,
        toDate: `${selectedDecade.endYear}-12-31`,
      })
    } else {
      matches = []
    }

    if (selectedPeriod !== 'upcoming') {
      yearStats = await getMatchesYearStats(matches)
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
    matches = []
  }

  return (
    <MatchesListView
      title={title}
      totalMatches={matches.length}
      matches={matches}
      fetchError={fetchError}
      detailBasePath={detailBasePath}
      showEditorialStatus={false}
      displayMode={selectedPeriod === 'upcoming' ? 'upcoming' : 'history'}
      yearStats={yearStats}
      leftFilters={[
        {
          key: 'upcoming',
          label: 'Najbliższe',
          href: `${basePath}?period=upcoming`,
          isActive: selectedPeriod === 'upcoming',
        },
        ...decadeFilters.map((decade) => ({
          key: String(decade.startYear),
          label: `${decade.startYear}-${decade.endYear}`,
          href: `${basePath}?period=${decade.startYear}`,
          isActive: selectedPeriod === String(decade.startYear),
        })),
      ]}
    />
  )
}