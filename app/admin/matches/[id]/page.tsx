import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { deleteMatch, updateMatch } from '../actions'
import { getMatchStatusLabel, MATCH_STATUS_OPTIONS } from '../matchStatusLabels'
import {
  DetailsPageContainer,
  DetailsPageContent,
  DetailsPageHeader,
} from '@/components/admin/DetailsPageLayout'
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

function MatchDetailCard({
  label,
  children,
  spanTwo = false,
}: {
  label: string
  children: ReactNode
  spanTwo?: boolean
}) {
  return (
    <div className={`rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 ${spanTwo ? 'sm:col-span-2' : ''}`}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function MatchFieldValue({ value }: { value: string }) {
  return <p className="text-lg font-semibold text-neutral-100">{value}</p>
}

export default async function AdminMatchDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams

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

  const fields = (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <MatchDetailCard label="Data">
        {isEdit ? (
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
        ) : (
          <MatchFieldValue value={formatDate(match.match_date)} />
        )}
      </MatchDetailCard>

      <MatchDetailCard label="Godzina">
        {isEdit ? (
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
        ) : (
          <MatchFieldValue value={match.match_time ? match.match_time.slice(0, 5) : '—'} />
        )}
      </MatchDetailCard>

      <MatchDetailCard label="Rozgrywki" spanTwo>
        {isEdit ? (
          <div className="flex flex-col gap-1.5">
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
        ) : (
          <MatchFieldValue value={competitionName} />
        )}
      </MatchDetailCard>

      <MatchDetailCard label="Gospodarz">
        {isEdit ? (
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
        ) : (
          <MatchFieldValue value={homeTeamName} />
        )}
      </MatchDetailCard>

      <MatchDetailCard label="Gość">
        {isEdit ? (
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
        ) : (
          <MatchFieldValue value={awayTeamName} />
        )}
      </MatchDetailCard>

      <MatchDetailCard label="Stadion">
        {isEdit ? (
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
        ) : (
          <MatchFieldValue value={stadiumName} />
        )}
      </MatchDetailCard>

      <MatchDetailCard label="Miasto meczu">
        {isEdit ? (
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
        ) : (
          <MatchFieldValue value={cityName} />
        )}
      </MatchDetailCard>

      <MatchDetailCard label="Status meczu">
        {isEdit ? (
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
        ) : (
          <MatchFieldValue value={getMatchStatusLabel(match.match_status)} />
        )}
      </MatchDetailCard>

      <MatchDetailCard label="Status redakcji" spanTwo>
        {isEdit ? (
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
        ) : (
          <MatchFieldValue value={match.editorial_status} />
        )}
      </MatchDetailCard>
    </div>
  )

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={`${match.home_team_name} vs ${match.away_team_name}`}
        backLabel="Powrót do listy meczów"
        backHref="/admin/matches"
        editHref={`/admin/matches/${match.id}?mode=edit`}
        deleteAction={deleteMatch}
        deleteId={match.id}
      />

      <DetailsPageContent
        title={`${match.home_team_name} vs ${match.away_team_name}`}
        breadcrumb="Admin / Mecze"
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updateMatch} className="space-y-4">
            <input type="hidden" name="id" value={match.id} />
            {fields}

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
        }
        viewContent={fields}
      />
    </DetailsPageContainer>
  )
}
