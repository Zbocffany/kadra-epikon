import Link from 'next/link'
import { createMatch } from './actions'
import MatchCreateModal from './MatchCreateModal'
import MatchesListView from '@/components/matches/MatchesListView'
import { getAdminMatchesPage, getAdminMatchCreateOptions, type AdminMatch, type AdminStadiumOption } from '@/lib/db/matches'
import { getAdminCountriesOptions, type AdminCountryOption } from '@/lib/db/cities'
import { getAdminFederations, type AdminFederation } from '@/lib/db/countries'
import { getPaginationMeta, parsePaginationParams, type RawSearchParams } from '@/lib/pagination'

type SearchParams = Promise<RawSearchParams>

export default async function AdminMatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams
  const { create, error } = resolvedSearchParams
  const { page, pageSize } = parsePaginationParams(resolvedSearchParams)
  let matches: AdminMatch[] = []
  let totalMatches = 0
  let competitionOptions: { id: string; name: string }[] = []
  let teamOptions: { id: string; label: string }[] = []
  let cityOptions: { id: string; name: string }[] = []
  let countryOptions: AdminCountryOption[] = []
  let federationOptions: AdminFederation[] = []
  let stadiumOptions: AdminStadiumOption[] = []
  let matchLevelOptions: { id: string; name: string }[] = []
  let fetchError: string | null = null

  try {
    const [fetchedMatches, options, countries, federations] = await Promise.all([
      getAdminMatchesPage(page, pageSize),
      getAdminMatchCreateOptions(),
      getAdminCountriesOptions(),
      getAdminFederations(),
    ])

    matches = fetchedMatches.items
    totalMatches = fetchedMatches.total
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

  const pagination = getPaginationMeta(totalMatches, page, pageSize)
  const isCreateModalOpen = create === '1' || Boolean(error)
  return (
    <>
      <MatchesListView
        title="Mecze"
        totalMatches={totalMatches}
        matches={matches}
        fetchError={fetchError}
        pagination={pagination}
        searchParams={resolvedSearchParams}
        basePath="/admin/matches"
        detailBasePath="/admin/matches"
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
