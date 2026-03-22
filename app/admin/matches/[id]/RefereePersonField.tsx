'use client'

import { useEffect, useState } from 'react'
import type { AdminMatchParticipantPersonOption } from '@/lib/db/matches'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import PersonPickerField, { MATCH_PERSON_CREATED_EVENT } from './PersonPickerField'

type RefereePersonFieldProps = {
  name: string
  value: string
  people: AdminMatchParticipantPersonOption[]
  placeholder: string
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
}

export default function RefereePersonField({
  name,
  value,
  people: initialPeople,
  placeholder,
  cities,
  countries,
}: RefereePersonFieldProps) {
  const [people, setPeople] = useState<AdminMatchParticipantPersonOption[]>(initialPeople)
  const [selectedPersonId, setSelectedPersonId] = useState(value)

  useEffect(() => {
    setPeople(initialPeople)
  }, [initialPeople])

  useEffect(() => {
    setSelectedPersonId(value)
  }, [value])

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

  return (
    <PersonPickerField
      name={name}
      value={selectedPersonId}
      people={people}
      placeholder={placeholder}
      onChange={setSelectedPersonId}
      onPeopleUpdate={handlePeopleUpdate}
      addButtonTitle="Dodaj nową osobę"
      cities={cities}
      countries={countries}
    />
  )
}