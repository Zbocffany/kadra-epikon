'use client'

import { useMemo, useState } from 'react'
import CountryFlag from '@/components/CountryFlag'
import { getFlagAssetPath } from '@/lib/flags/fifaFlagMap'
import type { AdminMatchEvent, AdminMatchParticipant, PlayerPosition } from '@/lib/db/matches'

type InteractiveLineupGraphicProps = {
  homeTeamName: string
  awayTeamName: string
  homeTeamId: string
  awayTeamId: string
  homeTeamFifaCode?: string | null
  awayTeamFifaCode?: string | null
  homeStarters: AdminMatchParticipant[]
  awayStarters: AdminMatchParticipant[]
  homeParticipants: AdminMatchParticipant[]
  awayParticipants: AdminMatchParticipant[]
  events: AdminMatchEvent[]
}

type TeamKey = 'home' | 'away'

type PitchPlayer = {
  id: string
  label: string
  position: PlayerPosition | null
}

type EnteredPlayer = {
  id: string
  label: string
  minute: string
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

function buildLineupLabels(players: AdminMatchParticipant[]): Array<{ id: string; label: string; position: PlayerPosition | null }> {
  const firstEleven = players.slice(0, 11)
  const base = firstEleven.map((player) => {
    const surname = extractSurname(player.person_name)
    const firstName = extractFirstName(player.person_name)
    return {
      id: player.id,
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
  const raw: Array<{ id: string; personName: string; minute: string }> = []

  for (const event of [...events].sort(compareEventsChronologically)) {
    if (event.event_type !== 'SUBSTITUTION' || event.team_id !== teamId || !event.secondary_person_id) continue
    if (seen.has(event.secondary_person_id)) continue
    seen.add(event.secondary_person_id)
    const participant = playersByPersonId.get(event.secondary_person_id)
    raw.push({
      id: event.secondary_person_id,
      personName: participant?.person_name ?? 'Nieznany',
      minute: formatEventMinute(event),
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
  }))
}

export default function InteractiveLineupGraphic({
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  homeTeamFifaCode,
  awayTeamFifaCode,
  homeStarters = [],
  awayStarters = [],
  homeParticipants = [],
  awayParticipants = [],
  events = [],
}: InteractiveLineupGraphicProps) {
  const [activeTeam, setActiveTeam] = useState<TeamKey>(() => getDefaultTeam(homeTeamName, awayTeamName))
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null)

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

  if (!homeStarters.length && !awayStarters.length) return null

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        <aside className="relative overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] sm:p-4">
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
          <div className="relative z-10">
            <ol className="space-y-1.5" onMouseLeave={() => setHoveredPlayerId(null)}>
              {lineup.map((player, index) => (
                <li
                  key={player.id}
                  onMouseEnter={() => setHoveredPlayerId(player.id)}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-all duration-200 ${
                    hoveredPlayerId === player.id
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
                      <li key={player.id} className="flex items-center gap-2 rounded-md border border-emerald-900/65 bg-emerald-950/35 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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

              {pitchPlayers.map((player) => (
                <div key={player.id} className="absolute" style={{ left: `${player.x}%`, top: `${player.y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="relative inline-flex h-7 w-7 items-center justify-center text-[10px] font-black uppercase tracking-[0.14em] text-emerald-900 shadow-[0_6px_10px_rgba(0,0,0,0.32)] transition-transform duration-200"
                      style={{ transform: hoveredPlayerId === player.id ? 'scale(1.45)' : 'scale(1)' }}
                    >
                      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
                        <path d="M18 10h28l8 9-8 7v28H18V26l-8-7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                        <path d="M26 10h12v8H26z" fill="#1e7a43" opacity="0.85" />
                        <path d="M11 19l7-9 8 9-8 7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                        <path d="M53 19l-7-9-8 9 8 7z" fill="#f2f7f3" stroke="#d9e7de" strokeWidth="2" />
                      </svg>
                      <span className="relative z-10">{getPositionInitial(player.position)}</span>
                    </span>
                    <span
                      title={player.label}
                      className={`rounded-md border border-emerald-900/80 bg-emerald-950/85 px-1.5 py-[2px] text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-50 transition-all duration-200 ${
                        hoveredPlayerId === player.id ? 'max-w-[14rem] whitespace-normal text-center break-words' : 'max-w-[8.25rem] truncate'
                      }`}
                    >
                      {hoveredPlayerId === player.id
                        ? player.label
                        : (player.label.length > 20 ? `${player.label.slice(0, 20)}...` : player.label)}
                    </span>
                  </div>
                </div>
              ))}

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
                    setHoveredPlayerId(null)
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
        </div>
      </div>
    </section>
  )
}
