'use client'

import { useMemo, useState } from 'react'
import CountryFlag from '@/components/CountryFlag'
import { Icon, type AppIconName } from '@/components/icons'
import { getFlagAssetPath } from '@/lib/flags/fifaFlagMap'
import type { AdminMatchEvent, AdminMatchParticipant, PlayerPosition, PublicPolandPlayerMiniStats } from '@/lib/db/matches'

type InteractiveLineupGraphicProps = {
  homeTeamName: string
  awayTeamName: string
  homeTeamId: string
  awayTeamId: string
  homeTeamFifaCode?: string | null
  awayTeamFifaCode?: string | null
  matchDate: string
  homeStarters: AdminMatchParticipant[]
  awayStarters: AdminMatchParticipant[]
  homeParticipants: AdminMatchParticipant[]
  awayParticipants: AdminMatchParticipant[]
  events: AdminMatchEvent[]
  polandPlayerMiniStats?: Record<string, PublicPolandPlayerMiniStats>
}

type TeamKey = 'home' | 'away'

type PitchPlayer = {
  id: string
  personId: string
  label: string
  position: PlayerPosition | null
}

type EnteredPlayer = {
  id: string
  label: string
  minute: string
  replacedPersonId: string | null
}

type HoveredPlayerState = {
  sourcePlayerId: string
  targetPersonId: string
  hoveredPersonId: string
  label: string
  usesFlipAnimation: boolean
}

const COLUMN_X_BY_POSITION: Record<PlayerPosition, number> = {
  GOALKEEPER: 10,
  DEFENDER: 31,
  MIDFIELDER: 57,
  ATTACKER: 82,
}

function isPolandTeam(teamName: string): boolean {
  const normalized = teamName.trim().toLowerCase()
  return normalized.startsWith('polska') || normalized.includes(' polska')
}

function getDefaultTeam(homeTeamName: string, awayTeamName: string): TeamKey {
  if (isPolandTeam(homeTeamName)) return 'home'
  if (isPolandTeam(awayTeamName)) return 'away'
  return 'home'
}

function getAgeOnMatchDay(birthDate: string | null | undefined, matchDate: string): number | null {
  if (!birthDate) return null
  const [birthYearRaw, birthMonthRaw, birthDayRaw] = birthDate.split('-')
  const [matchYearRaw, matchMonthRaw, matchDayRaw] = matchDate.split('-')
  const birthYear = Number(birthYearRaw)
  const birthMonth = Number(birthMonthRaw)
  const birthDay = Number(birthDayRaw)
  const matchYear = Number(matchYearRaw)
  const matchMonth = Number(matchMonthRaw)
  const matchDay = Number(matchDayRaw)

  if (!Number.isFinite(birthYear) || !Number.isFinite(birthMonth) || !Number.isFinite(birthDay)) return null
  if (!Number.isFinite(matchYear) || !Number.isFinite(matchMonth) || !Number.isFinite(matchDay)) return null

  let age = matchYear - birthYear
  if (matchMonth < birthMonth || (matchMonth === birthMonth && matchDay < birthDay)) {
    age -= 1
  }

  return age >= 0 ? age : null
}

function getPositionInitial(position: PlayerPosition | null): string {
  if (position === 'GOALKEEPER') return 'B'
  if (position === 'DEFENDER') return 'O'
  if (position === 'MIDFIELDER') return 'P'
  if (position === 'ATTACKER') return 'N'
  return '?'
}

function extractSurname(displayName: string): string {
  const cleaned = displayName.trim().replace(/\s+/g, ' ')
  if (!cleaned) return '—'
  const parts = cleaned.split(' ')
  if (parts.length === 1) return parts[0]
  return parts[parts.length - 1]
}

function extractFirstName(displayName: string): string {
  const cleaned = displayName.trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''
  const parts = cleaned.split(' ')
  if (parts.length === 1) return ''
  return parts[0] ?? ''
}

function normalizeLetters(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function buildLineupLabels(players: AdminMatchParticipant[]): Array<{ id: string; personId: string; label: string; position: PlayerPosition | null }> {
  const firstEleven = players.slice(0, 11)
  const base = firstEleven.map((player) => {
    const surname = extractSurname(player.person_name)
    const firstName = extractFirstName(player.person_name)
    return {
      id: player.id,
      personId: player.person_id,
      surname,
      firstName,
      position: player.player_position,
    }
  })

  const bySurname = new Map<string, Array<{ id: string; surname: string; firstName: string; position: PlayerPosition | null }>>()
  for (const player of base) {
    const arr = bySurname.get(player.surname) ?? []
    arr.push(player)
    bySurname.set(player.surname, arr)
  }

  const prefixedLabelById = new Map<string, string>()

  for (const group of bySurname.values()) {
    if (group.length === 1) {
      prefixedLabelById.set(group[0].id, group[0].surname)
      continue
    }

    const byInitial = new Map<string, Array<{ id: string; surname: string; firstName: string }>>()
    for (const player of group) {
      const initial = normalizeLetters(player.firstName).slice(0, 1)
      const arr = byInitial.get(initial) ?? []
      arr.push(player)
      byInitial.set(initial, arr)
    }

    for (const [initial, initialGroup] of byInitial.entries()) {
      if (initialGroup.length === 1 && initial) {
        const player = initialGroup[0]
        prefixedLabelById.set(player.id, `${initial}. ${player.surname}`)
        continue
      }

      for (const player of initialGroup) {
        const twoLetters = normalizeLetters(player.firstName).slice(0, 2)
        const prefix = twoLetters || (initial ? `${initial}.` : '')
        prefixedLabelById.set(player.id, prefix ? `${prefix} ${player.surname}` : player.surname)
      }
    }
  }

  return base.map((player) => ({
    id: player.id,
    personId: player.personId,
    label: prefixedLabelById.get(player.id) ?? player.surname,
    position: player.position,
  }))
}

function spreadY(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [50]
  if (count === 2) return [35, 65]
  if (count === 3) return [25, 50, 75]
  if (count === 4) return [18, 40, 62, 84]
  const min = 14
  const max = 86
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, index) => min + step * index)
}

function buildPitchCoordinates(players: PitchPlayer[]): Array<PitchPlayer & { x: number; y: number }> {
  const grouped = {
    GOALKEEPER: players.filter((player) => player.position === 'GOALKEEPER'),
    DEFENDER: players.filter((player) => player.position === 'DEFENDER'),
    MIDFIELDER: players.filter((player) => player.position === 'MIDFIELDER'),
    ATTACKER: players.filter((player) => player.position === 'ATTACKER'),
    UNKNOWN: players.filter((player) => !player.position),
  }

  const placed: Array<PitchPlayer & { x: number; y: number }> = []

  const placeGroup = (position: PlayerPosition, group: PitchPlayer[]) => {
    const yPositions = spreadY(group.length)
    for (let i = 0; i < group.length; i += 1) {
      const player = group[i]
      const y = yPositions[i] ?? 50
      placed.push({ ...player, x: COLUMN_X_BY_POSITION[position], y })
    }
  }

  placeGroup('GOALKEEPER', grouped.GOALKEEPER)
  placeGroup('DEFENDER', grouped.DEFENDER)
  placeGroup('MIDFIELDER', grouped.MIDFIELDER)
  placeGroup('ATTACKER', grouped.ATTACKER)

  if (grouped.UNKNOWN.length > 0) {
    const unknownY = spreadY(grouped.UNKNOWN.length)
    for (let i = 0; i < grouped.UNKNOWN.length; i += 1) {
      placed.push({ ...grouped.UNKNOWN[i], x: 46, y: unknownY[i] ?? 50 })
    }
  }

  return placed
}

function compareEventsChronologically(a: AdminMatchEvent, b: AdminMatchEvent) {
  if (a.minute !== b.minute) return a.minute - b.minute
  const aExtra = a.minute_extra ?? 0
  const bExtra = b.minute_extra ?? 0
  if (aExtra !== bExtra) return aExtra - bExtra
  return (a.event_order ?? Number.MAX_SAFE_INTEGER) - (b.event_order ?? Number.MAX_SAFE_INTEGER)
}

function formatEventMinute(event: AdminMatchEvent): string {
  return event.minute_extra && event.minute_extra > 0 ? `${event.minute}+${event.minute_extra}'` : `${event.minute}'`
}

function buildEnteredPlayers(participants: AdminMatchParticipant[] | undefined, events: AdminMatchEvent[] | undefined, teamId: string | undefined): EnteredPlayer[] {
  if (!participants?.length || !events?.length || !teamId) return []

  const playersByPersonId = new Map(
    participants
      .filter((participant) => participant.role === 'PLAYER')
      .map((participant) => [participant.person_id, participant])
  )
  const seen = new Set<string>()
  // collect raw entries in order
  const raw: Array<{ id: string; personName: string; minute: string; replacedPersonId: string | null }> = []

  for (const event of [...events].sort(compareEventsChronologically)) {
    if (event.event_type !== 'SUBSTITUTION' || event.team_id !== teamId || !event.secondary_person_id) continue
    if (seen.has(event.secondary_person_id)) continue
    seen.add(event.secondary_person_id)
    const participant = playersByPersonId.get(event.secondary_person_id)
    raw.push({
      id: event.secondary_person_id,
      personName: participant?.person_name ?? 'Nieznany',
      minute: formatEventMinute(event),
      replacedPersonId: event.primary_person_id ?? null,
    })
  }

  // build surname labels with first-initial disambiguation (same logic as buildLineupLabels)
  const base = raw.map((entry) => ({
    ...entry,
    surname: extractSurname(entry.personName),
    firstName: extractFirstName(entry.personName),
  }))

  const bySurname = new Map<string, typeof base>()
  for (const entry of base) {
    const arr = bySurname.get(entry.surname) ?? []
    arr.push(entry)
    bySurname.set(entry.surname, arr)
  }

  const labelById = new Map<string, string>()
  for (const group of bySurname.values()) {
    if (group.length === 1) {
      labelById.set(group[0].id, group[0].surname)
      continue
    }
    const byInitial = new Map<string, typeof group>()
    for (const entry of group) {
      const initial = normalizeLetters(entry.firstName).slice(0, 1)
      const arr = byInitial.get(initial) ?? []
      arr.push(entry)
      byInitial.set(initial, arr)
    }
    for (const [initial, iGroup] of byInitial.entries()) {
      if (iGroup.length === 1 && initial) {
        labelById.set(iGroup[0].id, `${initial}. ${iGroup[0].surname}`)
        continue
      }
      for (const entry of iGroup) {
        const twoLetters = normalizeLetters(entry.firstName).slice(0, 2)
        const prefix = twoLetters || (initial ? `${initial}.` : '')
        labelById.set(entry.id, prefix ? `${prefix} ${entry.surname}` : entry.surname)
      }
    }
  }

  return raw.map((entry) => ({
    id: entry.id,
    label: labelById.get(entry.id) ?? extractSurname(entry.personName),
    minute: entry.minute,
    replacedPersonId: entry.replacedPersonId,
  }))
}

function getPlayerEvents(personId: string, events: AdminMatchEvent[], teamId: string | undefined): AdminMatchEvent[] {
  if (!teamId) return []
  
  const eventTypePriority = (eventType: string): number => {
    if (['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(eventType)) return 0
    if (['YELLOW_CARD', 'SECOND_YELLOW_CARD'].includes(eventType)) return 1
    if (eventType === 'RED_CARD') return 2
    return 3
  }
  
  return events
    .filter((e) => e.primary_person_id === personId && e.team_id === teamId && e.event_type !== 'SUBSTITUTION')
    .sort((a, b) => {
      const priorityA = eventTypePriority(a.event_type)
      const priorityB = eventTypePriority(b.event_type)
      if (priorityA !== priorityB) return priorityA - priorityB
      return compareEventsChronologically(a, b)
    })
}

function getEventIcon(eventType: string): string {
  switch (eventType) {
    case 'GOAL':
    case 'OWN_GOAL':
    case 'PENALTY_GOAL':
      return '⚽'
    case 'YELLOW_CARD':
      return '🟨'
    case 'SECOND_YELLOW_CARD':
    case 'RED_CARD':
      return '🟥'
    case 'MATCH_PENALTY_SAVED':
    case 'PENALTY_SHOOTOUT_SAVED':
      return '🛡️'
    case 'MATCH_PENALTY_MISSED':
    case 'PENALTY_SHOOTOUT_MISSED':
      return '❌'
    case 'PENALTY_SHOOTOUT_SCORED':
      return '✓'
    case 'SUBSTITUTION':
      return '🔁'
    default:
      return '◆'
  }
}

function getTimelineEventIconName(eventType: AdminMatchEvent['event_type']): AppIconName | null {
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

function getTimelineIconNameForPerson(event: AdminMatchEvent, personId: string): AppIconName | null {
  if (
    event.secondary_person_id === personId
    && (event.event_type === 'GOAL' || event.event_type === 'OWN_GOAL')
  ) {
    return 'assist'
  }
  return getTimelineEventIconName(event.event_type)
}

type EventIconProps = {
  event: AdminMatchEvent
  isHovered?: boolean
  multiplier?: number
}

function EventIcon({ event, isHovered = false, multiplier }: EventIconProps) {
  const icon = getEventIcon(event.event_type)
  const isRedCardEvent = event.event_type === 'RED_CARD' || event.event_type === 'SECOND_YELLOW_CARD'
  const minute = formatEventMinute(event)
  const title = multiplier && multiplier >= 5
    ? `${event.event_type} x${multiplier}`
    : `${event.event_type} (${minute})`
  
  return (
    <div
      className="relative inline-flex h-[21.6px] w-[21.6px] items-center justify-center text-[13px] transition-all duration-300 -ml-2"
      style={{
        filter: isHovered ? 'brightness(1.3)' : isRedCardEvent ? 'brightness(1.15)' : 'brightness(1)',
        opacity: isHovered ? 1 : isRedCardEvent ? 0.95 : 0.6,
      }}
      title={title}
    >
      <span className="inline-flex items-center gap-0.5">
        {isRedCardEvent ? (
          <span
            aria-hidden
            className="inline-block h-[12px] w-[9px] rounded-[1px] border border-[#8f122b] bg-[#dc143c]"
          />
        ) : (
          <span>{icon}</span>
        )}
        {multiplier && multiplier >= 5 ? <span className="text-[10px] font-semibold leading-none">x{multiplier}</span> : null}
      </span>
    </div>
  )
}

type PlayerEventsDisplayProps = {
  events: AdminMatchEvent[]
  isHovered: boolean
  offsetPx?: number
}

type EventRenderItem = {
  key: string
  event: AdminMatchEvent
  multiplier?: number
}

function PlayerEventsDisplay({ events, isHovered, offsetPx = 5 }: PlayerEventsDisplayProps) {
  if (!events.length) return null

  const goalEvents = events.filter((event) => ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(event.event_type))
  const nonGoalEvents = events.filter((event) => !['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(event.event_type))

  const renderItems: EventRenderItem[] = goalEvents.length >= 5
    ? [{ key: `goals-${goalEvents[0].id}`, event: goalEvents[0], multiplier: goalEvents.length }, ...nonGoalEvents.map((event) => ({ key: event.id, event }))]
    : events.map((event) => ({ key: event.id, event }))

  return (
    <div
      className="absolute left-full top-1/2 flex -translate-y-1/2 gap-0 transition-all duration-300"
      style={{ marginLeft: `${offsetPx}px`, marginTop: '-3px' }}
    >
      {renderItems.slice(0, 4).map((item) => (
        <EventIcon key={item.key} event={item.event} isHovered={isHovered} multiplier={item.multiplier} />
      ))}
    </div>
  )
}

function FlippingSurnameBanner({
  frontLabel,
  backLabel,
  flipped,
  fontSize = 'text-[10px]',
}: {
  frontLabel: string
  backLabel: string
  flipped: boolean
  fontSize?: string
}) {
  return (
    <span className="relative block h-[16px] w-full overflow-hidden [perspective:900px]">
      <span
        className={`relative block h-full w-full transition-transform duration-500 ease-out [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'}`}
      >
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-md border border-emerald-900/80 bg-emerald-950/85 px-1.5 py-0 ${fontSize} font-semibold uppercase tracking-[0.08em] text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)] [backface-visibility:hidden]`}
          title={frontLabel}
        >
          <span className="block w-full truncate text-center leading-none">{frontLabel}</span>
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-md border border-emerald-100/80 bg-[linear-gradient(180deg,rgba(240,255,246,0.44)_0%,rgba(173,238,199,0.28)_28%,rgba(12,74,40,0.92)_100%)] px-1.5 py-0 ${fontSize} font-semibold uppercase tracking-[0.08em] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.62),inset_0_-2px_6px_rgba(0,0,0,0.5),0_8px_16px_rgba(0,0,0,0.3)] [backface-visibility:hidden] [transform:rotateY(180deg)]`}
          title={backLabel}
        >
          <span className="block w-full truncate text-center leading-none">{backLabel}</span>
        </span>
      </span>
    </span>
  )
}

export default function InteractiveLineupGraphic({
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  homeTeamFifaCode,
  awayTeamFifaCode,
  matchDate,
  homeStarters = [],
  awayStarters = [],
  homeParticipants = [],
  awayParticipants = [],
  events = [],
  polandPlayerMiniStats = {},
}: InteractiveLineupGraphicProps) {
  const [activeTeam, setActiveTeam] = useState<TeamKey>(() => getDefaultTeam(homeTeamName, awayTeamName))
  const [hoveredPlayerState, setHoveredPlayerState] = useState<HoveredPlayerState | null>(null)

  const current = activeTeam === 'home'
    ? { name: homeTeamName, fifaCode: homeTeamFifaCode, players: homeStarters, participants: homeParticipants, teamId: homeTeamId }
    : { name: awayTeamName, fifaCode: awayTeamFifaCode, players: awayStarters, participants: awayParticipants, teamId: awayTeamId }

  const other = activeTeam === 'home'
    ? { name: awayTeamName, fifaCode: awayTeamFifaCode, key: 'away' as const }
    : { name: homeTeamName, fifaCode: homeTeamFifaCode, key: 'home' as const }
  const otherFlagSrc = getFlagAssetPath(other.fifaCode)

  const lineup = useMemo(() => {
    return buildLineupLabels(current.players)
  }, [current.players])

  const pitchPlayers = useMemo(() => buildPitchCoordinates(lineup), [lineup])
  const enteredPlayers = useMemo(() => buildEnteredPlayers(current.participants, events, current.teamId), [current.participants, current.teamId, events])
  const currentCoachSurname = useMemo(() => {
    const coach = current.participants.find((participant) => participant.role === 'COACH')
    return coach ? extractSurname(coach.person_name) : null
  }, [current.participants])
  const participantByPersonId = useMemo(
    () => new Map(current.participants.map((participant) => [participant.person_id, participant])),
    [current.participants]
  )
  const hoveredParticipant = hoveredPlayerState ? participantByPersonId.get(hoveredPlayerState.hoveredPersonId) ?? null : null
  const hoveredPlayerAge = hoveredParticipant ? getAgeOnMatchDay(hoveredParticipant.birth_date, matchDate) : null
  const currentTeamIsPoland = (current.fifaCode ?? '').trim().toUpperCase() === 'POL'
  const hoveredPolandStats = hoveredParticipant ? polandPlayerMiniStats[hoveredParticipant.person_id] : undefined
  const hoveredPlayerClubName = hoveredParticipant?.club_team_name ?? hoveredParticipant?.derived_club_team_name ?? '—'
  const hoveredTimelineEvents = useMemo(() => {
    if (!hoveredParticipant) return [] as Array<{ key: string; iconName: AppIconName | null; minute: string }>

    return events
      .filter((event) => {
        if (event.team_id !== current.teamId) return false
        return event.primary_person_id === hoveredParticipant.person_id || event.secondary_person_id === hoveredParticipant.person_id
      })
      .sort(compareEventsChronologically)
      .map((event) => {
        const iconName = getTimelineIconNameForPerson(event, hoveredParticipant.person_id)
        if (event.event_type === 'SUBSTITUTION') {
          return {
            key: event.id,
            iconName,
            minute: formatEventMinute(event),
          }
        }

        return {
          key: event.id,
          iconName,
          minute: formatEventMinute(event),
        }
      })
  }, [hoveredParticipant, events, current.teamId])

  if (!homeStarters.length && !awayStarters.length) return null

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        <aside className="relative overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] sm:p-4">
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
          <div className="relative z-10">
            <ol className="space-y-1.5" onMouseLeave={() => setHoveredPlayerState(null)}>
              {lineup.map((player) => (
                <li
                  key={player.id}
                  onMouseEnter={() => {
                    setHoveredPlayerState({
                      sourcePlayerId: player.id,
                      targetPersonId: player.personId,
                      hoveredPersonId: player.personId,
                      label: player.label,
                      usesFlipAnimation: false,
                    })
                  }}
                  onMouseLeave={() => setHoveredPlayerState(null)}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-all duration-200 ${
                    hoveredPlayerState?.sourcePlayerId === player.id
                      ? 'border-emerald-100/70 bg-[linear-gradient(180deg,rgba(240,255,246,0.44)_0%,rgba(173,238,199,0.28)_28%,rgba(12,74,40,0.92)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.62),inset_0_-2px_6px_rgba(0,0,0,0.5),0_8px_16px_rgba(0,0,0,0.3)]'
                      : 'border-emerald-900/65 bg-emerald-950/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  }`}
                >
                  <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center text-[8px] font-black uppercase tracking-[0.1em] text-emerald-900">
                    <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
                      <path d="M18 10h28l8 9-8 7v28H18V26l-8-7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                      <path d="M26 10h12v8H26z" fill="#1e7a43" opacity="0.85" />
                      <path d="M11 19l7-9 8 9-8 7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                      <path d="M53 19l-7-9-8 9 8 7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                    </svg>
                    <span className="relative z-10 w-full text-center leading-none">{getPositionInitial(player.position)}</span>
                  </span>
                  <span className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-emerald-50">{player.label}</span>
                </li>
              ))}
              {lineup.length === 0 ? (
                <li className="rounded-md border border-dashed border-emerald-900/60 px-2.5 py-2 text-xs text-emerald-100/80">Brak danych składu</li>
              ) : null}
            </ol>

            <details open className="group mt-3 overflow-hidden rounded-lg border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)]">
              <summary className="relative flex cursor-pointer list-none items-center justify-between overflow-hidden px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-100 marker:content-none">
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
                <span className="relative z-10">ZMIENNICY</span>
                <span className="relative z-10 inline-flex items-center gap-2">
                  <span>{enteredPlayers.length}</span>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/12 bg-emerald-950/40 text-[10px] transition-transform duration-200 group-open:rotate-180">▾</span>
                </span>
              </summary>
              {enteredPlayers.length === 0 ? (
                <div className="bg-emerald-950/18 px-3 py-3 text-xs text-emerald-100/80">Brak zmian.</div>
              ) : (
                <div className="relative overflow-hidden bg-emerald-950/18 px-2 py-2">
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.01)_35%,rgba(0,0,0,0.12)_100%)]" />
                  <ul className="relative z-10 space-y-1.5">
                    {enteredPlayers.map((player) => (
                      <li
                        key={player.id}
                        onMouseEnter={() => {
                          setHoveredPlayerState({
                            sourcePlayerId: player.id,
                            targetPersonId: player.replacedPersonId ?? player.id,
                            hoveredPersonId: player.id,
                            label: player.label,
                            usesFlipAnimation: Boolean(player.replacedPersonId),
                          })
                        }}
                        onMouseLeave={() => setHoveredPlayerState(null)}
                        className="flex items-center gap-2 rounded-md border border-emerald-900/65 bg-emerald-950/35 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-200 hover:border-emerald-100/70 hover:bg-[linear-gradient(180deg,rgba(240,255,246,0.18)_0%,rgba(12,74,40,0.72)_100%)]"
                      >
                        <span className="inline-flex shrink-0 items-center rounded-md border border-white/12 bg-transparent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-emerald-50 shadow-[0_4px_10px_rgba(0,0,0,0.35)]">{player.minute}</span>
                        <span className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-emerald-50">{player.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
          </div>
        </aside>

        <div className="relative">
          <div className="relative isolate overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_10px_22px_rgba(0,0,0,0.28)] sm:p-4">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
            <div className="relative h-[19rem] rounded-lg border-2 border-white/80 pr-2 pb-12 sm:h-[21rem]">
              <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 h-full w-px -translate-x-1/2 bg-white/85" />
              <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/85" />
              <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85" />

              <div aria-hidden className="pointer-events-none absolute left-0 top-1/2 h-[52%] w-[16%] -translate-y-1/2 border-2 border-l-0 border-white/85" />
              <div aria-hidden className="pointer-events-none absolute left-0 top-1/2 h-[28%] w-[7%] -translate-y-1/2 border-2 border-l-0 border-white/85" />
              <div aria-hidden className="pointer-events-none absolute right-0 top-1/2 h-[52%] w-[16%] -translate-y-1/2 border-2 border-r-0 border-white/85" />
              <div aria-hidden className="pointer-events-none absolute right-0 top-1/2 h-[28%] w-[7%] -translate-y-1/2 border-2 border-r-0 border-white/85" />

              {pitchPlayers.map((player) => {
                const isHoveredPitchPlayer = hoveredPlayerState?.targetPersonId === player.personId
                const displayLabel = isHoveredPitchPlayer && hoveredPlayerState?.usesFlipAnimation
                  ? hoveredPlayerState.label
                  : player.label
                const showFlippedBanner = Boolean(isHoveredPitchPlayer && hoveredPlayerState?.usesFlipAnimation)
                const longestLabel = Math.max(player.label.length, displayLabel.length)
                const baseWidth = Math.max(5.8, (longestLabel / 17) * 5.8)
                const widthRem = baseWidth * 1.1
                const fontSize = longestLabel > 15 ? 'text-[8px]' : longestLabel > 12 ? 'text-[9px]' : 'text-[10px]'
                
                const playerEvents = getPlayerEvents(player.personId, events, current.teamId)
                const enteredPlayerData = enteredPlayers.find((ep) => ep.replacedPersonId === player.personId)
                const enteredPlayerEvents = enteredPlayerData ? getPlayerEvents(enteredPlayerData.id, events, current.teamId) : []
                const displayedEvents = isHoveredPitchPlayer && hoveredPlayerState?.usesFlipAnimation ? enteredPlayerEvents : playerEvents

                return (
                  <div
                    key={player.id}
                    className="absolute"
                    style={{ left: `${player.x}%`, top: `${player.y}%`, transform: 'translate(-50%, -50%)' }}
                    onMouseEnter={() => {
                      setHoveredPlayerState({
                        sourcePlayerId: player.id,
                        targetPersonId: player.personId,
                        hoveredPersonId: player.personId,
                        label: player.label,
                        usesFlipAnimation: false,
                      })
                    }}
                    onMouseLeave={() => setHoveredPlayerState(null)}
                  >
                    <div className="relative flex flex-row items-start gap-0 -m-1 p-1">
                      <div className="relative flex flex-col items-center gap-0.5">
                        <span
                          className="relative inline-flex h-7 w-7 items-center justify-center text-[10px] font-black uppercase tracking-[0.14em] text-emerald-900 shadow-[0_6px_10px_rgba(0,0,0,0.32)] transition-transform duration-200"
                          style={{ transform: isHoveredPitchPlayer ? 'scale(1.45)' : 'scale(1)' }}
                        >
                          <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
                            <path d="M18 10h28l8 9-8 7v28H18V26l-8-7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                            <path d="M26 10h12v8H26z" fill="#1e7a43" opacity="0.85" />
                            <path d="M11 19l7-9 8 9-8 7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                            <path d="M53 19l-7-9-8 9 8 7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                          </svg>
                          <span className="relative z-10">{getPositionInitial(player.position)}</span>
                          <PlayerEventsDisplay events={displayedEvents} isHovered={isHoveredPitchPlayer} offsetPx={5} />
                        </span>
                        <div className="max-w-[14rem]" style={{ width: `${widthRem}rem` }}>
                          <FlippingSurnameBanner
                            frontLabel={player.label}
                            backLabel={displayLabel}
                            flipped={showFlippedBanner}
                            fontSize={fontSize}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              <div className="absolute left-2 top-2 z-20 inline-flex items-center justify-center rounded-md border border-white/12 bg-transparent p-1.5 shadow-[0_6px_12px_rgba(0,0,0,0.38)]">
                <CountryFlag
                  fifaCode={current.fifaCode ?? null}
                  countryName={current.name}
                  className="!h-[30px] !w-[45px]"
                />
              </div>

              {currentCoachSurname ? (
                <div className="absolute right-2 top-2 z-20 inline-flex items-center rounded-md border border-white/12 bg-transparent px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-50 shadow-[0_6px_12px_rgba(0,0,0,0.38)] sm:text-sm">
                  {currentCoachSurname}
                </div>
              ) : null}

              <div className="absolute bottom-2 right-2 z-20 inline-flex items-center justify-center rounded-md border border-white/12 bg-transparent p-1.5 shadow-[0_6px_12px_rgba(0,0,0,0.38)]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTeam(other.key)
                    setHoveredPlayerState(null)
                  }}
                  title={other.name}
                  aria-label={`Przelacz na ${other.name}`}
                  className="relative inline-flex h-[30px] w-[45px] items-center justify-center overflow-hidden border border-white/20 shadow-[0_4px_10px_rgba(0,0,0,0.35)] transition-opacity duration-150 hover:opacity-80 [clip-path:polygon(0_0,78%_0,100%_50%,78%_100%,0_100%)]"
                >
                  {otherFlagSrc ? (
                    <img
                      src={otherFlagSrc}
                      alt={`Flaga ${other.name}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="relative z-10 text-[10px] font-bold uppercase text-emerald-50">{other.name}</span>
                  )}
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_55%)]" />
                </button>
              </div>
            </div>
          </div>

          <div className="relative mt-3 overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] sm:p-3.5">
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
            <div className="relative z-10 min-h-[84px]">
              {hoveredParticipant ? (
                <div className="relative space-y-2 pr-24">
                  {currentTeamIsPoland && hoveredParticipant.role === 'PLAYER' && hoveredPolandStats ? (
                    <div className="absolute right-0 top-0 flex flex-col items-end gap-1">
                      <span className="relative inline-flex items-center overflow-hidden rounded-md border border-emerald-300/50 bg-emerald-950/82 px-1.5 py-0.5 text-sm font-bold text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_1px_rgba(0,0,0,0.4),0_2px_5px_rgba(0,0,0,0.28)]">
                        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.08)_34%,rgba(255,255,255,0)_72%)]" />
                        <span className="relative z-10">{hoveredPolandStats.capsBeforeMatch}/{hoveredPolandStats.goalsBeforeMatch}</span>
                      </span>
                      <div className="flex flex-col items-end gap-1 text-xs">
                        {hoveredPolandStats.isDebut ? (
                          <span className="inline-flex items-center rounded-md border border-emerald-100/55 bg-[linear-gradient(180deg,rgba(240,255,246,0.28)_0%,rgba(12,74,40,0.9)_100%)] px-2 py-0.5 font-semibold uppercase tracking-[0.08em] text-emerald-50">Debiut</span>
                        ) : null}
                        {hoveredPolandStats.isFirstGoal ? (
                          <span className="inline-flex items-center rounded-md border border-emerald-100/55 bg-[linear-gradient(180deg,rgba(240,255,246,0.28)_0%,rgba(12,74,40,0.9)_100%)] px-2 py-0.5 font-semibold uppercase tracking-[0.08em] text-emerald-50">Pierwszy gol</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col items-start gap-2">
                    <span className="inline-flex items-center rounded-md border border-emerald-100/70 bg-[linear-gradient(180deg,rgba(240,255,246,0.44)_0%,rgba(173,238,199,0.28)_28%,rgba(12,74,40,0.92)_100%)] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.62),inset_0_-2px_6px_rgba(0,0,0,0.5),0_8px_16px_rgba(0,0,0,0.3)]">
                      {hoveredParticipant.person_name}{hoveredPlayerAge !== null ? ` (${hoveredPlayerAge})` : ''}
                    </span>

                    <span className="inline-flex items-center rounded-md border border-white/25 bg-slate-950/28 px-2 py-0.5 text-xs font-semibold tracking-[0.08em] text-emerald-50 shadow-[0_3px_8px_rgba(0,0,0,0.25)]">
                      {hoveredPlayerClubName}
                    </span>

                    {hoveredTimelineEvents.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hoveredTimelineEvents.map((entry) => (
                          <span
                            key={entry.key}
                            className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-emerald-950/30 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-50 shadow-[0_2px_6px_rgba(0,0,0,0.28)]"
                            title={entry.minute}
                          >
                            {entry.iconName ? <Icon name={entry.iconName} className="h-3.5 w-3.5" /> : <span>◆</span>}
                            <span>{entry.minute}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center text-xs font-medium uppercase tracking-[0.08em] text-emerald-100/75">Najedź na piłkarza na liście lub na boisku</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
