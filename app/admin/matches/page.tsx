import Link from 'next/link'
import { createMatch } from './actions'
import MatchCreateModal from './MatchCreateModal'
import AdminPagination from '@/components/admin/AdminPagination'
import CountryFlag from '@/components/CountryFlag'
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

function getDaysUntilMatch(dateStr: string): number | null {
  const matchDate = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  matchDate.setHours(0, 0, 0, 0)
  const diff = matchDate.getTime() - today.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days > 0 ? days : null
}

function getScheduledCountdownLabel(match: AdminMatch): string | null {
  if (match.match_status !== 'SCHEDULED') return null

  const matchDate = new Date(match.match_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  matchDate.setHours(0, 0, 0, 0)

  const diffMs = matchDate.getTime() - today.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Dzisiaj'
  if (days > 0) return `Dni do: ${days}`
  return null
}

function getPolandMatchOutcome(match: AdminMatch): 'WIN' | 'LOSS' | 'DRAW' | null {
  if (!match.final_score) return null

  const scoreMatch = match.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!scoreMatch) return null

  const homeGoals = Number(scoreMatch[1])
  const awayGoals = Number(scoreMatch[2])

  const homeName = (match.home_team_name ?? '').trim().toLowerCase()
  const awayName = (match.away_team_name ?? '').trim().toLowerCase()
  const isPolandHome = homeName.startsWith('polska')
  const isPolandAway = awayName.startsWith('polska')

  if (!isPolandHome && !isPolandAway) return null

  if (homeGoals === awayGoals) return 'DRAW'

  if (isPolandHome) {
    return homeGoals > awayGoals ? 'WIN' : 'LOSS'
  }

  return awayGoals > homeGoals ? 'WIN' : 'LOSS'
}

function getScoreBadgeClass(match: AdminMatch): string {
  const outcome = getPolandMatchOutcome(match)

  if (outcome === 'WIN') return 'border-emerald-500'
  if (outcome === 'LOSS') return 'border-red-500'
  if (outcome === 'DRAW') return 'border-neutral-500'

  return 'border-neutral-400'
}

function renderScoreWithFlags(match: AdminMatch) {
  const label = match.final_score ?? getScheduledCountdownLabel(match)
  if (!label) return null

  const badgeClass = match.final_score
    ? `text-white ${getScoreBadgeClass(match)}`
    : 'border-blue-500 text-blue-400'

  return (
    <span className="inline-flex items-center gap-[0.5cm]">
      <CountryFlag
        fifaCode={match.home_team_fifa_code}
        countryName={match.home_team_name}
        glossy
        className="h-[22px] w-[33px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]"
      />
      <span
        className={`relative inline-flex items-center overflow-hidden rounded-md border bg-black px-2 py-0.5 text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)] ${badgeClass}`}
        style={{ fontSize: '0.95em', fontWeight: 700 }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
        />
        <span className="relative z-10">{label}</span>
      </span>
      <CountryFlag
        fifaCode={match.away_team_fifa_code}
        countryName={match.away_team_name}
        glossy
        className="h-[22px] w-[33px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]"
      />
    </span>
  )
}

function GlossySummaryBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center overflow-hidden rounded-md border border-neutral-500/80 bg-neutral-900 px-2.5 py-1 text-xs font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
      />
      <span className="relative z-10">{children}</span>
    </span>
  )
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
  const upcomingMatches = [...matches]
    .filter((match) => match.match_status === 'SCHEDULED')
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
  const completedAndOtherMatches = matches.filter((match) => match.match_status !== 'SCHEDULED')
  const matchesByYear = completedAndOtherMatches.reduce<Record<string, AdminMatch[]>>((acc, match) => {
    const year = match.match_date.slice(0, 4)
    if (!acc[year]) {
      acc[year] = []
    }
    acc[year].push(match)
    return acc
  }, {})
  const years = Object.keys(matchesByYear).sort((a, b) => Number(b) - Number(a))

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
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
              Mecze: {totalMatches}
            </span>
          </div>
        </div>

        {!fetchError && (
          <details className="mb-6 group overflow-visible rounded-xl border border-neutral-800 bg-neutral-950" open>
            <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-4 py-2.5 marker:content-none">
              <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-bold text-neutral-100">
                Najbliższe mecze
              </span>
              <span className="inline-flex items-center gap-3">
                <span className="text-xs text-neutral-400">Mecze: {upcomingMatches.length}</span>
                <span className="text-sm font-bold leading-none text-neutral-400 transition-transform duration-150 group-open:rotate-180">▾</span>
              </span>
            </summary>

            <div className="border-t border-neutral-800 bg-neutral-950">
              {upcomingMatches.length === 0 ? (
                <p className="rounded-md px-2 py-2 text-sm text-neutral-500">Brak nadchodzących meczów.</p>
              ) : (
                <div className="overflow-x-auto pt-6 -mt-6">
                  <table className="w-full border-collapse text-sm table-auto">
                    <colgroup>
                      <col className="w-[7.5rem]" />
                      <col className="w-[20rem]" />
                      <col className="w-[14rem]" />
                      <col className="w-[12rem]" />
                      <col className="w-[8rem]" />
                    </colgroup>
                    <tbody>
                      {upcomingMatches.map((match) => {
                        const competition = getCompetitionDisplay(match.competition_name)
                        const showLevel = Boolean(
                          match.match_level_name
                          && match.competition_name !== 'Towarzyski'
                          && match.competition_name !== 'Nieoficjalny'
                        )
                        const matchHref = `/admin/matches/${match.id}`

                        return (
                          <tr
                            key={match.id}
                            className="border-t border-neutral-800 bg-neutral-950 transition-colors hover:bg-neutral-900/60"
                          >
                            <td className="whitespace-nowrap">
                              <Link href={matchHref} className="block px-3 py-3" aria-label={`Otwórz mecz ${match.home_team_name} - ${match.away_team_name}`}>
                                <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200">
                                  {formatDate(match.match_date)}
                                </span>
                              </Link>
                            </td>
                            <td className="whitespace-nowrap font-semibold text-neutral-100">
                              <Link href={matchHref} className="block pl-1 pr-2 py-3">
                                {match.home_team_name} – {match.away_team_name}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap text-left">
                              <Link href={matchHref} className="block pl-0 pr-2 py-3">
                                {renderScoreWithFlags(match)}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap">
                              <Link href={matchHref} className="block px-8 py-3">
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
                              </Link>
                            </td>
                            <td className="text-right whitespace-nowrap">
                              <Link href={matchHref} className="flex justify-end px-2 py-3">
                                <span className="inline-flex">
                                  <EditorialStatusBadge status={match.editorial_status} />
                                </span>
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
        )}

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

        {/* Table with collapsible year groups */}
        {matches.length > 0 && (
          <div className="overflow-visible rounded-xl border border-neutral-800">
            <div className="divide-y divide-neutral-800">
              {years.length === 0 && (
                <div className="px-4 py-5 text-sm text-neutral-500">Brak meczów poza zaplanowanymi na tej stronie.</div>
              )}
              {years.map((year, yearIndex) => (
                <details key={year} open={yearIndex === 0} className="group bg-neutral-950">
                  <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-4 py-2 marker:content-none">
                    <GlossySummaryBadge>{year}</GlossySummaryBadge>
                    <span className="inline-flex items-center gap-3">
                      <span className="text-xs text-neutral-400">Mecze: {matchesByYear[year].length}</span>
                      <span className="text-sm font-bold leading-none text-neutral-400 transition-transform duration-150 group-open:rotate-180">▾</span>
                    </span>
                  </summary>

                  <div className="overflow-x-auto pt-6 -mt-6">
                    <table className="w-full border-collapse text-sm table-auto">
                      <colgroup>
                        <col className="w-[7.5rem]" />
                        <col className="w-[20rem]" />
                        <col className="w-[14rem]" />
                        <col className="w-[12rem]" />
                        <col className="w-[8rem]" />
                      </colgroup>
                      <tbody>
                        {matchesByYear[year].map((match) => {
                          const competition = getCompetitionDisplay(match.competition_name)
                          const showLevel = Boolean(
                            match.match_level_name
                            && match.competition_name !== 'Towarzyski'
                            && match.competition_name !== 'Nieoficjalny'
                          )
                          const matchHref = `/admin/matches/${match.id}`

                          return (
                            <tr
                              key={match.id}
                              className="border-t border-neutral-800 bg-neutral-950 transition-colors hover:bg-neutral-900/60"
                            >
                              <td className="whitespace-nowrap">
                                <Link href={matchHref} className="block px-3 py-3" aria-label={`Otwórz mecz ${match.home_team_name} - ${match.away_team_name}`}>
                                  <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200">
                                    {formatDate(match.match_date)}
                                  </span>
                                </Link>
                              </td>
                              <td className="whitespace-nowrap font-semibold text-neutral-100">
                                <Link href={matchHref} className="block pl-1 pr-2 py-3">
                                  {match.home_team_name} – {match.away_team_name}
                                </Link>
                              </td>
                              <td className="whitespace-nowrap text-left">
                                <Link href={matchHref} className="block pl-0 pr-2 py-3">
                                  {renderScoreWithFlags(match)}
                                </Link>
                              </td>
                              <td className="whitespace-nowrap">
                                <Link href={matchHref} className="block px-8 py-3">
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
                                </Link>
                              </td>
                              <td className="text-right whitespace-nowrap">
                                <Link href={matchHref} className="flex justify-end px-2 py-3">
                                  <span className="inline-flex">
                                    <EditorialStatusBadge status={match.editorial_status} />
                                  </span>
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>

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
            matchLevels={matchLevelOptions}
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
