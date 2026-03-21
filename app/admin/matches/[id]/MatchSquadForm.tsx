'use client'

import { useState } from 'react'
import type {
  AdminMatchParticipant,
  AdminMatchParticipantPersonOption,
  PlayerPosition,
} from '@/lib/db/matches'

const STARTERS_COUNT = 11
const BENCH_BASE_COUNT = 5
const BASE_ROWS = STARTERS_COUNT + BENCH_BASE_COUNT

const PLAYER_POSITION_OPTIONS: Array<{ value: PlayerPosition; label: string }> = [
  { value: 'GOALKEEPER', label: 'Bramkarz' },
  { value: 'DEFENDER', label: 'Obrońca' },
  { value: 'MIDFIELDER', label: 'Pomocnik' },
  { value: 'ATTACKER', label: 'Napastnik' },
]

type SquadRow = {
  personId: string
  position: PlayerPosition | ''
}

function sortPlayersForForm(players: AdminMatchParticipant[]): AdminMatchParticipant[] {
  return [...players].sort((a, b) => {
    const aRank = a.is_starting ? 0 : 1
    const bRank = b.is_starting ? 0 : 1
    if (aRank !== bRank) return aRank - bRank
    return a.person_name.localeCompare(b.person_name, 'pl')
  })
}

function buildInitialRows(players: AdminMatchParticipant[]): SquadRow[] {
  const rows: SquadRow[] = sortPlayersForForm(players)
    .filter((participant) => participant.role === 'PLAYER')
    .map((participant) => ({
      personId: participant.person_id,
      position: participant.player_position ?? '',
    }))

  while (rows.length < BASE_ROWS) {
    rows.push({ personId: '', position: '' })
  }

  return rows
}

export default function MatchSquadForm({
  namePrefix,
  people,
  players,
}: {
  namePrefix: string
  people: AdminMatchParticipantPersonOption[]
  players: AdminMatchParticipant[]
}) {
  const [rows, setRows] = useState<SquadRow[]>(() => buildInitialRows(players))

  function updateRow(index: number, patch: Partial<SquadRow>) {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function addBenchRow() {
    setRows((prev) => [...prev, { personId: '', position: '' }])
  }

  function removeBenchRow() {
    setRows((prev) => {
      if (prev.length <= STARTERS_COUNT) return prev
      return prev.slice(0, -1)
    })
  }

  return (
    <div className="space-y-4">
      {/* Skład podstawowy */}
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full table-fixed">
          <colgroup>
            <col />
            <col className="w-[180px]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-b border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Zawodnik
              </th>
              <th className="border-b border-l border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Pozycja
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, STARTERS_COUNT).map((row, index) => (
              <tr key={`starter-${index}`} className="border-t border-neutral-800 first:border-t-0">
                <td className="bg-neutral-950 px-2 py-2">
                  <select
                    name={`${namePrefix}player_person_id`}
                    value={row.personId}
                    onChange={(event) => updateRow(index, { personId: event.target.value })}
                    className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm ${row.personId ? 'text-neutral-100' : 'text-neutral-500'}`}
                  >
                    <option value="" className="text-neutral-500">{`Podstawowy ${index + 1}`}</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>{person.label}</option>
                    ))}
                  </select>
                </td>
                <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
                  <select
                    name={`${namePrefix}player_position`}
                    value={row.position}
                    onChange={(event) => updateRow(index, { position: event.target.value as PlayerPosition | '' })}
                    className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm ${row.position ? 'text-neutral-100' : 'text-neutral-500'}`}
                  >
                    <option value="" className="text-neutral-500">— wybierz pozycję —</option>
                    {PLAYER_POSITION_OPTIONS.map((pos) => (
                      <option key={pos.value} value={pos.value}>{pos.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rezerwa */}
      {rows.length > STARTERS_COUNT && (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full table-fixed">
            <colgroup>
              <col />
              <col className="w-[180px]" />
            </colgroup>
            <tbody>
              {rows.slice(STARTERS_COUNT).map((row, index) => (
                <tr key={`bench-${index}`} className="border-t border-neutral-800 first:border-t-0">
                  <td className="bg-neutral-950 px-2 py-2">
                    <select
                      name={`${namePrefix}player_person_id`}
                      value={row.personId}
                      onChange={(event) => updateRow(STARTERS_COUNT + index, { personId: event.target.value })}
                      className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm ${row.personId ? 'text-neutral-100' : 'text-neutral-500'}`}
                    >
                      <option value="" className="text-neutral-500">{`Rezerwowy ${index + 1}`}</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>{person.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
                    <select
                      name={`${namePrefix}player_position`}
                      value={row.position}
                      onChange={(event) => updateRow(STARTERS_COUNT + index, { position: event.target.value as PlayerPosition | '' })}
                      className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm ${row.position ? 'text-neutral-100' : 'text-neutral-500'}`}
                    >
                      <option value="" className="text-neutral-500">— wybierz pozycję —</option>
                      {PLAYER_POSITION_OPTIONS.map((pos) => (
                        <option key={pos.value} value={pos.value}>{pos.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addBenchRow}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800"
          aria-label="Dodaj dodatkowego rezerwowego"
          title="Dodaj dodatkowego rezerwowego"
        >
          +
        </button>
        <button
          type="button"
          onClick={removeBenchRow}
          disabled={rows.length <= STARTERS_COUNT}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Usuń ostatniego rezerwowego"
          title="Usuń ostatniego rezerwowego"
        >
          −
        </button>
      </div>
    </div>
  )
}
