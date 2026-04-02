import Link from 'next/link'
import { createMatch } from './actions'
import MatchCreateModal from './MatchCreateModal'
import MatchesListView from '@/components/matches/MatchesListView'
import {
  getAdminMatches,
  getAdminMatchCreateOptions,
  getAdminMatchYearBounds,
  type AdminMatch,
  type AdminStadiumOption,
} from '@/lib/db/matches'
import { getAdminCountriesOptions, type AdminCountryOption } from '@/lib/db/cities'
import { getAdminFederations, type AdminFederation } from '@/lib/db/countries'
import type { RawSearchParams } from '@/lib/pagination'

type SearchParams = Promise<RawSearchParams>

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

export default async function AdminMatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams
  const { create, error } = resolvedSearchParams
  const period = parseSingleSearchParam(resolvedSearchParams.period)
  let matches: AdminMatch[] = []
  let competitionOptions: { id: string; name: string }[] = []
  let teamOptions: { id: string; label: string }[] = []
  let cityOptions: { id: string; name: string }[] = []
  let countryOptions: AdminCountryOption[] = []
  let federationOptions: AdminFederation[] = []
  let stadiumOptions: AdminStadiumOption[] = []
  let matchLevelOptions: { id: string; name: string }[] = []
  let decadeFilters: DecadeFilter[] = []
  let selectedPeriod = 'upcoming'
  let fetchError: string | null = null

  try {
    const [yearBounds, options, countries, federations] = await Promise.all([
      getAdminMatchYearBounds(),
      getAdminMatchCreateOptions(),
      getAdminCountriesOptions(),
      getAdminFederations(),
    ])

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

    competitionOptions = options.competitions
    teamOptions = options.teams
    cityOptions = options.cities
    countryOptions = countries
    federationOptions = federations
    stadiumOptions = options.stadiums
    matchLevelOptions = options.matchLevels
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
    matches = []
  }

  const isCreateModalOpen = create === '1' || Boolean(error)
  return (
    <>
      <MatchesListView
        title="Mecze"
        totalMatches={matches.length}
        matches={matches}
        fetchError={fetchError}
        detailBasePath="/admin/matches"
        displayMode={selectedPeriod === 'upcoming' ? 'upcoming' : 'history'}
        leftFilters={[
          {
            key: 'upcoming',
            label: 'Najbliższe',
            href: '/admin/matches?period=upcoming',
            isActive: selectedPeriod === 'upcoming',
          },
          ...decadeFilters.map((decade) => ({
            key: String(decade.startYear),
            label: `${decade.startYear}-${decade.endYear}`,
            href: `/admin/matches?period=${decade.startYear}`,
            isActive: selectedPeriod === String(decade.startYear),
          })),
        ]}
        headerActions={(
          <Link
            href="/admin/matches?create=1"
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
          >
            Dodaj mecz
          </Link>
        )}
      />

      {isCreateModalOpen && !fetchError ? (
        <MatchCreateModal
          competitions={competitionOptions}
          matchLevels={matchLevelOptions}
          teams={teamOptions}
          cities={cityOptions}
          countries={countryOptions}
          federations={federationOptions}
          stadiums={stadiumOptions}
          createAction={createMatch}
        />
      ) : null}
    </>
  )
}
