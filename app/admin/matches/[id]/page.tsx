import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import MatchCoachesForm from './MatchCoachesForm'
import MatchSquadForm from './MatchSquadForm'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import { deleteMatch, saveMatchFull } from '../actions'
import { getMatchStatusLabel, MATCH_STATUS_OPTIONS } from '../matchStatusLabels'
import {
  DetailsPageContainer,
  DetailsPageContent,
  DetailsPageHeader,
} from '@/components/admin/DetailsPageLayout'
import {
  getAdminMatchCreateOptions,
  getAdminMatchDetails,
  getAdminMatchParticipants,
  type AdminMatchParticipant,
  type AdminMatchParticipantPersonOption,
  type MatchParticipantRole,
  type PlayerPosition,
} from '@/lib/db/matches'
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

function getRoleLabel(role: MatchParticipantRole) {
  switch (role) {
    case 'PLAYER':
      return 'Zawodnik'
    case 'COACH':
      return 'Trener'
    case 'REFEREE':
      return 'Sędzia'
  }
}

function getPlayerPositionLabel(playerPosition: PlayerPosition | null) {
  switch (playerPosition) {
    case 'GOALKEEPER':
      return 'Bramkarz'
    case 'DEFENDER':
      return 'Obrońca'
    case 'MIDFIELDER':
      return 'Pomocnik'
    case 'ATTACKER':
      return 'Napastnik'
    default:
      return null
  }
}

function renderParticipantClub(participant: AdminMatchParticipant) {
  if (participant.club_team_name) {
    return participant.club_team_name
  }

  if (participant.derived_club_team_name) {
    return `${participant.derived_club_team_name} (wyliczony)`
  }

  return '—'
}

function MatchRefereesSection({
  referees,
}: {
  referees: AdminMatchParticipant[]
}) {
  const referee = referees[0] ?? null

  return (
    <section className="mt-6 max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-neutral-100">Sędzia</h2>
      <div className="mt-4">
        {referee ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-100">{referee.person_name}</p>
            <p className="mt-1 text-xs text-neutral-400">Sędzia główny</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Brak przypisanego sędziego.</p>
        )}
      </div>
    </section>
  )
}

function MatchTeamParticipantsView({
  participants,
}: {
  participants: AdminMatchParticipant[]
}) {
  const starters = participants.filter((p) => p.role === 'PLAYER' && p.is_starting)
  const bench = participants.filter((p) => p.role === 'PLAYER' && !p.is_starting)
  const coaches = participants.filter((p) => p.role === 'COACH')
  const hasPlayers = starters.length > 0 || bench.length > 0

  return (
    <div className="mt-4 space-y-4">
      {hasPlayers ? (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-[140px]" />
            </colgroup>
            <tbody>
              {starters.map((player, index) => (
                <tr key={player.id} className="border-t border-neutral-800 first:border-t-0">
                  <td className="bg-neutral-950 px-3 py-2 text-sm text-neutral-500">{index + 1}</td>
                  <td className="bg-neutral-950 px-3 py-2 text-sm text-neutral-100">{player.person_name}</td>
                  <td className="bg-neutral-950 px-3 py-2 text-right text-xs text-neutral-400">
                    {getPlayerPositionLabel(player.player_position) ?? '—'}
                  </td>
                </tr>
              ))}
              {bench.map((player, index) => (
                <tr key={player.id} className="border-t border-neutral-800">
                  <td className="bg-neutral-900/40 px-3 py-2 text-sm text-neutral-600">{starters.length + index + 1}</td>
                  <td className="bg-neutral-900/40 px-3 py-2 text-sm text-neutral-300">{player.person_name}</td>
                  <td className="bg-neutral-900/40 px-3 py-2 text-right text-xs text-neutral-500">
                    {getPlayerPositionLabel(player.player_position) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Brak zawodników.</p>
      )}

      {coaches.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Sztab</p>
          <ul className="mt-2 space-y-1">
            {coaches.map((coach) => (
              <li key={coach.id} className="text-sm text-neutral-300">{coach.person_name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MatchTeamParticipantsSection({
  namePrefix,
  title,
  participants,
  people,
  isEdit,
}: {
  namePrefix: string
  title: string
  participants: AdminMatchParticipant[]
  people: AdminMatchParticipantPersonOption[]
  isEdit: boolean
}) {
  const players = participants.filter((participant) => participant.role === 'PLAYER')
  const coaches = participants.filter((participant) => participant.role === 'COACH')

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="text-xl font-semibold text-neutral-100">{title}</h2>

      {isEdit ? (
        <>
          <div className="mt-6">
            <MatchSquadForm
              namePrefix={namePrefix}
              people={people}
              players={players}
            />
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Sztab</p>
            <div className="mt-3">
              <MatchCoachesForm
                namePrefix={namePrefix}
                people={people}
                coaches={coaches}
              />
            </div>
          </div>
        </>
      ) : (
        <MatchTeamParticipantsView participants={participants} />
      )}
    </section>
  )
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

  const match = await getAdminMatchDetails(id)

  if (!match) {
    notFound()
  }

  const [options, participants] = await Promise.all([
    getAdminMatchCreateOptions(),
    getAdminMatchParticipants(match),
  ])

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

  const matchTitle = `${match.home_team_name} vs ${match.away_team_name}`
  const currentReferee = participants.referees[0] ?? null

  if (isEdit) {
    return (
      <DetailsPageContainer maxWidthClass="max-w-6xl">
        <form action={saveMatchFull}>
          <input type="hidden" name="id" value={match.id} />

          <div className="mb-6">
            <Link
              href="/admin/matches"
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              Powrót do listy meczów
            </Link>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Admin / Mecze</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{matchTitle}</h1>

            {saved && (
              <div className="mt-6 rounded-lg border border-emerald-800 bg-emerald-950/50 px-5 py-4 text-sm text-emerald-300">
                Zmiany zostały zapisane.
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
                {error}
              </div>
            )}

            {fields}
          </div>

          <section className="mt-6 max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-neutral-100">Sędzia</h2>
            <div className="mt-3">
              <select
                name="referee_person_id"
                defaultValue={currentReferee?.person_id ?? ''}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— brak sędziego —</option>
                {participants.people.map((person) => (
                  <option key={person.id} value={person.id}>{person.label}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="mt-6 grid gap-6 2xl:grid-cols-2">
            <MatchTeamParticipantsSection
              namePrefix="home_"
              title={match.home_team_name}
              participants={participants.homeParticipants}
              people={participants.people}
              isEdit={true}
            />
            <MatchTeamParticipantsSection
              namePrefix="away_"
              title={match.away_team_name}
              participants={participants.awayParticipants}
              people={participants.people}
              isEdit={true}
            />
          </section>

          <div className="mt-8 flex items-center justify-end gap-2">
            <ConfirmSubmitButton
              formAction={deleteMatch}
              confirmMessage={`Czy na pewno chcesz usunąć mecz "${matchTitle}"?`}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              Usuń
            </ConfirmSubmitButton>
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
      </DetailsPageContainer>
    )
  }

  return (
    <DetailsPageContainer maxWidthClass="max-w-6xl">
      <DetailsPageHeader
        title={matchTitle}
        backLabel="Powrót do listy meczów"
        backHref="/admin/matches"
        editHref={`/admin/matches/${match.id}?mode=edit`}
        deleteAction={deleteMatch}
        deleteId={match.id}
      />

      <DetailsPageContent
        title={matchTitle}
        breadcrumb="Admin / Mecze"
        saved={saved}
        error={error}
        isEdit={false}
        editContent={null}
        viewContent={fields}
      />

      <MatchRefereesSection
        referees={participants.referees}
      />

      <section className="mt-6 grid gap-6 2xl:grid-cols-2">
        <MatchTeamParticipantsSection
          namePrefix="home_"
          title={match.home_team_name}
          participants={participants.homeParticipants}
          people={participants.people}
          isEdit={false}
        />
        <MatchTeamParticipantsSection
          namePrefix="away_"
          title={match.away_team_name}
          participants={participants.awayParticipants}
          people={participants.people}
          isEdit={false}
        />
      </section>
    </DetailsPageContainer>
  )
}
