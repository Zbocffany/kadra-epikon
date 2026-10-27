import Link from 'next/link'
import { createMatch } from './actions'
import MatchCreateModal from './MatchCreateModal'
import AdminMatchesClient from './AdminMatchesClient'
import MatchesListView from '@/components/matches/MatchesListView'
import {
  getAdminMatchesList,
  getAdminMatchCreateOptions,
  type AdminMatch,
  type AdminStadiumOption,
  type MatchYearStatsData,
} from '@/lib/db/matches'
import { getAdminCountriesOptions, type AdminCountryOption } from '@/lib/db/cities'
import { getAdminFederations, type AdminFederation } from '@/lib/db/countries'
import type { RawSearchParams } from '@/lib/pagination'

type SearchParams = Promise<RawSearchParams>

function parseSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminMatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams
  const { create, error } = resolvedSearchParams
  const period = parseSingleSearchParam(resolvedSearchParams.period)
  const isCreateModalOpen = create === '1' || Boolean(error)

  let matches: AdminMatch[] = []
  let yearStats: MatchYearStatsData = { coaches: {}, topAppearances: {}, topScorers: {} }
  let competitionOptions: { id: string; name: string }[] = []
  let teamOptions: { id: string; label: string }[] = []
  let cityOptions: { id: string; name: string; current_country_fifa_code: string | null }[] = []
  let countryOptions: AdminCountryOption[] = []
  let federationOptions: AdminFederation[] = []
  let stadiumOptions: AdminStadiumOption[] = []
  let matchLevelOptions: { id: string; name: string }[] = []
  let fetchError: string | null = null

  try {
    const [list, options, countries, federations] = await Promise.all([
      getAdminMatchesList(),
      isCreateModalOpen ? getAdminMatchCreateOptions() : Promise.resolve(null),
      isCreateModalOpen ? getAdminCountriesOptions() : Promise.resolve([]),
      isCreateModalOpen ? getAdminFederations() : Promise.resolve([]),
    ])

    matches = list.matches
    yearStats = list.yearStats
    if (options) {
      competitionOptions = options.competitions
      teamOptions = options.teams
      cityOptions = options.cities
      stadiumOptions = options.stadiums
      matchLevelOptions = options.matchLevels
    }
    countryOptions = countries
    federationOptions = federations
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const headerActions = (
    <Link
      href="/admin/matches?create=1"
      className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
    >
      Dodaj mecz
    </Link>
  )

  return (
    <>
      {fetchError ? (
        <MatchesListView
          title="Mecze"
          totalMatches={0}
          matches={[]}
          fetchError={fetchError}
          detailBasePath="/admin/matches"
          headerActions={headerActions}
        />
      ) : (
        <AdminMatchesClient
          matches={matches}
          yearStats={yearStats}
          initialPeriod={period}
          headerActions={headerActions}
        />
      )}

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
