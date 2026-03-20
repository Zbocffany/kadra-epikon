import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteMatch, updateMatch } from '../actions'
import { getMatchStatusLabel, MATCH_STATUS_OPTIONS } from '../matchStatusLabels'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import { getAdminMatchCreateOptions, getAdminMatchDetails } from '@/lib/db/matches'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

type Params = DetailPageParams
type SearchParams = DetailPageSearchParams

const EDITORIAL_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'DRAFT' },
  { value: 'PARTIAL', label: 'PARTIAL' },
  { value: 'COMPLETE', label: 'COMPLETE' },
  { value: 'VERIFIED', label: 'VERIFIED' },
] as const

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

export default async function AdminMatchDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode } = await searchParams

  const [match, options] = await Promise.all([
    getAdminMatchDetails(id),
    getAdminMatchCreateOptions(),
  ])

  if (!match) {
    notFound()
  }

  const isEdit = mode === 'edit'
  const competitionName =
    options.competitions.find((competition) => competition.id === match.competition_id)?.name
    ?? match.competition_name
  const homeTeamName =
    options.teams.find((team) => team.id === match.home_team_id)?.label
    ?? match.home_team_name
  const awayTeamName =
    options.teams.find((team) => team.id === match.away_team_id)?.label
    ?? match.away_team_name
  const stadiumName = match.match_stadium_id
    ? (options.stadiums.find((stadium) => stadium.id === match.match_stadium_id)?.label ?? '—')
    : '—'
  const cityName = match.match_city_id
    ? (options.cities.find((city) => city.id === match.match_city_id)?.name ?? '—')
    : '—'

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/admin/matches"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            Powrót do listy meczów
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/admin/matches/${match.id}?mode=edit`}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              Edytuj
            </Link>

            <form action={deleteMatch}>
              <input type="hidden" name="id" value={match.id} />
              <ConfirmSubmitButton
                type="submit"
                confirmMessage={`Czy na pewno chcesz usunąć mecz "${match.home_team_name} vs ${match.away_team_name}"?`}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
              >
                Usuń
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Admin / Mecze</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {match.home_team_name} vs {match.away_team_name}
          </h1>

          {isEdit ? (
            <form action={updateMatch} className="mt-6 space-y-4">
              <input type="hidden" name="id" value={match.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="match_date" className="text-sm font-medium text-neutral-300">
                    Data meczu <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="match_date"
                    name="match_date"
                    type="date"
                    required
                    defaultValue={match.match_date}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="match_time" className="text-sm font-medium text-neutral-300">
                    Godzina
                  </label>
                  <input
                    id="match_time"
                    name="match_time"
                    type="time"
                    defaultValue={match.match_time ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="competition_id" className="text-sm font-medium text-neutral-300">
                    Rozgrywki <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="competition_id"
                    name="competition_id"
                    defaultValue={match.competition_id}
                    required
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="">— wybierz —</option>
                    {options.competitions.map((competition) => (
                      <option key={competition.id} value={competition.id}>
                        {competition.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="home_team_id" className="text-sm font-medium text-neutral-300">
                    Gospodarz <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="home_team_id"
                    name="home_team_id"
                    defaultValue={match.home_team_id}
                    required
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="">— wybierz —</option>
                    {options.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="away_team_id" className="text-sm font-medium text-neutral-300">
                    Gość <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="away_team_id"
                    name="away_team_id"
                    defaultValue={match.away_team_id}
                    required
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="">— wybierz —</option>
                    {options.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="match_stadium_id" className="text-sm font-medium text-neutral-300">
                    Stadion
                  </label>
                  <select
                    id="match_stadium_id"
                    name="match_stadium_id"
                    defaultValue={match.match_stadium_id ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="">— brak —</option>
                    {options.stadiums.map((stadium) => (
                      <option key={stadium.id} value={stadium.id}>
                        {stadium.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="match_city_id" className="text-sm font-medium text-neutral-300">
                    Miasto meczu
                  </label>
                  <select
                    id="match_city_id"
                    name="match_city_id"
                    defaultValue={match.match_city_id ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="">— brak —</option>
                    {options.cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="match_status" className="text-sm font-medium text-neutral-300">
                    Status meczu
                  </label>
                  <select
                    id="match_status"
                    name="match_status"
                    defaultValue={match.match_status}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  >
                    {MATCH_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="editorial_status" className="text-sm font-medium text-neutral-300">
                    Status redakcji
                  </label>
                  <select
                    id="editorial_status"
                    name="editorial_status"
                    defaultValue={match.editorial_status}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  >
                    {EDITORIAL_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href={`/admin/matches/${match.id}`}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                >
                  Anuluj
                </Link>
                <button
                  type="submit"
                  className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                >
                  Zapisz
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Data</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{formatDate(match.match_date)}</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Godzina</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">
                  {match.match_time ? match.match_time.slice(0, 5) : '—'}
                </p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Rozgrywki</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{competitionName}</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Status meczu</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{getMatchStatusLabel(match.match_status)}</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Gospodarz</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{homeTeamName}</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Gość</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{awayTeamName}</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Stadion</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{stadiumName}</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Miasto meczu</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{cityName}</p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Status redakcji</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{match.editorial_status}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
