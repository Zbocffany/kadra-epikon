'use client'

import { useEffect, useState } from 'react'
import type { AdminMatchParticipant, AdminMatchParticipantPersonOption } from '@/lib/db/matches'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'
import PersonPickerField, { MATCH_PERSON_CREATED_EVENT } from './PersonPickerField'

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
  people: initialPeople,
  coaches,
  cities,
  countries,
  federations,
}: {
  namePrefix: string
  people: AdminMatchParticipantPersonOption[]
  coaches: AdminMatchParticipant[]
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
  federations: AdminFederation[]
}) {
  const [rows, setRows] = useState<string[]>(() => buildInitialRows(coaches))
  const [people, setPeople] = useState<AdminMatchParticipantPersonOption[]>(initialPeople)

  function handlePeopleUpdate(newPerson: AdminMatchParticipantPersonOption) {
    setPeople((prev) => {
      if (prev.some((person) => person.id === newPerson.id)) {
        return prev
      }

      return [...prev, newPerson].sort((a, b) => a.label.localeCompare(b.label, 'pl'))
    })
  }

  useEffect(() => {
    function handlePersonCreated(event: Event) {
      const customEvent = event as CustomEvent<AdminMatchParticipantPersonOption>
      const createdPerson = customEvent.detail

      if (!createdPerson) return
      handlePeopleUpdate(createdPerson)
    }

    window.addEventListener(MATCH_PERSON_CREATED_EVENT, handlePersonCreated)
    return () => window.removeEventListener(MATCH_PERSON_CREATED_EVENT, handlePersonCreated)
  }, [])

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
        <PersonPickerField
          key={`coach-row-${index}`}
          name={`${namePrefix}coach_person_id`}
          value={value}
          people={people}
          placeholder={`Trener ${index + 1}`}
          onChange={(personId) => updateRow(index, personId)}
          onPeopleUpdate={handlePeopleUpdate}
          usedPersonIds={rows.filter((_, i) => i !== index).filter(Boolean)}
          duplicateMessage="Ten pracownik jest już przypisany do roli w sztabie."
          addButtonTitle="Dodaj nowego pracownika"
          cities={cities}
          countries={countries}
          federations={federations}
        />
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
