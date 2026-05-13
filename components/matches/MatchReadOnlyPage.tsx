import type { ReactNode } from 'react'
import CountryFlag from '@/components/CountryFlag'
import InteractiveLineupGraphic from '@/components/matches/InteractiveLineupGraphic'
import { DetailsPageContainer } from '@/components/admin/DetailsPageLayout'
import { Icon, type AppIconName } from '@/components/icons'
import { compareByPlayerPosition } from '@/app/admin/matches/playerPositionSort'
import { calculateMatchScore } from '@/app/admin/matches/scoreCalculation'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import type {
  AdminMatchDetails,
  AdminMatchEvent,
  AdminMatchParticipant,
  AdminMatchParticipantPersonOption,
  PublicPolandPlayerMiniStats,
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
  polandPlayerMiniStats?: Record<string, PublicPolandPlayerMiniStats>
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

function getPositionInitial(position: PlayerPosition | null): string {
  if (position === 'GOALKEEPER') return 'B'
  if (position === 'DEFENDER') return 'O'
  if (position === 'MIDFIELDER') return 'P'
  if (position === 'ATTACKER') return 'N'
  return '?'
}

function PositionBadge({ position }: { position: PlayerPosition | null }) {
  const label = getPlayerPositionLabel(position)
  const letter = getPositionInitial(position)

  return (
    <span
      className="relative inline-flex h-6 w-6 items-center justify-center text-[9px] font-black uppercase tracking-[0.12em] text-emerald-900 shadow-[0_3px_6px_rgba(0,0,0,0.32)]"
      title={label ?? undefined}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M18 10h28l8 9-8 7v28H18V26l-8-7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
        <path d="M26 10h12v8H26z" fill="#1e7a43" opacity="0.85" />
        <path d="M11 19l7-9 8 9-8 7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
        <path d="M53 19l-7-9-8 9 8 7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
      </svg>
      <span className="relative z-10 mt-1">{letter}</span>
    </span>
  )
}

type PlayerEventIcon = { iconName: AppIconName; minute: string | null; minuteLeft: boolean }

function buildPersonEventIcons(events: AdminMatchEvent[]) {
  const personEventIcons = new Map<string, PlayerEventIcon[]>()
  const orderedEvents = [...events].sort(compareEventsChronologically)

  const formatEventMinute = (ev: AdminMatchEvent): string =>
    ev.minute_extra && ev.minute_extra > 0 ? `${ev.minute}+${ev.minute_extra}'` : `${ev.minute}'`

  const appendIcon = (
    personId: string | null,
    iconName: AppIconName,
    minute: string | null = null,
    minuteLeft = false
  ) => {
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

  return personEventIcons
}

function renderPlayerEventIcons(playerId: string, playerRowId: string, personEventIcons: Map<string, PlayerEventIcon[]>) {
  const icons = personEventIcons.get(playerId) ?? []
  if (icons.length === 0) return null

  return (
    <span className="inline-flex items-center gap-1.5 text-neutral-300">
      {icons.map(({ iconName, minute, minuteLeft }, index) => (
        <span key={`${playerRowId}-${iconName}-${index}`} className="inline-flex items-center gap-0.5">
          {minute && minuteLeft ? <span className="text-[10px] font-semibold leading-none text-neutral-400">{minute}</span> : null}
          <Icon name={iconName} className="h-4 w-4 shrink-0" />
          {minute && !minuteLeft ? <span className="text-[10px] font-semibold leading-none text-neutral-400">{minute}</span> : null}
        </span>
      ))}
    </span>
  )
}

function MatchTeamParticipantsView({ title, participants, events }: { title: string; participants: AdminMatchParticipant[]; events: AdminMatchEvent[] }) {
  const sortByPos = (a: AdminMatchParticipant, b: AdminMatchParticipant) => compareByPlayerPosition(a, b, (player) => player.player_position)
  const starters = participants.filter((p) => p.role === 'PLAYER' && p.is_starting).sort(sortByPos)
  const bench = participants.filter((p) => p.role === 'PLAYER' && !p.is_starting).sort(sortByPos)
  const coaches = participants.filter((p) => p.role === 'COACH')
  const hasPlayers = starters.length > 0 || bench.length > 0
  const personEventIcons = buildPersonEventIcons(events)

  function renderPlayerNameWithIcons(player: AdminMatchParticipant, textClassName: string) {
    return (
      <div className="flex items-center">
        {player.person_id ? (
          <SmartPrefetchLink
            href={`/people/${player.person_id}`}
            prefetch
            className={`group min-w-0 truncate ${textClassName} flex items-center`}
            style={{ textDecoration: 'none' }}
          >
            <span>{player.person_name}</span>
            <span
              aria-hidden
              className="ml-1 text-xs font-semibold text-blue-400 opacity-60 transition-opacity group-hover:opacity-100"
              title="Zobacz profil osoby"
            >
              →
            </span>
          </SmartPrefetchLink>
        ) : (
          <span className={`min-w-0 truncate ${textClassName}`}>{player.person_name}</span>
        )}
        {personEventIcons.get(player.person_id)?.length ? (
          <span className="inline-flex shrink-0 items-center">
            <span aria-hidden>{'\u00A0'.repeat(5)}</span>
            {renderPlayerEventIcons(player.person_id, player.id, personEventIcons)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {hasPlayers ? (
        <table className="w-full table-fixed">
          <colgroup><col className="w-8" /><col className="w-8" /><col /></colgroup>
          <tbody>
            {starters.map((player, index) => (
              <tr key={player.id}>
                <td className="px-3 py-1.5 text-sm font-semibold text-emerald-100/70">{index + 1}</td>
                <td className="py-1.5 pl-0 pr-2"><PositionBadge position={player.player_position} /></td>
                <td className="px-2 py-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    {player.person_id ? (
                      <SmartPrefetchLink
                        href={`/people/${player.person_id}`}
                        className="group inline-flex items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-sm font-semibold text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)] transition-colors hover:border-white/25"
                      >
                        {player.person_name}
                        <span aria-hidden className="ml-1 text-[10px] text-emerald-100/30 opacity-0 transition-opacity group-hover:opacity-100">↗</span>
                      </SmartPrefetchLink>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-sm font-semibold text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)]">{player.person_name}</span>
                    )}
                    {personEventIcons.get(player.person_id)?.length ? renderPlayerEventIcons(player.person_id, player.id, personEventIcons) : null}
                  </span>
                </td>
              </tr>
            ))}
            {bench.length > 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-emerald-100/60">Ławka rezerwowych</td>
              </tr>
            ) : null}
            {bench.map((player, index) => (
              <tr key={player.id}>
                <td className="px-3 py-1.5 text-sm font-semibold text-emerald-100/50">{starters.length + index + 1}</td>
                <td className="py-1.5 pl-0 pr-2"><PositionBadge position={player.player_position} /></td>
                <td className="px-2 py-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    {player.person_id ? (
                      <SmartPrefetchLink
                        href={`/people/${player.person_id}`}
                        className="group inline-flex items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-sm font-normal text-emerald-100/80 shadow-[0_4px_10px_rgba(0,0,0,0.35)] transition-colors hover:border-white/25"
                      >
                        {player.person_name}
                        <span aria-hidden className="ml-1 text-[10px] text-emerald-100/25 opacity-0 transition-opacity group-hover:opacity-100">↗</span>
                      </SmartPrefetchLink>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-sm font-normal text-emerald-100/80 shadow-[0_4px_10px_rgba(0,0,0,0.35)]">{player.person_name}</span>
                    )}
                    {personEventIcons.get(player.person_id)?.length ? renderPlayerEventIcons(player.person_id, player.id, personEventIcons) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="text-sm text-emerald-100/60">Brak zawodników.</p>}

      {coaches.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100/60">Sztab</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {coaches.map((coach) => (
              <li key={coach.id} className="inline-flex w-fit items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-sm font-semibold text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)]">
                {coach.person_name}
                {coach.country_code ? <span className="font-normal text-emerald-100/70">{'\u00A0'}({coach.country_code})</span> : null}
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
    <section className="overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)]">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
        <div className="relative z-10 px-5 pt-5 pb-1">
          <h2 className="text-xl font-semibold text-emerald-50">{title}</h2>
        </div>
        <div className="relative z-10 px-5 pb-5">
          <MatchTeamParticipantsView title={title} participants={participants} events={events} />
        </div>
      </div>
    </section>
  )
}

function MatchLineupsSummarySection({
  match,
  events,
  personNameById,
  topSpacingClassName,
  topPanel,
  lineupGraphic,
}: {
  match: AdminMatchDetails
  events: AdminMatchEvent[]
  personNameById: Map<string, string>
  topSpacingClassName?: string
  topPanel?: ReactNode
  lineupGraphic?: ReactNode
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
      <span className="relative inline-flex items-center overflow-hidden rounded-md border border-emerald-300/50 bg-emerald-950/82 px-1.5 py-0.5 text-sm font-semibold text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_1px_rgba(0,0,0,0.4),0_2px_5px_rgba(0,0,0,0.28)]">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.08)_34%,rgba(255,255,255,0)_72%)]" />
        <span className="relative z-10 inline-flex items-center"><Icon name={iconName} className="mr-1 h-4 w-4 shrink-0" />{label}</span>
      </span>
    )
  }

  function renderGlossyEventScore(label: string, variant?: 'green' | 'red') {
    const borderClass = variant === 'green' ? 'border-lime-300/65' : variant === 'red' ? 'border-rose-300/65' : 'border-emerald-300/50'
    return (
      <span className={`relative inline-flex items-center overflow-hidden rounded-md border ${borderClass} bg-emerald-950/82 px-1.5 py-0.5 text-xs font-semibold text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_1px_rgba(0,0,0,0.4),0_2px_5px_rgba(0,0,0,0.28)]`}>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.08)_34%,rgba(255,255,255,0)_72%)]" />
        <span className="relative z-10">{label}</span>
      </span>
    )
  }

  function renderPlayerBadge(label: string, bold = true) {
    return (
      <span className={`inline-flex items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)] ${bold ? 'text-sm font-semibold' : 'text-xs font-normal'}`}>
        {label}
      </span>
    )
  }

  function renderEventText(event: AdminMatchEvent, mirrored = false): ReactNode {
    const primary = event.primary_person_id ? (personNameById.get(event.primary_person_id) ?? 'Nieznany') : null
    const secondary = event.secondary_person_id ? (personNameById.get(event.secondary_person_id) ?? 'Nieznany') : null
    if (event.event_type === 'SUBSTITUTION') {
      const incoming = secondary ?? 'Nieznany'
      const outgoing = primary ?? 'Nieznany'
      return mirrored ? (
        <span className="inline-flex items-center gap-1.5">
          {renderPlayerBadge(outgoing, false)}
          {renderPlayerBadge(incoming, true)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {renderPlayerBadge(incoming, true)}
          {renderPlayerBadge(outgoing, false)}
        </span>
      )
    }
    if (event.event_type === 'GOAL') return mirrored
      ? <span className="inline-flex items-center gap-1.5">{secondary ? renderPlayerBadge(secondary, false) : null}{renderGlossyScorerBadge('goal', primary ?? 'Nieznany')}</span>
      : <span className="inline-flex items-center gap-1.5">{renderGlossyScorerBadge('goal', primary ?? 'Nieznany')}{secondary ? renderPlayerBadge(secondary, false) : null}</span>
    if (event.event_type === 'PENALTY_GOAL') return <>{renderGlossyScorerBadge('penaltyGoal', primary ?? 'Nieznany')}<span className="font-normal text-emerald-100/90"> (Rzut karny)</span></>
    if (event.event_type === 'OWN_GOAL') return <>{renderGlossyScorerBadge('ownGoal', primary ?? 'Nieznany')}<span className="font-normal text-emerald-100/90"> (Gol samobójczy)</span></>
    if (event.event_type === 'PENALTY_SHOOTOUT_SCORED') return <>{renderGlossyScorerBadge('penaltyGoal', primary ?? 'Nieznany')}</>
    if (event.event_type === 'PENALTY_SHOOTOUT_MISSED' || event.event_type === 'MATCH_PENALTY_MISSED') return <>{renderPlayerBadge(primary ?? 'Nieznany')}<span className="font-normal text-emerald-100/90"> (Nietrafiony karny)</span></>
    if (event.event_type === 'PENALTY_SHOOTOUT_SAVED' || event.event_type === 'MATCH_PENALTY_SAVED') return <>{renderPlayerBadge(primary ?? 'Nieznany')}<span className="font-normal text-emerald-100/90"> (Obroniony karny)</span></>
    if (event.event_type === 'YELLOW_CARD' || event.event_type === 'SECOND_YELLOW_CARD' || event.event_type === 'RED_CARD') return renderPlayerBadge(primary ?? 'Nieznany')
    return renderPlayerBadge(primary ?? 'Nieznany')
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
  const hasExtraTimeByResult = match.result_type === 'EXTRA_TIME' || match.result_type === 'EXTRA_TIME_AND_PENALTIES' || match.result_type === 'GOLDEN_GOAL'
  const hasShootoutByResult = match.result_type === 'PENALTIES' || match.result_type === 'EXTRA_TIME_AND_PENALTIES'

  const shouldRenderPhase = (phase: MatchPhaseKey): boolean => {
    if (phase === 'HALF_1' || phase === 'HALF_2') return true
    if (phase === 'EXTRA_1' || phase === 'EXTRA_2') return hasExtraTimeByResult
    if (phase === 'SHOOTOUT') return hasShootoutByResult
    return true
  }

  const phaseSections = phaseOrder
    .filter(shouldRenderPhase)
    .map((phase) => ({ phase, title: phaseTitles[phase], events: phaseEventsMap.get(phase) ?? [] }))

  const hasExtraTime = hasExtraTimeByResult || (phaseEventsMap.get('EXTRA_1') ?? []).length > 0 || (phaseEventsMap.get('EXTRA_2') ?? []).length > 0
  const hasShootout = hasShootoutByResult || (phaseEventsMap.get('SHOOTOUT') ?? []).length > 0

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
      <details open className="group overflow-hidden rounded-lg border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)]">
        <summary className="relative flex cursor-pointer list-none items-center justify-between overflow-hidden px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-100 marker:content-none">
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
          <span>{title}</span>
          <span className="inline-flex items-center gap-2"><span>{getHalfScore(halfEvents)}</span><span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/12 bg-emerald-950/40 text-[10px] transition-transform duration-200 group-open:rotate-180">▾</span></span>
        </summary>
        {halfEvents.length > 0 ? (
          <div className="relative overflow-hidden bg-emerald-950/18">
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.01)_35%,rgba(0,0,0,0.12)_100%)]" />
            {halfEvents.map((event) => {
              const side = event.team_id === match.home_team_id ? 'home' : event.team_id === match.away_team_id ? 'away' : 'neutral'
              const iconName = getEventIconName(event.event_type)
              const text = renderEventText(event, side === 'away')
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
              const minuteClass = 'inline-flex shrink-0 items-center rounded-md border border-emerald-300/50 bg-emerald-950/85 px-1.5 py-0.5 text-xs font-semibold leading-none text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
              const minuteBadge = isShootoutEvent ? null : <span className={minuteClass}>{minuteLabel}</span>
              const content = (
                <div className="inline-flex items-center gap-2 text-sm text-emerald-50">
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
                <div key={event.id} className="relative z-10 px-3 py-1">
                  {side === 'home' ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className="flex items-center gap-2">{minuteBadge}<div className="min-w-0">{content}</div></div>{runningScore ? renderGlossyEventScore(runningScore, scoreBadgeVariant) : <span />}<span /></div> : null}
                  {side === 'away' ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span />{runningScore ? renderGlossyEventScore(runningScore, scoreBadgeVariant) : <span />}<div className="flex items-center justify-end gap-2"><div className="min-w-0 text-right">{content}</div>{minuteBadge}</div></div> : null}
                  {side === 'neutral' ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span /><div className="flex items-center gap-2">{minuteBadge}{content}{runningScore ? renderGlossyEventScore(runningScore, scoreBadgeVariant) : null}</div><span /></div> : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </details>
    )
  }

  const summaryScore = calculateMatchScore(events, match.home_team_id, match.away_team_id)
  const walkoverScoreLabel = match.result_type === 'WALKOVER'
    ? match.walkover_winner_team_id === match.home_team_id
      ? '3:0 w.o.'
      : match.walkover_winner_team_id === match.away_team_id
        ? '0:3 w.o.'
        : null
    : null
  const summaryScoreLabel = walkoverScoreLabel ?? `${summaryScore.homeGoals}:${summaryScore.awayGoals}`
  const halftimeScoreLabel = walkoverScoreLabel ? '—' : `${summaryScore.homeGoalsHT}:${summaryScore.awayGoalsHT}`

  return (
    <section className={`${topSpacingClassName ?? 'mt-6'} overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] p-5 sm:p-6`}>
      {topPanel ? <div className="mb-4">{topPanel}</div> : null}
      <div className="relative overflow-hidden rounded-xl border border-white/10 px-5 py-4">
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.02)_30%,rgba(0,0,0,0.10)_100%)]" />
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          <div className="flex items-start"><span className="inline-flex items-center gap-2 rounded-md border border-white/12 bg-transparent px-2 py-0.5 text-2xl font-bold text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)] sm:text-3xl"><CountryFlag fifaCode={match.home_team_fifa_code} countryName={match.home_team_name} className="h-5 w-[30px]" /><span className="max-w-[15rem] truncate text-left">{match.home_team_name}</span></span></div>
          <div className="text-center"><p><span className="inline-flex items-center rounded-md border border-white/12 bg-transparent px-2 py-0.5 text-2xl font-bold text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)] sm:text-3xl">{summaryScoreLabel}</span></p><p className="mt-0.5 text-[14px] font-medium text-emerald-100/60">Do przerwy: {halftimeScoreLabel}</p>{hasExtraTime && <p className="mt-0.5 text-[11px] font-medium text-emerald-100/60">Po dogrywce: {summaryScoreLabel}</p>}{hasShootout && <p className="mt-0.5 text-[11px] font-medium text-emerald-100/60">Karne: {summaryScore.homeShootoutScore}:{summaryScore.awayShootoutScore}</p>}</div>
          <div className="flex items-start justify-end"><span className="inline-flex items-center gap-2 rounded-md border border-white/12 bg-transparent px-2 py-0.5 text-2xl font-bold text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)] sm:text-3xl"><span className="max-w-[15rem] truncate text-right">{match.away_team_name}</span><CountryFlag fifaCode={match.away_team_fifa_code} countryName={match.away_team_name} className="h-5 w-[30px]" /></span></div>
        </div>

        {(homeScorers.length > 0 || awayScorers.length > 0) ? (
          <div className="relative z-10 mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
            <div className="space-y-1">{homeScorers.map((entry) => <div key={entry.id} className="flex items-center gap-2 text-[13px]"><span className="inline-flex shrink-0 items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-emerald-50 shadow-[0_2px_6px_rgba(0,0,0,0.35)]">{entry.minuteLabel}</span><span className="truncate font-semibold text-emerald-50">{entry.scorerName}{entry.eventType === 'PENALTY_GOAL' ? <span className="ml-1 font-normal text-emerald-100/60">(k.)</span> : entry.eventType === 'OWN_GOAL' ? <span className="ml-1 font-normal text-emerald-100/60">(sam.)</span> : null}</span></div>)}</div>
            <div />
            <div className="space-y-1">{awayScorers.map((entry) => <div key={entry.id} className="flex items-center justify-end gap-2 text-[13px]"><span className="truncate font-semibold text-emerald-50">{entry.scorerName}{entry.eventType === 'PENALTY_GOAL' ? <span className="ml-1 font-normal text-emerald-100/60">(k.)</span> : entry.eventType === 'OWN_GOAL' ? <span className="ml-1 font-normal text-emerald-100/60">(sam.)</span> : null}</span><span className="inline-flex shrink-0 items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-emerald-50 shadow-[0_2px_6px_rgba(0,0,0,0.35)]">{entry.minuteLabel}</span></div>)}</div>
          </div>
        ) : null}
      </div>
      {lineupGraphic ? <div className="mt-4">{lineupGraphic}</div> : null}
      <div className="mt-4 space-y-3">
        {phaseSections.map((section) => <HalfBlock key={section.phase} title={section.title} halfEvents={section.events} />)}
      </div>
    </section>
  )
}

export default function MatchReadOnlyPage({
  match,
  participants,
  events,
  polandPlayerMiniStats,
  competitionName,
  matchDateTimeLabel,
  stadiumSummary,
  headerRight,
  topBar,
}: MatchReadOnlyPageProps) {
  const sortByPos = (a: AdminMatchParticipant, b: AdminMatchParticipant) => compareByPlayerPosition(a, b, (player) => player.player_position)
  const homeStarters = participants.homeParticipants
    .filter((player) => player.role === 'PLAYER' && player.is_starting)
    .sort(sortByPos)
  const awayStarters = participants.awayParticipants
    .filter((player) => player.role === 'PLAYER' && player.is_starting)
    .sort(sortByPos)
  const peopleById = new Map(participants.people.map((person) => [person.id, person]))
  const personNameById = new Map(
    participants.people.map((person) => [person.id, peopleById.get(person.id) ? formatEventPersonDisplayName(peopleById.get(person.id) as AdminMatchParticipantPersonOption) : person.label])
  )
  const currentReferee = participants.referees[0] ?? null

  return (
    <DetailsPageContainer maxWidthClass="max-w-5xl">
      {topBar ?? null}

      <MatchLineupsSummarySection
        match={match}
        events={events}
        personNameById={personNameById}
        topSpacingClassName={topBar ? 'mt-6' : 'mt-0'}
        topPanel={
          <section className="relative overflow-hidden rounded-xl border border-emerald-900/70 bg-[linear-gradient(165deg,#2d7a52_0%,#1e603f_18%,#134b33_40%,#0f3f2b_60%,#0b3423_80%,#08281c_100%)] px-4 py-3 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.34),0_8px_18px_rgba(0,0,0,0.28)]">
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.05)_30%,rgba(0,0,0,0.16)_100%)]" />
            <div className="relative z-10 flex w-full items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5 text-sm font-semibold">
                  <span className="inline-flex items-center rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]">{matchDateTimeLabel}</span>
                  {headerRight ? (
                    <>
                      {competitionName ? (
                        <span className="inline-flex items-center rounded-md border border-white/25 bg-slate-950/28 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-100 shadow-[0_3px_8px_rgba(0,0,0,0.25)]">{competitionName}</span>
                      ) : null}
                      {match.match_level_name ? (
                        <span className="inline-flex items-center rounded-md border border-white/25 bg-slate-950/28 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-100 shadow-[0_3px_8px_rgba(0,0,0,0.25)]">{match.match_level_name}</span>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {stadiumSummary || currentReferee ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-200">
                    {stadiumSummary ? (
                      <span className="inline-flex items-center rounded-md border border-white/20 bg-slate-950/24 px-2 py-0.5 shadow-[0_2px_6px_rgba(0,0,0,0.24)]">{stadiumSummary}</span>
                    ) : null}
                    {currentReferee ? (
                      <span className="inline-flex items-center rounded-md border border-white/20 bg-slate-950/24 px-2 py-0.5 shadow-[0_2px_6px_rgba(0,0,0,0.24)]">Sędzia: {currentReferee.person_name}{currentReferee.country_code ? ` (${currentReferee.country_code})` : ''}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {headerRight ? (
                <div className="shrink-0 self-start">
                  {headerRight}
                </div>
              ) : (competitionName || match.match_level_name) ? (
                <div className="shrink-0 self-start">
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold uppercase tracking-[0.08em]">
                    {competitionName ? (
                      <span className="inline-flex items-center rounded-md border border-white/25 bg-slate-950/28 px-2 py-0.5 text-slate-100 shadow-[0_3px_8px_rgba(0,0,0,0.25)]">{competitionName}</span>
                    ) : null}
                    {match.match_level_name ? (
                      <span className="inline-flex items-center rounded-md border border-white/25 bg-slate-950/28 px-2 py-0.5 text-slate-100 shadow-[0_3px_8px_rgba(0,0,0,0.25)]">{match.match_level_name}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        }
        lineupGraphic={
          (homeStarters.length > 0 || awayStarters.length > 0)
            ? (
                <InteractiveLineupGraphic
                  homeTeamName={match.home_team_name}
                  awayTeamName={match.away_team_name}
                  homeTeamId={match.home_team_id}
                  awayTeamId={match.away_team_id}
                  homeTeamFifaCode={match.home_team_fifa_code}
                  awayTeamFifaCode={match.away_team_fifa_code}
                  matchDate={match.match_date}
                  homeStarters={homeStarters}
                  awayStarters={awayStarters}
                  homeParticipants={participants.homeParticipants}
                  awayParticipants={participants.awayParticipants}
                  events={events}
                  polandPlayerMiniStats={polandPlayerMiniStats}
                />
              )
            : undefined
        }
      />

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReadOnlyParticipantsSection title={match.home_team_name} participants={participants.homeParticipants} events={events} />
        <ReadOnlyParticipantsSection title={match.away_team_name} participants={participants.awayParticipants} events={events} />
      </section>
    </DetailsPageContainer>
  )
}