import type { ReactNode } from 'react'
import CountryFlag from '@/components/CountryFlag'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import { DetailsPageContainer, DetailsPageContent } from '@/components/admin/DetailsPageLayout'
import GlossyDisclosureCircle from '@/components/admin/GlossyDisclosureCircle'
import { Icon, type AppIconName } from '@/components/icons'
import { compareByPlayerPosition } from '@/app/admin/matches/playerPositionSort'
import { calculateMatchScore } from '@/app/admin/matches/scoreCalculation'
import type {
  AdminMatchDetails,
  AdminMatchEvent,
  AdminMatchParticipant,
  AdminMatchParticipantPersonOption,
  PlayerPosition,
} from '@/lib/db/matches'

type MatchParticipantsBundle = {
  homeParticipants: AdminMatchParticipant[]
  awayParticipants: AdminMatchParticipant[]
  referees: AdminMatchParticipant[]
  people: AdminMatchParticipantPersonOption[]
}

type MatchReadOnlyPageProps = {
  match: AdminMatchDetails
  participants: MatchParticipantsBundle
  events: AdminMatchEvent[]
  backHref: string
  backLabel: string
  competitionName: string
  matchDateTimeLabel: string
  stadiumSummary: string | null
  headerRight?: ReactNode
  topBar?: ReactNode
}

function formatEventPersonDisplayName(person: AdminMatchParticipantPersonOption): string {
  const firstName = person.firstName.trim()
  const lastName = person.lastName.trim()
  const nickname = person.nickname.trim()

  if (lastName) {
    const firstNameParts = firstName.split(/\s+/).filter(Boolean).slice(0, 2)
    const initials = firstNameParts.map((part) => part[0]?.toUpperCase()).filter(Boolean).join('.')
    if (initials) return `${initials}. ${lastName}`
    return lastName
  }

  if (nickname) return nickname
  if (firstName) return firstName
  return 'Nieznany'
}

function getPlayerPositionLabel(playerPosition: PlayerPosition | null) {
  switch (playerPosition) {
    case 'GOALKEEPER': return 'Bramkarz'
    case 'DEFENDER': return 'Obrońca'
    case 'MIDFIELDER': return 'Pomocnik'
    case 'ATTACKER': return 'Napastnik'
    default: return null
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
      className={`relative inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-neutral-300 bg-black ring-1 ring-neutral-700/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.9),0_6px_10px_rgba(0,0,0,0.45)] ${letterClass}`}
      title={label ?? undefined}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_30%,rgba(255,255,255,0)_58%),linear-gradient(130deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0)_50%)]" />
      <span className="absolute inset-0 z-10 flex items-center justify-center text-[11px] font-black leading-none [text-shadow:0_1px_1px_rgba(0,0,0,0.9)]">{letter}</span>
    </span>
  )
}

function MatchTeamParticipantsView({ participants, events }: { participants: AdminMatchParticipant[]; events: AdminMatchEvent[] }) {
  const sortByPos = (a: AdminMatchParticipant, b: AdminMatchParticipant) => compareByPlayerPosition(a, b, (player) => player.player_position)
  const starters = participants.filter((p) => p.role === 'PLAYER' && p.is_starting).sort(sortByPos)
  const bench = participants.filter((p) => p.role === 'PLAYER' && !p.is_starting).sort(sortByPos)
  const coaches = participants.filter((p) => p.role === 'COACH')
  const hasPlayers = starters.length > 0 || bench.length > 0
  type PlayerEventIcon = { iconName: AppIconName; minute: string | null; minuteLeft: boolean }
  const personEventIcons = new Map<string, PlayerEventIcon[]>()
  const orderedEvents = [...events].sort(compareEventsChronologically)

  const formatEventMinute = (ev: AdminMatchEvent): string => ev.minute_extra && ev.minute_extra > 0 ? `${ev.minute}+${ev.minute_extra}'` : `${ev.minute}'`
  const appendIcon = (personId: string | null, iconName: AppIconName, minute: string | null = null, minuteLeft = false) => {
    if (!personId) return
    const entry: PlayerEventIcon = { iconName, minute, minuteLeft }
    const existing = personEventIcons.get(personId)
    if (existing) existing.push(entry)
    else personEventIcons.set(personId, [entry])
  }

  for (const event of orderedEvents) {
    const iconName = getSquadEventIconName(event.event_type)
    const minute = event.event_type === 'SUBSTITUTION' ? formatEventMinute(event) : null
    if (iconName) appendIcon(event.primary_person_id, iconName, minute, false)
    if (event.secondary_person_id) {
      if (event.event_type === 'GOAL' || event.event_type === 'OWN_GOAL') appendIcon(event.secondary_person_id, 'assist')
      else if (iconName) appendIcon(event.secondary_person_id, iconName, minute, true)
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
                  {minute && minuteLeft ? <span className="text-[10px] font-semibold leading-none text-neutral-400">{minute}</span> : null}
                  <Icon name={iconName} className="h-4 w-4 shrink-0" />
                  {minute && !minuteLeft ? <span className="text-[10px] font-semibold leading-none text-neutral-400">{minute}</span> : null}
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
            <colgroup><col className="w-8" /><col className="w-8" /><col /></colgroup>
            <tbody>
              {starters.map((player, index) => (
                <tr key={player.id}>
                  <td className="bg-neutral-950 px-3 py-1.5 text-sm text-neutral-500">{index + 1}</td>
                  <td className="bg-neutral-950 py-1.5 pl-0 pr-2"><PositionBadge position={player.player_position} /></td>
                  <td className="bg-neutral-950 px-3 py-1.5 text-sm">{renderPlayerNameWithIcons(player, 'text-neutral-100')}</td>
                </tr>
              ))}
              {bench.length > 0 ? <tr><td colSpan={3} className="bg-neutral-950 px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-neutral-500">Ławka rezerwowych</td></tr> : null}
              {bench.map((player, index) => (
                <tr key={player.id}>
                  <td className="bg-neutral-900/40 px-3 py-1.5 text-sm text-neutral-600">{starters.length + index + 1}</td>
                  <td className="bg-neutral-900/40 py-1.5 pl-0 pr-2"><PositionBadge position={player.player_position} /></td>
                  <td className="bg-neutral-900/40 px-3 py-1.5 text-sm">{renderPlayerNameWithIcons(player, 'text-neutral-300')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-neutral-500">Brak zawodników.</p>}

      {coaches.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Sztab</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {coaches.map((coach) => (
              <li key={coach.id} className="inline-flex w-fit rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm font-semibold text-neutral-200">
                {coach.person_name}
                {coach.country_code ? <span className="font-semibold text-neutral-200">{'\u00A0'}({coach.country_code})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ReadOnlyParticipantsSection({ title, participants, events }: { title: string; participants: AdminMatchParticipant[]; events: AdminMatchEvent[] }) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="text-xl font-semibold text-neutral-100">{title}</h2>
      <MatchTeamParticipantsView participants={participants} events={events} />
    </section>
  )
}

function MatchLineupsSummarySection({
  match,
  events,
  personNameById,
}: {
  match: AdminMatchDetails
  events: AdminMatchEvent[]
  personNameById: Map<string, string>
}) {
  const sortedEvents = [...events].sort((a, b) => {
    if (a.minute !== b.minute) return b.minute - a.minute
    const aExtra = a.minute_extra ?? 0
    const bExtra = b.minute_extra ?? 0
    if (aExtra !== bExtra) return bExtra - aExtra
    return (b.event_order ?? Number.MAX_SAFE_INTEGER) - (a.event_order ?? Number.MAX_SAFE_INTEGER)
  })
  const chronologicalEvents = [...events].sort(compareEventsChronologically)
  const GOAL_TYPES = new Set<AdminMatchEvent['event_type']>(['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'])
  type ScorerEntry = { id: string; minuteLabel: string; scorerName: string; eventType: AdminMatchEvent['event_type'] }

  function renderMinute(event: AdminMatchEvent): string {
    return event.minute_extra && event.minute_extra > 0 ? `${event.minute}+${event.minute_extra}'` : `${event.minute}'`
  }

  const goalEventsChronological = [...events].filter((event) => GOAL_TYPES.has(event.event_type)).sort(compareEventsChronologically)
  const homeScorers: ScorerEntry[] = []
  const awayScorers: ScorerEntry[] = []
  for (const event of goalEventsChronological) {
    const target = event.team_id === match.home_team_id ? homeScorers : event.team_id === match.away_team_id ? awayScorers : null
    if (!target) continue
    target.push({ id: event.id, minuteLabel: renderMinute(event), scorerName: event.primary_person_id ? (personNameById.get(event.primary_person_id) ?? 'Nieznany') : 'Nieznany', eventType: event.event_type })
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

  function renderGlossyScorerBadge(iconName: 'goal' | 'ownGoal' | 'penaltyGoal', label: string) {
    return (
      <span className="relative inline-flex items-center overflow-hidden rounded-md border border-neutral-500/80 bg-neutral-900 px-1.5 py-0.5 text-sm font-semibold text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)]">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]" />
        <span className="relative z-10 inline-flex items-center"><Icon name={iconName} className="mr-1 h-4 w-4 shrink-0" />{label}</span>
      </span>
    )
  }

  function renderGlossyEventScore(label: string, variant?: 'green' | 'red') {
    const borderClass = variant === 'green' ? 'border-emerald-500' : variant === 'red' ? 'border-red-500' : 'border-neutral-500/80'
    return (
      <span className={`relative inline-flex items-center overflow-hidden rounded-md border ${borderClass} bg-neutral-900 px-1.5 py-0.5 text-xs font-semibold text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)]`}>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]" />
        <span className="relative z-10">{label}</span>
      </span>
    )
  }

  function renderEventText(event: AdminMatchEvent): ReactNode {
    const primary = event.primary_person_id ? (personNameById.get(event.primary_person_id) ?? 'Nieznany') : null
    const secondary = event.secondary_person_id ? (personNameById.get(event.secondary_person_id) ?? 'Nieznany') : null
    if (event.event_type === 'SUBSTITUTION') {
      const incoming = secondary ?? 'Nieznany'
      const outgoing = primary ?? 'Nieznany'
      return <><span className="font-semibold text-neutral-100">{incoming}</span><span className="font-normal text-neutral-500"> {outgoing}</span></>
    }
    if (event.event_type === 'GOAL') return <>{renderGlossyScorerBadge('goal', primary ?? 'Nieznany')}{secondary ? <span className="font-normal text-neutral-500"> {secondary}</span> : null}</>
    if (event.event_type === 'PENALTY_GOAL') return <>{renderGlossyScorerBadge('penaltyGoal', primary ?? 'Nieznany')}<span className="font-normal text-neutral-500"> (Rzut karny)</span></>
    if (event.event_type === 'OWN_GOAL') return <>{renderGlossyScorerBadge('ownGoal', primary ?? 'Nieznany')}<span className="font-normal text-neutral-500"> (Gol samobójczy)</span></>
    if (event.event_type === 'PENALTY_SHOOTOUT_SCORED') return <>{renderGlossyScorerBadge('penaltyGoal', primary ?? 'Nieznany')}</>
    if (event.event_type === 'PENALTY_SHOOTOUT_MISSED' || event.event_type === 'MATCH_PENALTY_MISSED') return <><span className="font-semibold text-neutral-100">{primary ?? 'Nieznany'}</span><span className="font-normal text-neutral-500"> (Nietrafiony karny)</span></>
    if (event.event_type === 'PENALTY_SHOOTOUT_SAVED' || event.event_type === 'MATCH_PENALTY_SAVED') return <><span className="font-semibold text-neutral-100">{primary ?? 'Nieznany'}</span><span className="font-normal text-neutral-500"> (Obroniony karny)</span></>
    if (event.event_type === 'YELLOW_CARD' || event.event_type === 'SECOND_YELLOW_CARD' || event.event_type === 'RED_CARD') return primary ?? 'Nieznany'
    return primary ?? 'Nieznany'
  }

  function getHalfScore(halfEvents: AdminMatchEvent[]): string {
    const isShootoutPhase = halfEvents.some(e => SHOOTOUT_TYPES.has(e.event_type))
    let homeGoals = 0
    let awayGoals = 0
    for (const event of halfEvents) {
      const isScored = isShootoutPhase
        ? event.event_type === 'PENALTY_SHOOTOUT_SCORED'
        : GOAL_TYPES.has(event.event_type)
      if (!isScored) continue
      if (event.team_id === match.home_team_id) homeGoals += 1
      else if (event.team_id === match.away_team_id) awayGoals += 1
    }
    return `${homeGoals} : ${awayGoals}`
  }

  const SHOOTOUT_TYPES = new Set<AdminMatchEvent['event_type']>(['PENALTY_SHOOTOUT_SCORED', 'PENALTY_SHOOTOUT_MISSED', 'PENALTY_SHOOTOUT_SAVED'])
  type MatchPhaseKey = 'SHOOTOUT' | 'EXTRA_2' | 'EXTRA_1' | 'HALF_2' | 'HALF_1'
  function getPhaseKey(event: AdminMatchEvent): MatchPhaseKey {
    if (SHOOTOUT_TYPES.has(event.event_type)) return 'SHOOTOUT'
    if (event.minute > 105) return 'EXTRA_2'
    if (event.minute > 90) return 'EXTRA_1'
    if (event.minute > 45) return 'HALF_2'
    return 'HALF_1'
  }
  const phaseTitles: Record<MatchPhaseKey, string> = { SHOOTOUT: 'SERIA KARNYCH', EXTRA_2: '2. DOGRYWKA', EXTRA_1: '1. DOGRYWKA', HALF_2: '2. POŁOWA', HALF_1: '1. POŁOWA' }
  const phaseOrder: MatchPhaseKey[] = ['SHOOTOUT', 'EXTRA_2', 'EXTRA_1', 'HALF_2', 'HALF_1']
  const phaseEventsMap = new Map<MatchPhaseKey, AdminMatchEvent[]>(phaseOrder.map((phase) => [phase, []]))
  for (const event of sortedEvents) phaseEventsMap.get(getPhaseKey(event))?.push(event)
  const phaseSections = phaseOrder.map((phase) => ({ phase, title: phaseTitles[phase], events: phaseEventsMap.get(phase) ?? [] })).filter((section) => section.events.length > 0)

  const hasExtraTime = (phaseEventsMap.get('EXTRA_1') ?? []).length > 0 || (phaseEventsMap.get('EXTRA_2') ?? []).length > 0
  const hasShootout = (phaseEventsMap.get('SHOOTOUT') ?? []).length > 0

  let runningHome = 0
  let runningAway = 0
  const runningScoreByEventId = new Map<string, string>()
  let runningHomeShootout = 0
  let runningAwayShootout = 0
  const runningShootoutScoreByEventId = new Map<string, string>()
  for (const event of chronologicalEvents) {
    if (GOAL_TYPES.has(event.event_type)) {
      if (event.team_id === match.home_team_id) runningHome += 1
      else if (event.team_id === match.away_team_id) runningAway += 1
      runningScoreByEventId.set(event.id, `${runningHome} : ${runningAway}`)
    }
    if (event.event_type === 'PENALTY_SHOOTOUT_SCORED') {
      if (event.team_id === match.home_team_id) runningHomeShootout += 1
      else if (event.team_id === match.away_team_id) runningAwayShootout += 1
    }
    if (SHOOTOUT_TYPES.has(event.event_type)) {
      runningShootoutScoreByEventId.set(event.id, `${runningHomeShootout} : ${runningAwayShootout}`)
    }
  }

  function HalfBlock({ title, halfEvents }: { title: string; halfEvents: AdminMatchEvent[] }) {
    return (
      <details open className="overflow-hidden rounded-lg border border-neutral-800 group">
        <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 marker:content-none">
          <span>{title}</span>
          <span className="inline-flex items-center gap-2"><span>{getHalfScore(halfEvents)}</span><GlossyDisclosureCircle rotateClassName="group-open:rotate-180" /></span>
        </summary>
        {halfEvents.length === 0 ? <div className="bg-neutral-950 px-3 py-3 text-sm text-neutral-500">Brak zdarzeń.</div> : (
          <div>
            {halfEvents.map((event) => {
              const side = event.team_id === match.home_team_id ? 'home' : event.team_id === match.away_team_id ? 'away' : 'neutral'
              const iconName = getEventIconName(event.event_type)
              const text = renderEventText(event)
              const minuteLabel = renderMinute(event)
              const runningScore = SHOOTOUT_TYPES.has(event.event_type)
                ? runningShootoutScoreByEventId.get(event.id)
                : runningScoreByEventId.get(event.id)
              const scoreBadgeVariant = event.event_type === 'PENALTY_SHOOTOUT_SCORED'
                ? 'green'
                : event.event_type === 'PENALTY_SHOOTOUT_MISSED' || event.event_type === 'PENALTY_SHOOTOUT_SAVED'
                  ? 'red'
                  : undefined
              const isShootoutEvent = SHOOTOUT_TYPES.has(event.event_type)
              const minuteClass = 'inline-flex shrink-0 items-center rounded-md border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 text-xs font-semibold leading-none text-neutral-200'
              const minuteBadge = isShootoutEvent ? null : <span className={minuteClass}>{minuteLabel}</span>
              const content = (
                <div className="inline-flex items-center gap-2 text-sm text-neutral-100">
                  {event.event_type === 'GOAL' || event.event_type === 'OWN_GOAL' || event.event_type === 'PENALTY_GOAL' || event.event_type === 'PENALTY_SHOOTOUT_SCORED' ? (
                    <span>{text}</span>
                  ) : event.event_type === 'PENALTY_SHOOTOUT_MISSED' || event.event_type === 'MATCH_PENALTY_MISSED' ? (
                    <><Icon name="missedPenalty" className="h-4 w-4 shrink-0" /><span>{text}</span></>
                  ) : iconName ? (
                    <><Icon name={iconName} className="h-4 w-4 shrink-0" />{event.event_type === 'SUBSTITUTION' ? <span>{text}</span> : <span className="font-semibold">{text}</span>}</>
                  ) : (
                    <><span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm bg-pink-500" /><span className="font-semibold">{text}</span></>
                  )}
                </div>
              )

              return (
                <div key={event.id} className="bg-neutral-950 px-3 py-2">
                  {side === 'home' ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className="flex items-center gap-2">{minuteBadge}<div className="min-w-0">{content}</div></div>{runningScore ? renderGlossyEventScore(runningScore, scoreBadgeVariant) : <span />}<span /></div> : null}
                  {side === 'away' ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span />{runningScore ? renderGlossyEventScore(runningScore, scoreBadgeVariant) : <span />}<div className="flex items-center justify-end gap-2"><div className="min-w-0 text-right">{content}</div>{minuteBadge}</div></div> : null}
                  {side === 'neutral' ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span /><div className="flex items-center gap-2">{minuteBadge}{content}{runningScore ? renderGlossyEventScore(runningScore, scoreBadgeVariant) : null}</div><span /></div> : null}
                </div>
              )
            })}
          </div>
        )}
      </details>
    )
  }

  const summaryScore = calculateMatchScore(events, match.home_team_id, match.away_team_id)
  const summaryScoreLabel = `${summaryScore.homeGoals}:${summaryScore.awayGoals}`
  const halftimeScoreLabel = `${summaryScore.homeGoalsHT}:${summaryScore.awayGoalsHT}`

  return (
    <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="rounded-2xl border border-neutral-700 bg-neutral-900/60 px-5 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-2"><CountryFlag fifaCode={match.home_team_fifa_code} countryName={match.home_team_name} className="h-5 w-[30px]" /><p className="truncate text-left text-2xl font-bold text-neutral-100 sm:text-3xl">{match.home_team_name}</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-neutral-100 sm:text-3xl">{summaryScoreLabel}</p><p className="mt-0.5 text-[11px] font-medium text-neutral-400">Do przerwy: {halftimeScoreLabel}</p>{hasExtraTime && <p className="mt-0.5 text-[11px] font-medium text-neutral-400">Po dogrywce: {summaryScoreLabel}</p>}{hasShootout && <p className="mt-0.5 text-[11px] font-medium text-neutral-400">Karne: {summaryScore.homeShootoutScore}:{summaryScore.awayShootoutScore}</p>}</div>
          <div className="flex items-center justify-end gap-2"><p className="truncate text-right text-2xl font-bold text-neutral-100 sm:text-3xl">{match.away_team_name}</p><CountryFlag fifaCode={match.away_team_fifa_code} countryName={match.away_team_name} className="h-5 w-[30px]" /></div>
        </div>

        {(homeScorers.length > 0 || awayScorers.length > 0) ? (
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
            <div className="space-y-1">{homeScorers.map((entry) => <div key={entry.id} className="flex items-center gap-2 text-[13px]"><span className="inline-flex shrink-0 items-center rounded-md border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-neutral-200">{entry.minuteLabel}</span><span className="truncate font-semibold text-neutral-100">{entry.scorerName}{entry.eventType === 'PENALTY_GOAL' ? <span className="ml-1 font-normal text-neutral-400">(k.)</span> : entry.eventType === 'OWN_GOAL' ? <span className="ml-1 font-normal text-neutral-400">(sam.)</span> : null}</span></div>)}</div>
            <div />
            <div className="space-y-1">{awayScorers.map((entry) => <div key={entry.id} className="flex items-center justify-end gap-2 text-[13px]"><span className="truncate font-semibold text-neutral-100">{entry.scorerName}{entry.eventType === 'PENALTY_GOAL' ? <span className="ml-1 font-normal text-neutral-400">(k.)</span> : entry.eventType === 'OWN_GOAL' ? <span className="ml-1 font-normal text-neutral-400">(sam.)</span> : null}</span><span className="inline-flex shrink-0 items-center rounded-md border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-neutral-200">{entry.minuteLabel}</span></div>)}</div>
          </div>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        {phaseSections.length === 0 ? <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-neutral-500">Brak zdarzeń.</div> : phaseSections.map((section) => <HalfBlock key={section.phase} title={section.title} halfEvents={section.events} />)}
      </div>
    </section>
  )
}

export default function MatchReadOnlyPage({
  match,
  participants,
  events,
  backHref,
  backLabel,
  competitionName,
  matchDateTimeLabel,
  stadiumSummary,
  headerRight,
  topBar,
}: MatchReadOnlyPageProps) {
  const peopleById = new Map(participants.people.map((person) => [person.id, person]))
  const personNameById = new Map(
    participants.people.map((person) => [person.id, peopleById.get(person.id) ? formatEventPersonDisplayName(peopleById.get(person.id) as AdminMatchParticipantPersonOption) : person.label])
  )
  const currentReferee = participants.referees[0] ?? null
  const matchTitle = `${match.home_team_name} vs ${match.away_team_name}`

  return (
    <DetailsPageContainer maxWidthClass="max-w-5xl">
      {topBar ?? (
        <div className="mb-6">
          <SmartPrefetchLink
            href={backHref}
            prefetchOnMount
            preferHistoryBack
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            {backLabel}
          </SmartPrefetchLink>
        </div>
      )}

      <DetailsPageContent
        title={null}
        breadcrumb={
          <div className="flex items-center gap-3">
            <span>{matchDateTimeLabel}</span>
            {competitionName ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-neutral-400 px-2 py-0.5 font-bold text-xs text-white bg-black" style={{ fontSize: '0.95em', fontWeight: 700 }}>{competitionName}</span>
                {match.match_level_name ? <span className="inline-flex items-center rounded-md border border-neutral-400 px-2 py-0.5 font-bold text-xs text-white bg-black" style={{ fontSize: '0.95em', fontWeight: 700 }}>{match.match_level_name}</span> : null}
              </div>
            ) : null}
          </div>
        }
        subtitle={
          <div className="mt-2">
            {stadiumSummary ? <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-neutral-800 text-neutral-300 ring-neutral-700">{stadiumSummary}</span> : null}
            {stadiumSummary && currentReferee ? <span className="block h-2" /> : null}
            {currentReferee ? <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-neutral-800 text-neutral-300 ring-neutral-700">Sędzia: {currentReferee.person_name}{currentReferee.country_code ? ` (${currentReferee.country_code})` : ''}</span> : null}
          </div>
        }
        headerRight={headerRight}
        isEdit={false}
        editContent={null}
        viewContent={null}
      />

      <MatchLineupsSummarySection match={match} events={events} personNameById={personNameById} />

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReadOnlyParticipantsSection title={match.home_team_name} participants={participants.homeParticipants} events={events} />
        <ReadOnlyParticipantsSection title={match.away_team_name} participants={participants.awayParticipants} events={events} />
      </section>
    </DetailsPageContainer>
  )
}