import Link from 'next/link'
import { createMatch } from './actions'
import MatchCreateModal from './MatchCreateModal'
import AdminPagination from '@/components/admin/AdminPagination'
import { getAdminMatchesPage } from '@/lib/db/matches'
import { getAdminMatchCreateOptions } from '@/lib/db/matches'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import { getAdminFederations, type AdminFederation } from '@/lib/db/countries'
import type { AdminMatch, AdminStadiumOption, EditorialStatus } from '@/lib/db/matches'
import type { AdminCountryOption } from '@/lib/db/cities'
import { getPaginationMeta, parsePaginationParams, type RawSearchParams } from '@/lib/pagination'

type SearchParams = Promise<RawSearchParams>

function EditorialStatusBadge({ status }: { status: EditorialStatus }) {
  const styles: Record<string, string> = {
    DRAFT:    'bg-neutral-800    text-neutral-400  ring-neutral-600',
    PARTIAL:  'bg-amber-900/50   text-amber-300    ring-amber-700',
    COMPLETE: 'bg-blue-900/50    text-blue-300     ring-blue-700',
    VERIFIED: 'bg-emerald-900/50 text-emerald-300  ring-emerald-700',
  }
  const cls = styles[status] ?? 'bg-neutral-800 text-neutral-400 ring-neutral-600'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  )
}

function formatDate(dateStr: string) {
  // dateStr is a plain date from Postgres: 'YYYY-MM-DD'
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function getCompetitionDisplay(name: string): { label: string; fullName: string; isCompact: boolean } {
  const normalized = name.trim()

  if (normalized === 'Mistrzostwa Świata') {
    return { label: 'MŚ', fullName: normalized, isCompact: false }
  }
  if (normalized === 'Mistrzostwa Europy') {
    return { label: 'ME', fullName: normalized, isCompact: false }
  }
  if (normalized === 'Liga Narodów') {
    return { label: 'LN', fullName: normalized, isCompact: false }
  }
  if (normalized === 'Nieoficjalny') {
    return { label: 'NO', fullName: normalized, isCompact: false }
  }
  if (normalized === 'Towarzyski') {
    return { label: normalized, fullName: normalized, isCompact: true }
  }

  return { label: normalized, fullName: normalized, isCompact: false }
}

function getCompetitionLevelTooltip(competitionName: string, matchLevelName: string | null): string {
  if (!matchLevelName || competitionName === 'Towarzyski' || competitionName === 'Nieoficjalny') {
    return competitionName
  }

  return `${competitionName} - ${matchLevelName}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminMatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams
  const { create, error } = resolvedSearchParams
  const { page, pageSize } = parsePaginationParams(resolvedSearchParams)
  let matches: AdminMatch[]
  let totalMatches = 0
  let competitionOptions: { id: string; name: string }[] = []
  let teamOptions: { id: string; label: string }[] = []
  let cityOptions: { id: string; name: string }[] = []
  let countryOptions: AdminCountryOption[] = []
  let federationOptions: AdminFederation[] = []
  let stadiumOptions: AdminStadiumOption[] = []
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
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
    matches = []
  }

  const pagination = getPaginationMeta(totalMatches, page, pageSize)
  const isCreateModalOpen = create === '1' || Boolean(error)

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Admin
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Mecze
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/matches?create=1"
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
            >
              Dodaj mecz
            </Link>
            <span className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
              {totalMatches} {totalMatches === 1 ? 'mecz' : 'meczów'}
            </span>
          </div>
        </div>

        {/* Error state */}
        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
            <strong className="font-semibold">Błąd pobierania danych:</strong>{' '}
            {fetchError}
          </div>
        )}

        {/* Empty state */}
        {!fetchError && matches.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-6 py-16 text-center text-neutral-500">
            Brak meczów w bazie danych.
          </div>
        )}

        {/* Table */}
        {matches.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full border-collapse text-sm table-auto">
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                {matches.map((match, i) => (
                  (() => {
                    const competition = getCompetitionDisplay(match.competition_name)
                    const showLevel = Boolean(
                      match.match_level_name
                      && match.competition_name !== 'Towarzyski'
                      && match.competition_name !== 'Nieoficjalny'
                    )
                    return (
                  <tr
                    key={match.id}
                    className={`border-b border-neutral-800 transition-colors hover:bg-neutral-900/60 ${
                      i % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/30'
                    }`}
                  >
                    <td className="pl-4 pr-0 py-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200"
                      >
                        {formatDate(match.match_date)}
                      </span>
                    </td>
                    <td className="pl-2 pr-4 py-3 whitespace-nowrap font-semibold text-neutral-100">
                      {match.home_team_name} – {match.away_team_name}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-left">
                      {match.final_score ? (
                        <span
                          className="inline-flex items-center rounded-md border border-neutral-400 bg-black px-2 py-0.5 text-xs font-bold text-white"
                          style={{ fontSize: '0.95em', fontWeight: 700 }}
                        >
                          {match.final_score}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-8 py-3 whitespace-nowrap">
                      <span
                        title={getCompetitionLevelTooltip(match.competition_name, match.match_level_name)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200"
                      >
                        <span className={`font-semibold ${competition.isCompact ? 'text-[10px]' : 'text-xs'}`}>
                          {competition.label}
                        </span>
                        {showLevel ? (
                          <>
                            <span className="text-[10px] text-neutral-500">/</span>
                            <span className="text-xs font-semibold text-neutral-200">
                              {match.match_level_name}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">
                      <EditorialStatusBadge status={match.editorial_status} />
                    </td>
                    <td className="pl-1 pr-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/matches/${match.id}`}
                        className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                    )
                  })()
                ))}
              </tbody>
            </table>
            <AdminPagination
              basePath="/admin/matches"
              searchParams={resolvedSearchParams}
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              from={pagination.from}
              to={pagination.to}
              itemLabel={pagination.total === 1 ? 'meczu' : 'meczów'}
            />
          </div>
        )}

        {isCreateModalOpen && !fetchError && (
          <MatchCreateModal
            competitions={competitionOptions}
            teams={teamOptions}
            cities={cityOptions}
            countries={countryOptions}
            federations={federationOptions}
            stadiums={stadiumOptions}
            createAction={createMatch}
          />
        )}
      </div>
    </main>
  )
}
