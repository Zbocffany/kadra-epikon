import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import MatchCoachesForm from './MatchCoachesForm'
import type { MatchEventPersonOption } from './MatchEventsForm'
import MatchSquadForm from './MatchSquadForm'
import MatchEventsForm from './MatchEventsForm'
import ValidationIssuesModal from './ValidationIssuesModal'
import EditMatchFormWrapper from './EditMatchFormWrapper'
import EditMatchLocationFields from './EditMatchLocationFields'
import RefereePersonField from './RefereePersonField'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { Icon, type AppIconName } from '@/components/icons'
import { deleteMatch, saveMatchFull } from '../actions'
import { createClubInline } from '@/app/admin/clubs/actions'
import { getMatchStatusLabel, MATCH_STATUS_OPTIONS } from '../matchStatusLabels'
import { getResultTypeLabel, RESULT_TYPE_OPTIONS } from '../resultTypeLabels'
import { compareByPlayerPosition } from '../playerPositionSort'
import { renderCreateClubInlineForm } from '../inlineCreateForms'
import { calculateMatchScore, getDisplayScore } from '../scoreCalculation'
import {
  DetailsPageContainer,
  DetailsPageContent,
  DetailsPageHeader,
} from '@/components/admin/DetailsPageLayout'
import {
  getAdminClubTeamOptions,
  getLatestPlayerClubTeamByPersonIds,
  getLatestPlayerPositionByPersonIds,
  getAdminMatchCreateOptions,
  getAdminMatchDetails,
  getAdminMatchEvents,
  getAdminMatchParticipants,
  type AdminMatchEvent,
  type AdminMatchDetails,
  type AdminMatchParticipant,
  type AdminMatchParticipantPersonOption,
  type AdminTeamOption,
  type PlayerPosition,
} from '@/lib/db/matches'
import { getAdminPersonBirthCityOptions, type AdminPersonBirthCityOption } from '@/lib/db/people'
import { getAdminCountriesOptions, type AdminCountryOption } from '@/lib/db/cities'
import { getAdminFederations, type AdminFederation } from '@/lib/db/countries'
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

function compareEventsChronologically(a: AdminMatchEvent, b: AdminMatchEvent) {
  if (a.minute !== b.minute) return a.minute - b.minute
  const aExtra = a.minute_extra ?? 0
  const bExtra = b.minute_extra ?? 0
  if (aExtra !== bExtra) return aExtra - bExtra
  return (a.event_order ?? Number.MAX_SAFE_INTEGER) - (b.event_order ?? Number.MAX_SAFE_INTEGER)
}

function getSquadEventIconName(eventType: AdminMatchEvent['event_type']): AppIconName | null {
  if (eventType === 'GOAL') return 'goal'
  if (eventType === 'OWN_GOAL') return 'ownGoal'
  if (eventType === 'PENALTY_GOAL' || eventType === 'PENALTY_SHOOTOUT_SCORED') return 'penaltyGoal'
  if (eventType === 'PENALTY_SHOOTOUT_MISSED' || eventType === 'MATCH_PENALTY_MISSED') return 'missedPenalty'
  if (eventType === 'PENALTY_SHOOTOUT_SAVED' || eventType === 'MATCH_PENALTY_SAVED') return 'savedPenalty'
  if (eventType === 'YELLOW_CARD') return 'yellowCard'
  if (eventType === 'SECOND_YELLOW_CARD') return 'secondYellowCard'
  if (eventType === 'RED_CARD') return 'redCard'
  if (eventType === 'SUBSTITUTION') return 'substitution'
  return null
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

function PositionBadge({ position }: { position: PlayerPosition | null }) {
  const label = getPlayerPositionLabel(position)
  const letter = label?.[0] ?? '–'

  const letterColorByPosition: Partial<Record<PlayerPosition, string>> = {
    GOALKEEPER: 'text-orange-300',
    DEFENDER: 'text-rose-300',
    MIDFIELDER: 'text-sky-300',
    ATTACKER: 'text-lime-300',
  }

  const letterClass = position ? (letterColorByPosition[position] ?? 'text-neutral-100') : 'text-neutral-100'

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 bg-black ring-1 ring-neutral-700/70 text-[11px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.9),0_6px_10px_rgba(0,0,0,0.45)] [text-shadow:0_1px_1px_rgba(0,0,0,0.9)] ${letterClass}`}
      title={label ?? undefined}
    >
      {letter}
    </span>
  )
}

function MatchTeamParticipantsView({
  participants,
  events,
}: {
  participants: AdminMatchParticipant[]
  events: AdminMatchEvent[]
}) {
  const sortByPos = (a: AdminMatchParticipant, b: AdminMatchParticipant) =>
    compareByPlayerPosition(a, b, (player) => player.player_position)

  const starters = participants.filter((p) => p.role === 'PLAYER' && p.is_starting).sort(sortByPos)
  const bench = participants.filter((p) => p.role === 'PLAYER' && !p.is_starting).sort(sortByPos)
  const coaches = participants.filter((p) => p.role === 'COACH')
  const hasPlayers = starters.length > 0 || bench.length > 0

  type PlayerEventIcon = { iconName: AppIconName; minute: string | null; minuteLeft: boolean }

  const personEventIcons = new Map<string, PlayerEventIcon[]>()
  const orderedEvents = [...events].sort(compareEventsChronologically)

  const formatEventMinute = (ev: AdminMatchEvent): string =>
    ev.minute_extra && ev.minute_extra > 0
      ? `${ev.minute}+${ev.minute_extra}'`
      : `${ev.minute}'`

  const appendIcon = (personId: string | null, iconName: AppIconName, minute: string | null = null, minuteLeft = false) => {
    if (!personId) return
    const entry: PlayerEventIcon = { iconName, minute, minuteLeft }
    const existing = personEventIcons.get(personId)
    if (existing) {
      existing.push(entry)
      return
    }
    personEventIcons.set(personId, [entry])
  }

  for (const event of orderedEvents) {
    const iconName = getSquadEventIconName(event.event_type)
    const minute = event.event_type === 'SUBSTITUTION' ? formatEventMinute(event) : null
    if (iconName) {
      appendIcon(event.primary_person_id, iconName, minute, false)
    }

    if (event.secondary_person_id) {
      if (event.event_type === 'GOAL') {
        appendIcon(event.secondary_person_id, 'assist')
      } else if (iconName) {
        appendIcon(event.secondary_person_id, iconName, minute, true)
      }
    }
  }

  function renderPlayerNameWithIcons(player: AdminMatchParticipant, textClassName: string) {
    const icons = personEventIcons.get(player.person_id) ?? []

    return (
      <div className="flex items-center">
        <span className={`min-w-0 truncate ${textClassName}`}>{player.person_name}</span>
        {icons.length > 0 ? (
          <span className="inline-flex shrink-0 items-center">
            <span aria-hidden>{'\u00A0'.repeat(5)}</span>
            <span className="inline-flex items-center gap-1.5 text-neutral-300">
              {icons.map(({ iconName, minute, minuteLeft }, index) => (
                <span key={`${player.id}-${iconName}-${index}`} className="inline-flex items-center gap-0.5">
                  {minute && minuteLeft ? (
                    <span className="text-[10px] font-semibold leading-none text-neutral-400">{minute}</span>
                  ) : null}
                  <Icon
                    name={iconName}
                    className="h-4 w-4 shrink-0"
                  />
                  {minute && !minuteLeft ? (
                    <span className="text-[10px] font-semibold leading-none text-neutral-400">{minute}</span>
                  ) : null}
                </span>
              ))}
            </span>
          </span>
        ) : null}
      </div>
    )
  }

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
                <tr key={player.id}>
                  <td className="bg-neutral-950 px-3 py-2 text-sm text-neutral-500">{index + 1}</td>
                  <td className="bg-neutral-950 py-2 pl-0 pr-2">
                    <PositionBadge position={player.player_position} />
                  </td>
                  <td className="bg-neutral-950 px-3 py-2 text-sm">{renderPlayerNameWithIcons(player, 'text-neutral-100')}</td>
                </tr>
              ))}
              {bench.length > 0 && (
                <tr>
                  <td colSpan={3} className="bg-neutral-950 px-3 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                    Ławka rezerwowych
                  </td>
                </tr>
              )}
              {bench.map((player, index) => (
                <tr key={player.id}>
                  <td className="bg-neutral-900/40 px-3 py-2 text-sm text-neutral-600">{starters.length + index + 1}</td>
                  <td className="bg-neutral-900/40 py-2 pl-0 pr-2">
                    <PositionBadge position={player.player_position} />
                  </td>
                  <td className="bg-neutral-900/40 px-3 py-2 text-sm">{renderPlayerNameWithIcons(player, 'text-neutral-300')}</td>
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
  events,
  people,
  clubTeams,
  latestPlayerClubTeamByPersonId,
  latestPlayerPositionByPersonId,
  isEdit,
  cities,
  countries,
  federations,
}: {
  namePrefix: string
  title: string
  participants: AdminMatchParticipant[]
  events: AdminMatchEvent[]
  people: AdminMatchParticipantPersonOption[]
  clubTeams: AdminTeamOption[]
  latestPlayerClubTeamByPersonId: Record<string, string | null>
  latestPlayerPositionByPersonId: Record<string, PlayerPosition | null>
  isEdit: boolean
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
  federations: AdminFederation[]
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
              latestPlayerPositionByPersonId={latestPlayerPositionByPersonId}
              cities={cities}
              countries={countries}
              federations={federations}
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
                federations={federations}
              />
            </div>
          </div>
        </>
      ) : (
        <MatchTeamParticipantsView participants={participants} events={events} />
      )}
    </section>
  )
}

function MatchEventsSectionEdit({
  events,
  people,
  teams,
  matchId,
  wasSaved,
}: {
  events: AdminMatchEvent[]
  people: MatchEventPersonOption[]
  teams: AdminTeamOption[]
  matchId: string
  wasSaved: boolean
}) {
  return (
    <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="text-xl font-semibold text-neutral-100">Zdarzenia meczowe</h2>
      <div className="mt-4">
        <MatchEventsForm
          events={events}
          people={people}
          teams={teams}
          matchId={matchId}
          clearDraft={wasSaved}
        />
      </div>
    </section>
  )
}

function MatchLineupsSummarySection({
  homeTeamName,
  awayTeamName,
  score,
  halftimeScore,
  events,
  homeTeamId,
  awayTeamId,
  personNameById,
}: {
  homeTeamName: string
  awayTeamName: string
  score: string
  halftimeScore: string
  events: AdminMatchEvent[]
  homeTeamId: string
  awayTeamId: string
  personNameById: Map<string, string>
}) {
  const sortedEvents = [...events].sort((a, b) => {
    if (a.minute !== b.minute) return b.minute - a.minute
    const aExtra = a.minute_extra ?? 0
    const bExtra = b.minute_extra ?? 0
    if (aExtra !== bExtra) return bExtra - aExtra
    return (b.event_order ?? Number.MAX_SAFE_INTEGER) - (a.event_order ?? Number.MAX_SAFE_INTEGER)
  })

  const chronologicalEvents = [...events].sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute
    const aExtra = a.minute_extra ?? 0
    const bExtra = b.minute_extra ?? 0
    if (aExtra !== bExtra) return aExtra - bExtra
    return (a.event_order ?? Number.MAX_SAFE_INTEGER) - (b.event_order ?? Number.MAX_SAFE_INTEGER)
  })

  const GOAL_TYPES = new Set<AdminMatchEvent['event_type']>(['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'])

  const EVENT_TYPE_LABEL: Record<AdminMatchEvent['event_type'], string> = {
    GOAL: 'Gol',
    OWN_GOAL: 'Gol samobojczy',
    PENALTY_GOAL: 'Gol z karnego',
    YELLOW_CARD: 'Zolta kartka',
    SECOND_YELLOW_CARD: 'Druga zolta kartka',
    RED_CARD: 'Czerwona kartka',
    PENALTY_SHOOTOUT_SCORED: 'Karny pomeczowy gol',
    PENALTY_SHOOTOUT_MISSED: 'Karny pomeczowy pudlo',
    PENALTY_SHOOTOUT_SAVED: 'Karny pomeczowy obroniony',
    MATCH_PENALTY_SAVED: 'Obroniony karny',
    MATCH_PENALTY_MISSED: 'Nietrafiony karny',
    SUBSTITUTION: 'Zmiana',
  }

  function isFirstHalf(event: AdminMatchEvent): boolean {
    return event.minute <= 45
  }

  function renderMinute(event: AdminMatchEvent): string {
    if (event.minute_extra && event.minute_extra > 0) {
      return `${event.minute}+${event.minute_extra}'`
    }
    return `${event.minute}'`
  }

  function getEventIconName(eventType: AdminMatchEvent['event_type']): 'goal' | 'ownGoal' | 'penaltyGoal' | 'missedPenalty' | 'savedPenalty' | 'yellowCard' | 'secondYellowCard' | 'redCard' | 'substitution' | null {
    if (eventType === 'GOAL') return 'goal'
    if (eventType === 'OWN_GOAL') return 'ownGoal'
    if (eventType === 'PENALTY_GOAL') return 'penaltyGoal'
    if (eventType === 'PENALTY_SHOOTOUT_MISSED' || eventType === 'MATCH_PENALTY_MISSED') return 'missedPenalty'
    if (eventType === 'PENALTY_SHOOTOUT_SAVED' || eventType === 'MATCH_PENALTY_SAVED') return 'savedPenalty'
    if (eventType === 'YELLOW_CARD') return 'yellowCard'
    if (eventType === 'SECOND_YELLOW_CARD') return 'secondYellowCard'
    if (eventType === 'RED_CARD') return 'redCard'
    if (eventType === 'SUBSTITUTION') return 'substitution'
    return null
  }

  function renderEventText(event: AdminMatchEvent): ReactNode {
    const primary = event.primary_person_id ? (personNameById.get(event.primary_person_id) ?? 'Nieznany') : null
    const secondary = event.secondary_person_id ? (personNameById.get(event.secondary_person_id) ?? 'Nieznany') : null

    if (event.event_type === 'SUBSTITUTION') {
      const incoming = secondary ?? 'Nieznany'
      const outgoing = primary ?? 'Nieznany'
      return (
        <>
          <span className="font-semibold text-neutral-100">{incoming}</span>
          <span className="font-normal text-neutral-500"> {outgoing}</span>
        </>
      )
    }

    if (event.event_type === 'GOAL') {
      return (
        <>
          <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-sm font-semibold text-neutral-100">
            <Icon name="goal" className="mr-1 h-4 w-4 shrink-0" />
            {primary ?? 'Nieznany'}
          </span>
          {secondary ? (
            <span className="font-normal text-neutral-500"> {secondary}</span>
          ) : null}
        </>
      )
    }

    if (event.event_type === 'PENALTY_GOAL') {
      return (
        <>
          <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-sm font-semibold text-neutral-100">
            <Icon name="penaltyGoal" className="mr-1 h-4 w-4 shrink-0" />
            {primary ?? 'Nieznany'}
          </span>
          <span className="font-normal text-neutral-500"> (Rzut karny)</span>
        </>
      )
    }

    if (event.event_type === 'OWN_GOAL') {
      return (
        <>
          <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-sm font-semibold text-neutral-100">
            <Icon name="ownGoal" className="mr-1 h-4 w-4 shrink-0" />
            {primary ?? 'Nieznany'}
          </span>
          <span className="font-normal text-neutral-500"> (Gol samobójczy)</span>
        </>
      )
    }

    if (event.event_type === 'PENALTY_SHOOTOUT_MISSED' || event.event_type === 'MATCH_PENALTY_MISSED') {
      return (
        <>
          <span className="font-semibold text-neutral-100">{primary ?? 'Nieznany'}</span>
          <span className="font-normal text-neutral-500"> (Nietrafiony karny)</span>
        </>
      )
    }

    if (event.event_type === 'PENALTY_SHOOTOUT_SAVED' || event.event_type === 'MATCH_PENALTY_SAVED') {
      return (
        <>
          <span className="font-semibold text-neutral-100">{primary ?? 'Nieznany'}</span>
          <span className="font-normal text-neutral-500"> (Obroniony karny)</span>
        </>
      )
    }

    if (event.event_type === 'YELLOW_CARD' || event.event_type === 'SECOND_YELLOW_CARD' || event.event_type === 'RED_CARD') {
      return primary ?? 'Nieznany'
    }

    return `${EVENT_TYPE_LABEL[event.event_type]}${primary ? ` - ${primary}` : ''}`
  }

  function getHalfScore(halfEvents: AdminMatchEvent[]): string {
    let homeGoals = 0
    let awayGoals = 0

    for (const event of halfEvents) {
      if (!GOAL_TYPES.has(event.event_type)) continue

      if (event.team_id === homeTeamId) homeGoals += 1
      else if (event.team_id === awayTeamId) awayGoals += 1
    }

    return `${homeGoals} : ${awayGoals}`
  }

  const SHOOTOUT_TYPES = new Set<AdminMatchEvent['event_type']>([
    'PENALTY_SHOOTOUT_SCORED',
    'PENALTY_SHOOTOUT_MISSED',
    'PENALTY_SHOOTOUT_SAVED',
  ])

  type MatchPhaseKey = 'SHOOTOUT' | 'EXTRA_2' | 'EXTRA_1' | 'HALF_2' | 'HALF_1'

  function getPhaseKey(event: AdminMatchEvent): MatchPhaseKey {
    if (SHOOTOUT_TYPES.has(event.event_type)) return 'SHOOTOUT'
    if (event.minute > 105) return 'EXTRA_2'
    if (event.minute > 90) return 'EXTRA_1'
    if (event.minute > 45) return 'HALF_2'
    return 'HALF_1'
  }

  const phaseTitles: Record<MatchPhaseKey, string> = {
    SHOOTOUT: 'SERIA KARNYCH',
    EXTRA_2: '2. DOGRYWKA',
    EXTRA_1: '1. DOGRYWKA',
    HALF_2: '2. POŁOWA',
    HALF_1: '1. POŁOWA',
  }

  const phaseOrder: MatchPhaseKey[] = ['SHOOTOUT', 'EXTRA_2', 'EXTRA_1', 'HALF_2', 'HALF_1']

  const phaseEventsMap = new Map<MatchPhaseKey, AdminMatchEvent[]>(
    phaseOrder.map((phase) => [phase, []])
  )

  for (const event of sortedEvents) {
    const phase = getPhaseKey(event)
    phaseEventsMap.get(phase)?.push(event)
  }

  const phaseSections = phaseOrder
    .map((phase) => ({
      phase,
      title: phaseTitles[phase],
      events: phaseEventsMap.get(phase) ?? [],
    }))
    .filter((section) => section.events.length > 0)

  let runningHome = 0
  let runningAway = 0
  const runningScoreByEventId = new Map<string, string>()
  for (const event of chronologicalEvents) {
    if (GOAL_TYPES.has(event.event_type)) {
      if (event.team_id === homeTeamId) {
        runningHome += 1
      } else if (event.team_id === awayTeamId) {
        runningAway += 1
      }
      runningScoreByEventId.set(event.id, `${runningHome} : ${runningAway}`)
    }
  }

  function HalfBlock({
    title,
    halfEvents,
  }: {
    title: string
    halfEvents: AdminMatchEvent[]
  }) {
    return (
      <details open className="overflow-hidden rounded-lg border border-neutral-800 group">
        <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 marker:content-none">
          <span>{title}</span>
          <span className="inline-flex items-center gap-2">
            <span>{getHalfScore(halfEvents)}</span>
            <span className="text-sm font-bold leading-none text-neutral-400 transition-transform duration-150 group-open:rotate-180">▾</span>
          </span>
        </summary>

        {halfEvents.length === 0 ? (
          <div className="bg-neutral-950 px-3 py-3 text-sm text-neutral-500">Brak zdarzeń.</div>
        ) : (
          <div>
            {halfEvents.map((event) => {
              const side = event.team_id === homeTeamId ? 'home' : event.team_id === awayTeamId ? 'away' : 'neutral'
              const iconName = getEventIconName(event.event_type)
              const text = renderEventText(event)
              const minuteLabel = renderMinute(event)
              const runningScore = runningScoreByEventId.get(event.id)
              const minuteClass =
                'inline-flex shrink-0 items-center rounded-md border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 text-xs font-semibold leading-none text-neutral-200'

              const content = (
                <div className="inline-flex items-center gap-2 text-sm text-neutral-100">
                  {event.event_type === 'GOAL' || event.event_type === 'OWN_GOAL' || event.event_type === 'PENALTY_GOAL' ? (
                    <span>{text}</span>
                  ) : event.event_type === 'PENALTY_SHOOTOUT_MISSED' || event.event_type === 'MATCH_PENALTY_MISSED' ? (
                    <>
                      <Icon name="missedPenalty" className="h-4 w-4 shrink-0" />
                      <span>{text}</span>
                    </>
                  ) : iconName ? (
                    <>
                      <Icon name={iconName} className="h-4 w-4 shrink-0" />
                      {event.event_type === 'SUBSTITUTION' ? (
                        <span>{text}</span>
                      ) : (
                        <span className="font-semibold">{text}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm bg-pink-500" />
                      <span className="font-semibold">{text}</span>
                    </>
                  )}
                </div>
              )

              return (
                <div key={event.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-neutral-950 px-3 py-2">
                  <div className="min-w-0">
                    {side === 'home' ? (
                      <div className="flex items-center gap-2">
                        <span className={minuteClass}>{minuteLabel}</span>
                        <div className="min-w-0 truncate">{content}</div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    {runningScore ? (
                      <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-xs font-semibold text-neutral-200">
                        {runningScore}
                      </span>
                    ) : side === 'neutral' ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className={minuteClass}>{minuteLabel}</span>
                        {content}
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0 text-right">
                    {side === 'away' ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="min-w-0 truncate">{content}</div>
                        <span className={minuteClass}>{minuteLabel}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </details>
    )
  }

  return (
    <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="rounded-2xl border border-neutral-700 bg-neutral-900/60 px-5 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <p className="truncate text-left text-2xl font-bold text-neutral-100 sm:text-3xl">{homeTeamName}</p>
          <div className="text-center">
            <p className="text-2xl font-bold text-neutral-100 sm:text-3xl">{score}</p>
            <p className="mt-0.5 text-[11px] font-medium text-neutral-400">Do przerwy: {halftimeScore}</p>
          </div>
          <p className="truncate text-right text-2xl font-bold text-neutral-100 sm:text-3xl">{awayTeamName}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {phaseSections.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-neutral-500">Brak zdarzeń.</div>
        ) : (
          phaseSections.map((section) => (
            <HalfBlock key={section.phase} title={section.title} halfEvents={section.events} />
          ))
        )}
      </div>
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
  const validationErrors = error?.startsWith('VALIDATION_LIST::')
    ? error.replace('VALIDATION_LIST::', '').split('||').map((item) => item.trim()).filter(Boolean)
    : []
  const plainError = validationErrors.length ? null : error

  const match = await getAdminMatchDetails(id)

  if (!match) {
    notFound()
  }

  const [options, participants, cities, countries, federations, clubTeams, events] = await Promise.all([
    getAdminMatchCreateOptions(),
    getAdminMatchParticipants(match),
    getAdminPersonBirthCityOptions(),
    getAdminCountriesOptions(),
    getAdminFederations(),
    getAdminClubTeamOptions(),
    getAdminMatchEvents(match.id),
  ])

  const latestPlayerClubTeamByPersonId = await getLatestPlayerClubTeamByPersonIds(
    participants.people.map((person) => person.id),
    { excludeMatchId: match.id }
  )

  const latestPlayerPositionByPersonId = await getLatestPlayerPositionByPersonIds(
    participants.people.map((person) => person.id),
    { excludeMatchId: match.id }
  )

  const eventPeopleById = new Map<string, MatchEventPersonOption>()

  for (const participant of [
    ...participants.homeParticipants,
    ...participants.awayParticipants,
    ...participants.referees,
  ]) {
    const existing = eventPeopleById.get(participant.person_id)
    const nextTeamIds = participant.team_id
      ? (existing?.teamIds.includes(participant.team_id)
          ? existing.teamIds
          : [...(existing?.teamIds ?? []), participant.team_id])
      : (existing?.teamIds ?? [])

    eventPeopleById.set(participant.person_id, {
      id: participant.person_id,
      label: participant.person_name,
      teamIds: nextTeamIds,
    })
  }

  const eventPeople = [...eventPeopleById.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))
  const personNameById = new Map(eventPeople.map((person) => [person.id, person.label]))

  const eventTeams = [
    options.teams.find((team) => team.id === match.home_team_id) ?? {
      id: match.home_team_id,
      label: match.home_team_name,
    },
    options.teams.find((team) => team.id === match.away_team_id) ?? {
      id: match.away_team_id,
      label: match.away_team_name,
    },
  ]

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
  const hasStadiumName = stadiumName !== '—'
  const hasCityName = cityName !== '—'
  // Avoid repeating city if already present in stadium name
  let stadiumSummary: string | null = null;
  if (hasStadiumName) {
    // Check if cityName is already in stadiumName (case-insensitive, ignore accents)
    const normalize = (str: string) => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    if (hasCityName && !normalize(stadiumName).includes(normalize(cityName))) {
      stadiumSummary = `${stadiumName} (${cityName})`;
    } else {
      stadiumSummary = stadiumName;
    }
  } else if (hasCityName) {
    stadiumSummary = cityName;
  } else {
    stadiumSummary = null;
  }

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

      <MatchDetailCard label="Rozgrywki">
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

      <MatchDetailCard label="Poziom">
        <AdminSelectField
          name="match_level_id"
          label="Poziom"
          hideLabel
          selectedId={match.match_level_id}
          emptyOptionLabel="— brak —"
          options={options.matchLevels.map((level) => ({ id: level.id, label: level.name }))}
          displayKey="label"
          placeholder="Wpisz, aby filtrować poziom..."
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
            federations,
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
            federations,
          })}
        />
      </MatchDetailCard>

      <EditMatchLocationFields
        initialStadiumId={match.match_stadium_id}
        initialCityId={match.match_city_id}
        stadiums={options.stadiums}
        cities={options.cities}
        countries={countries}
        federations={federations}
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
  ) : null

  const matchTitle = `${match.home_team_name} vs ${match.away_team_name}`
  const deleteWarningMessage = `Uwaga: usunięcie meczu "${matchTitle}" jest nieodwracalne. Zostaną usunięte wszystkie zdarzenia meczowe oraz wszystkie przypisania osób do tego meczu (składy, sztab, sędzia). Same osoby nie zostaną usunięte z bazy.`
  const matchDateTimeLabel = `${formatDate(match.match_date)}${match.match_time ? ` ${match.match_time.slice(0, 5)}` : ''}`
  const currentReferee = participants.referees[0] ?? null
  const displayScore = getDisplayScore(events, match.result_type, match.home_team_id, match.away_team_id)
  const summaryScore = calculateMatchScore(events, match.home_team_id, match.away_team_id)
  const summaryScoreLabel = `${summaryScore.homeGoals}:${summaryScore.awayGoals}`
  const halftimeScoreLabel = `${summaryScore.homeGoalsHT}:${summaryScore.awayGoalsHT}`

  if (isEdit) {
    return (
      <EditMatchFormWrapper>
        <DetailsPageContainer maxWidthClass="max-w-5xl">
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
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {matchTitle}
              {displayScore && (
                <>
                  {'\u00A0'.repeat(10)}
                  {displayScore}
                </>
              )}
            </h1>

            {saved && (
              <div className="mt-6 rounded-lg border border-emerald-800 bg-emerald-950/50 px-5 py-4 text-sm text-emerald-300">
                Zmiany zostały zapisane.
              </div>
            )}

            {plainError && (
              <div className="mt-6 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
                {plainError}
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
                federations={federations}
              />
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <MatchTeamParticipantsSection
              namePrefix="home_"
              title={match.home_team_name}
              participants={participants.homeParticipants}
              events={events}
              people={participants.people}
              clubTeams={clubTeams}
              latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
              latestPlayerPositionByPersonId={latestPlayerPositionByPersonId}
              isEdit={true}
              cities={cities}
              countries={countries}
              federations={federations}
            />
            <MatchTeamParticipantsSection
              namePrefix="away_"
              title={match.away_team_name}
              participants={participants.awayParticipants}
              events={events}
              people={participants.people}
              clubTeams={clubTeams}
              latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
              latestPlayerPositionByPersonId={latestPlayerPositionByPersonId}
              isEdit={true}
              cities={cities}
              countries={countries}
              federations={federations}
            />
          </section>

          <MatchEventsSectionEdit
            events={events}
            people={eventPeople}
            teams={eventTeams}
            matchId={match.id}
            wasSaved={saved === '1'}
          />

          <div className="mt-8 flex items-center justify-end gap-2">
            <ConfirmSubmitButton
              formAction={deleteMatch}
              confirmMessage={deleteWarningMessage}
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

        {validationErrors.length > 0 && (
          <ValidationIssuesModal
            errors={validationErrors}
            exitHref={`/admin/matches/${match.id}`}
          />
        )}
      </DetailsPageContainer>
    </EditMatchFormWrapper>
    )
  }

  return (
    <DetailsPageContainer maxWidthClass="max-w-5xl">
      <DetailsPageHeader
        title={matchTitle}
        backLabel="Powrót do listy meczów"
        backHref="/admin/matches"
        editHref={`/admin/matches/${match.id}?mode=edit`}
        deleteAction={deleteMatch}
        deleteId={match.id}
        deleteConfirmMessage={deleteWarningMessage}
      />


      <DetailsPageContent
        title={null}
        breadcrumb={
          <div className="flex items-center gap-3">
            <span>{matchDateTimeLabel}</span>
            {competitionName && (
              <span
                className="inline-flex items-center rounded-md border border-neutral-400 px-2 py-0.5 font-bold text-xs text-white bg-black"
                style={{ fontSize: '0.95em', fontWeight: 700 }}
              >
                {competitionName}
              </span>
            )}
          </div>
        }
        subtitle={(
          <div className="mt-2">
            {stadiumSummary ? (
              <span
                className={
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-neutral-800 text-neutral-300 ring-neutral-700'
                }
              >
                {stadiumSummary}
              </span>
            ) : null}
            {stadiumSummary && currentReferee ? <span className="block h-2" /> : null}
            {currentReferee ? (
              <span
                className={
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-neutral-800 text-neutral-300 ring-neutral-700'
                }
              >
                Sędzia: {currentReferee.person_name}
                {currentReferee.country_code ? ` (${currentReferee.country_code})` : ''}
              </span>
            ) : null}
          </div>
        )}
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

      <MatchLineupsSummarySection
        homeTeamName={match.home_team_name}
        awayTeamName={match.away_team_name}
        score={summaryScoreLabel}
        halftimeScore={halftimeScoreLabel}
        events={events}
        homeTeamId={match.home_team_id}
        awayTeamId={match.away_team_id}
        personNameById={personNameById}
      />

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <MatchTeamParticipantsSection
          namePrefix="home_"
          title={match.home_team_name}
          participants={participants.homeParticipants}
          events={events}
          people={participants.people}
          clubTeams={clubTeams}
          latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
          latestPlayerPositionByPersonId={latestPlayerPositionByPersonId}
          isEdit={false}
          cities={cities}
          countries={countries}
          federations={federations}
        />
        <MatchTeamParticipantsSection
          namePrefix="away_"
          title={match.away_team_name}
          participants={participants.awayParticipants}
          events={events}
          people={participants.people}
          clubTeams={clubTeams}
          latestPlayerClubTeamByPersonId={latestPlayerClubTeamByPersonId}
          latestPlayerPositionByPersonId={latestPlayerPositionByPersonId}
          isEdit={false}
          cities={cities}
          countries={countries}
          federations={federations}
        />
      </section>
    </DetailsPageContainer>
  )
}
