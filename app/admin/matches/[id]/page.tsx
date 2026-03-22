import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import MatchCoachesForm from './MatchCoachesForm'
import MatchSquadForm from './MatchSquadForm'
import EditMatchFormWrapper from './EditMatchFormWrapper'
import EditMatchLocationFields from './EditMatchLocationFields'
import RefereePersonField from './RefereePersonField'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { deleteMatch, saveMatchFull } from '../actions'
import { createClubInline } from '@/app/admin/clubs/actions'
import { getMatchStatusLabel, MATCH_STATUS_OPTIONS } from '../matchStatusLabels'
import { getResultTypeLabel, RESULT_TYPE_OPTIONS } from '../resultTypeLabels'
import { compareByPlayerPosition } from '../playerPositionSort'
import { renderCreateClubInlineForm } from '../inlineCreateForms'
import {
  DetailsPageContainer,
  DetailsPageContent,
  DetailsPageHeader,
} from '@/components/admin/DetailsPageLayout'
import {
  getAdminClubTeamOptions,
  getLatestPlayerClubTeamByPersonIds,
  getAdminMatchCreateOptions,
  getAdminMatchDetails,
  getAdminMatchParticipants,
  type AdminMatchDetails,
  type AdminMatchParticipant,
  type AdminMatchParticipantPersonOption,
  type AdminTeamOption,
  type PlayerPosition,
} from '@/lib/db/matches'
import { getAdminPersonBirthCityOptions, type AdminPersonBirthCityOption } from '@/lib/db/people'
import { getAdminCountriesOptions, type AdminCountryOption } from '@/lib/db/cities'
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

function MatchStatusBadge({ status }: { status: AdminMatchDetails['match_status'] }) {
  const styles: Record<string, string> = {
    SCHEDULED: 'bg-indigo-900/50 text-indigo-300 ring-indigo-700',
    FINISHED: 'bg-neutral-800 text-neutral-300 ring-neutral-700',
    ABANDONED: 'bg-orange-900/50 text-orange-300 ring-orange-700',
    CANCELLED: 'bg-red-900/50 text-red-300 ring-red-700',
  }
  const cls = styles[status] ?? 'bg-neutral-800 text-neutral-400 ring-neutral-700'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {getMatchStatusLabel(status)}
    </span>
  )
}

function EditorialStatusBadge({ status }: { status: AdminMatchDetails['editorial_status'] }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-neutral-800 text-neutral-400 ring-neutral-600',
    PARTIAL: 'bg-amber-900/50 text-amber-300 ring-amber-700',
    COMPLETE: 'bg-blue-900/50 text-blue-300 ring-blue-700',
    VERIFIED: 'bg-emerald-900/50 text-emerald-300 ring-emerald-700',
  }
  const cls = styles[status] ?? 'bg-neutral-800 text-neutral-400 ring-neutral-600'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  )
}

function ResultTypeBadge({ resultType }: { resultType: AdminMatchDetails['result_type'] }) {
  const styles: Record<string, string> = {
    REGULAR: 'bg-neutral-800 text-neutral-300 ring-neutral-700',
    EXTRA_TIME: 'bg-blue-900/50 text-blue-300 ring-blue-700',
    PENALTIES: 'bg-amber-900/50 text-amber-300 ring-amber-700',
    WALKOVER: 'bg-orange-900/50 text-orange-300 ring-orange-700',
  }

  if (!resultType) {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-neutral-800 text-neutral-500 ring-neutral-700">
        Brak danych
      </span>
    )
  }

  const cls = styles[resultType] ?? 'bg-neutral-800 text-neutral-300 ring-neutral-700'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {getResultTypeLabel(resultType)}
    </span>
  )
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
            <p className="text-sm font-semibold text-neutral-100">
              {referee.person_name}
              {referee.country_code && <span className="font-semibold text-neutral-200">{'\u00A0'}({referee.country_code})</span>}
            </p>
            <p className="mt-1 text-xs text-neutral-400">Sędzia główny</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Brak przypisanego sędziego.</p>
        )}
      </div>
    </section>
  )
}

function PositionBadge({ position, bench = false }: { position: PlayerPosition | null; bench?: boolean }) {
  const label = getPlayerPositionLabel(position)
  const letter = label?.[0] ?? '–'

  const STARTER_COLORS: Partial<Record<PlayerPosition, string>> = {
    GOALKEEPER: 'border border-orange-400 bg-gradient-to-b from-orange-400 to-orange-600 text-white',
    DEFENDER:   'border border-red-400    bg-gradient-to-b from-red-400    to-red-600    text-white',
    MIDFIELDER: 'border border-blue-400   bg-gradient-to-b from-blue-400   to-blue-600   text-white',
    ATTACKER:   'border border-green-400  bg-gradient-to-b from-green-400  to-green-600  text-white',
  }
  const BENCH_COLORS: Partial<Record<PlayerPosition, string>> = {
    GOALKEEPER: 'border border-orange-700 bg-gradient-to-b from-orange-900 to-orange-950 text-orange-400',
    DEFENDER:   'border border-red-700    bg-gradient-to-b from-red-900    to-red-950    text-red-400',
    MIDFIELDER: 'border border-blue-700   bg-gradient-to-b from-blue-900   to-blue-950   text-blue-400',
    ATTACKER:   'border border-green-700  bg-gradient-to-b from-green-900  to-green-950  text-green-400',
  }

  const colorClass = position
    ? (bench ? BENCH_COLORS[position] : STARTER_COLORS[position]) ?? 'border border-neutral-400 bg-gradient-to-b from-neutral-500 to-neutral-800 text-white'
    : bench
      ? 'border border-neutral-500 bg-gradient-to-b from-neutral-700 to-neutral-900 text-neutral-400'
      : 'border border-neutral-400 bg-gradient-to-b from-neutral-500 to-neutral-800 text-white'

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.6)] ${colorClass}`}
      title={label ?? undefined}
    >
      {letter}
    </span>
  )
}

function MatchTeamParticipantsView({
  participants,
}: {
  participants: AdminMatchParticipant[]
}) {
  const sortByPos = (a: AdminMatchParticipant, b: AdminMatchParticipant) =>
    compareByPlayerPosition(a, b, (player) => player.player_position)

  const starters = participants.filter((p) => p.role === 'PLAYER' && p.is_starting).sort(sortByPos)
  const bench = participants.filter((p) => p.role === 'PLAYER' && !p.is_starting).sort(sortByPos)
  const coaches = participants.filter((p) => p.role === 'COACH')
  const hasPlayers = starters.length > 0 || bench.length > 0

  return (
    <div className="mt-4 space-y-4">
      {hasPlayers ? (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-8" />
              <col />
            </colgroup>
            <tbody>
              {starters.map((player, index) => (
                <tr key={player.id} className="border-t border-neutral-800 first:border-t-0">
                  <td className="bg-neutral-950 px-3 py-2 text-sm text-neutral-500">{index + 1}</td>
                  <td className="bg-neutral-950 py-2 pl-0 pr-2">
                    <PositionBadge position={player.player_position} />
                  </td>
                  <td className="bg-neutral-950 px-3 py-2 text-sm text-neutral-100">{player.person_name}</td>
                </tr>
              ))}
              {bench.length > 0 && (
                <tr className="border-t-2 border-neutral-700">
                  <td colSpan={3} className="bg-neutral-950 px-3 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                    Ławka rezerwowych
                  </td>
                </tr>
              )}
              {bench.map((player, index) => (
                <tr key={player.id} className="border-t border-neutral-800">
                  <td className="bg-neutral-900/40 px-3 py-2 text-sm text-neutral-600">{starters.length + index + 1}</td>
                  <td className="bg-neutral-900/40 py-2 pl-0 pr-2">
                    <PositionBadge position={player.player_position} bench />
                  </td>
                  <td className="bg-neutral-900/40 px-3 py-2 text-sm text-neutral-300">{player.person_name}</td>
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
          <ul className="mt-2 flex flex-wrap gap-2">
            {coaches.map((coach) => (
              <li key={coach.id} className="inline-flex w-fit rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm font-semibold text-neutral-200">
                {coach.person_name}
                {coach.country_code && <span className="font-semibold text-neutral-200">{'\u00A0'}({coach.country_code})</span>}
              </li>
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
  clubTeams,
  latestPlayerClubTeamByPersonId,
  isEdit,
  cities,
  countries,
}: {
  namePrefix: string
  title: string
  participants: AdminMatchParticipant[]
  people: AdminMatchParticipantPersonOption[]
  clubTeams: AdminTeamOption[]
  latestPlayerClubTeamByPersonId: Record<string, string | null>
  isEdit: boolean
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
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
              clubTeams={clubTeams}
              latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
              cities={cities}
              countries={countries}
            />
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Sztab</p>
            <div className="mt-3">
              <MatchCoachesForm
                namePrefix={namePrefix}
                people={people}
                coaches={coaches}
                cities={cities}
                countries={countries}
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

  const [options, participants, cities, countries, clubTeams] = await Promise.all([
    getAdminMatchCreateOptions(),
    getAdminMatchParticipants(match),
    getAdminPersonBirthCityOptions(),
    getAdminCountriesOptions(),
    getAdminClubTeamOptions(),
  ])

  const latestPlayerClubTeamByPersonId = await getLatestPlayerClubTeamByPersonIds(
    participants.people.map((person) => person.id),
    { excludeMatchId: match.id }
  )

  const isEdit = mode === 'edit'
  const competitionName =
    options.competitions.find((competition) => competition.id === match.competition_id)?.name
    ?? match.competition_name
  const stadiumName = match.match_stadium_id
    ? (options.stadiums.find((stadium) => stadium.id === match.match_stadium_id)?.label ?? '—')
    : '—'
  const cityName = match.match_city_id
    ? (options.cities.find((city) => city.id === match.match_city_id)?.name ?? '—')
    : '—'

  const fields = isEdit ? (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <MatchDetailCard label="Data">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="match_date" className="text-sm font-medium text-neutral-300">
            DATA MECZU <span className="text-red-400">*</span>
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
      </MatchDetailCard>

      <MatchDetailCard label="Godzina">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="match_time" className="text-sm font-medium text-neutral-300">
            GODZINA MECZU
          </label>
          <input
            id="match_time"
            name="match_time"
            type="time"
            defaultValue={match.match_time ?? ''}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </div>
      </MatchDetailCard>

      <MatchDetailCard label="Rozgrywki" spanTwo>
        <AdminSelectField
          name="competition_id"
          label="Rozgrywki"
          hideLabel
          required
          selectedId={match.competition_id}
          options={options.competitions.map((competition) => ({ id: competition.id, label: competition.name }))}
          displayKey="label"
          placeholder="Wpisz, aby filtrować rozgrywki..."
          emptyResultsMessage="Brak wyników."
          inlineForm={null}
        />
      </MatchDetailCard>

      <MatchDetailCard label="Gospodarz">
        <AdminSelectField
          name="home_team_id"
          label="Gospodarz"
          hideLabel
          required
          selectedId={match.home_team_id}
          options={options.teams.map((team) => ({ id: team.id, label: team.label }))}
          displayKey="label"
          placeholder="Wpisz, aby filtrować gospodarza..."
          addButtonLabel="Dodaj klub"
          addDialogTitle="Nowy klub"
          emptyResultsMessage="Brak wyników - możesz dodać nowy klub poniżej."
          createAction={createClubInline}
          inlineForm={renderCreateClubInlineForm({
            scope: 'inline_edit_home',
            cityOptions: options.cities.map((city) => ({ id: city.id, label: city.name })),
            countries,
          })}
        />
      </MatchDetailCard>

      <MatchDetailCard label="Gość">
        <AdminSelectField
          name="away_team_id"
          label="Gość"
          hideLabel
          required
          selectedId={match.away_team_id}
          options={options.teams.map((team) => ({ id: team.id, label: team.label }))}
          displayKey="label"
          placeholder="Wpisz, aby filtrować gościa..."
          addButtonLabel="Dodaj klub"
          addDialogTitle="Nowy klub"
          emptyResultsMessage="Brak wyników - możesz dodać nowy klub poniżej."
          createAction={createClubInline}
          inlineForm={renderCreateClubInlineForm({
            scope: 'inline_edit_away',
            cityOptions: options.cities.map((city) => ({ id: city.id, label: city.name })),
            countries,
          })}
        />
      </MatchDetailCard>

      <EditMatchLocationFields
        initialStadiumId={match.match_stadium_id}
        initialCityId={match.match_city_id}
        stadiums={options.stadiums}
        cities={options.cities}
        countries={countries}
      />

      <MatchDetailCard label="Status meczu">
        <div className="flex flex-col gap-1.5">
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
      </MatchDetailCard>

      <MatchDetailCard label="Sposób zakończenia meczu">
        <div className="flex flex-col gap-1.5">
          <select
            id="result_type"
            name="result_type"
            defaultValue={match.result_type ?? ''}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          >
            <option value="">Brak danych</option>
            {RESULT_TYPE_OPTIONS.map((resultType) => (
              <option key={resultType.value} value={resultType.value}>
                {resultType.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">
            Wymagane dla meczu zakończonego. Dla innych statusów zostanie wyczyszczone.
          </p>
        </div>
      </MatchDetailCard>

      <MatchDetailCard label="Status redakcji" spanTwo>
        <div className="flex flex-col gap-1.5">
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
      </MatchDetailCard>
    </div>
  ) : (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <MatchDetailCard label="Stadion">
        <MatchFieldValue value={stadiumName} />
      </MatchDetailCard>

      <MatchDetailCard label="Miasto meczu">
        <MatchFieldValue value={cityName} />
      </MatchDetailCard>
    </div>
  )

  const matchTitle = `${match.home_team_name} vs ${match.away_team_name}`
  const matchDateTimeLabel = `${formatDate(match.match_date)}${match.match_time ? ` ${match.match_time.slice(0, 5)}` : ''}`
  const currentReferee = participants.referees[0] ?? null

  if (isEdit) {
    return (
      <EditMatchFormWrapper>
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
              <RefereePersonField
                name="referee_person_id"
                value={currentReferee?.person_id ?? ''}
                people={participants.people}
                placeholder="Wybierz lub wpisz sędziego..."
                cities={cities}
                countries={countries}
              />
            </div>
          </section>

          <section className="mt-6 grid gap-6 2xl:grid-cols-2">
            <MatchTeamParticipantsSection
              namePrefix="home_"
              title={match.home_team_name}
              participants={participants.homeParticipants}
              people={participants.people}
              clubTeams={clubTeams}
              latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
              isEdit={true}
              cities={cities}
              countries={countries}
            />
            <MatchTeamParticipantsSection
              namePrefix="away_"
              title={match.away_team_name}
              participants={participants.awayParticipants}
              people={participants.people}
              clubTeams={clubTeams}
              latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
              isEdit={true}
              cities={cities}
              countries={countries}
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
    </EditMatchFormWrapper>
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
        breadcrumb={matchDateTimeLabel}
        subtitle={competitionName}
        headerRight={(
          <div className="flex items-center gap-2">
            <ResultTypeBadge resultType={match.result_type} />
            <MatchStatusBadge status={match.match_status} />
            <EditorialStatusBadge status={match.editorial_status} />
          </div>
        )}
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
          clubTeams={clubTeams}
          latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
          isEdit={false}
          cities={cities}
          countries={countries}
        />
        <MatchTeamParticipantsSection
          namePrefix="away_"
          title={match.away_team_name}
          participants={participants.awayParticipants}
          people={participants.people}
          clubTeams={clubTeams}
          latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
          isEdit={false}
          cities={cities}
          countries={countries}
        />
      </section>
    </DetailsPageContainer>
  )
}
