'use client'

import { useState } from 'react'
import type { AdminMatchParticipant, AdminMatchParticipantPersonOption } from '@/lib/db/matches'

function buildInitialRows(coaches: AdminMatchParticipant[]): string[] {
  const rows = coaches
    .filter((participant) => participant.role === 'COACH')
    .map((participant) => participant.person_id)

  if (rows.length === 0) {
    rows.push('')
  }

  return rows
}

export default function MatchCoachesForm({
  namePrefix,
  people,
  coaches,
}: {
  namePrefix: string
  people: AdminMatchParticipantPersonOption[]
  coaches: AdminMatchParticipant[]
}) {
  const [rows, setRows] = useState<string[]>(() => buildInitialRows(coaches))

  function updateRow(index: number, value: string) {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? value : row)))
  }

  function addRow() {
    setRows((prev) => [...prev, ''])
  }

  function removeLastRow() {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.slice(0, -1)
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      {rows.map((value, index) => (
        <select
          key={`coach-row-${index}`}
          name={`${namePrefix}coach_person_id`}
          value={value}
          onChange={(event) => updateRow(index, event.target.value)}
          className={`w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm ${value ? 'text-neutral-100' : 'text-neutral-500'}`}
        >
          <option value="" className="text-neutral-500">{`Trener ${index + 1}`}</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800"
          aria-label="Dodaj kolejnego trenera"
          title="Dodaj kolejnego trenera"
        >
          +
        </button>
        <button
          type="button"
          onClick={removeLastRow}
          disabled={rows.length <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Usuń ostatniego trenera"
          title="Usuń ostatniego trenera"
        >
          −
        </button>
      </div>
    </div>
  )
}
