'use client'

import { useEffect, useRef, useState } from 'react'
import type { AdminMatchParticipantPersonOption } from '@/lib/db/matches'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'
import AddPersonModal from './AddPersonModal'

export const MATCH_PERSON_CREATED_EVENT = 'match:person-created'

type PersonPickerFieldProps = {
  name: string
  value: string
  people: AdminMatchParticipantPersonOption[]
  placeholder: string
  onChange: (personId: string) => void
  onPeopleUpdate: (newPerson: AdminMatchParticipantPersonOption) => void
  usedPersonIds?: string[]
  duplicateMessage?: string
  addButtonTitle?: string
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
  federations: AdminFederation[]
}

export default function PersonPickerField({
  name,
  value,
  people,
  placeholder,
  onChange,
  onPeopleUpdate,
  usedPersonIds = [],
  duplicateMessage,
  addButtonTitle = 'Dodaj nową osobę',
  cities,
  countries,
  federations,
}: PersonPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedPerson = people.find((person) => person.id === value)
  const displayLabel = selectedPerson?.label ?? ''

  const filteredPeople = people
    .filter((person) => {
      const query = searchText.trim().toLowerCase()
      if (!query) return true
      return (
        person.firstName.toLowerCase().includes(query)
        || person.lastName.toLowerCase().includes(query)
        || person.nickname.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      const query = searchText.trim().toLowerCase()
      if (!query) return a.label.localeCompare(b.label, 'pl')

      const aLastNameMatch = a.lastName.toLowerCase().startsWith(query)
      const bLastNameMatch = b.lastName.toLowerCase().startsWith(query)
      if (aLastNameMatch !== bLastNameMatch) return aLastNameMatch ? -1 : 1
      return a.label.localeCompare(b.label, 'pl')
    })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(personId: string) {
    if (usedPersonIds.includes(personId) && personId !== value) {
      if (duplicateMessage) {
        alert(duplicateMessage)
      }
      return
    }

    onChange(personId)
    setSearchText('')
    setIsOpen(false)
  }

  function handleAddNewSuccess(newPerson: AdminMatchParticipantPersonOption) {
    onPeopleUpdate(newPerson)

    window.dispatchEvent(
      new CustomEvent<AdminMatchParticipantPersonOption>(MATCH_PERSON_CREATED_EVENT, {
        detail: newPerson,
      })
    )

    handleSelect(newPerson.id)
    setIsModalOpen(false)
  }

  function clearSelection() {
    onChange('')
    setSearchText('')
    setIsOpen(false)
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <input type="hidden" name={name} value={value} />

        <div className="relative w-full">
          <input
            type="text"
            value={isOpen && searchText.trim() ? searchText : displayLabel}
            onChange={(e) => {
              const nextValue = e.target.value
              setSearchText(nextValue)
              if (value && nextValue.trim() === '') {
                onChange('')
              }
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setIsOpen(false)
                setSearchText('')
                return
              }

              if ((e.key === 'Backspace' || e.key === 'Delete') && value && searchText.trim() === '') {
                e.preventDefault()
                clearSelection()
                return
              }

              if (e.key !== 'Enter') {
                return
              }

              if (filteredPeople.length === 0) {
                if (searchText.trim() !== '') {
                  e.preventDefault()
                  setIsOpen(false)
                  setIsModalOpen(true)
                }
                return
              }

              e.preventDefault()
              handleSelect(filteredPeople[0]?.id ?? '')
            }}
            onBlur={() => {
              setTimeout(() => {
                if (!selectedPerson) {
                  setSearchText('')
                }
                setIsOpen(false)
              }, 100)
            }}
            placeholder={placeholder}
            className={`w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm ${
              value ? 'text-neutral-100' : 'text-neutral-500'
            }`}
          />

          {isOpen && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                setIsModalOpen(true)
              }}
              className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-700 text-white hover:bg-neutral-600 active:bg-neutral-600"
              title={addButtonTitle}
            >
              <span className="text-xs font-bold">+</span>
            </button>
          )}
        </div>

        {isOpen && (
          <div className="absolute top-full z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
            {filteredPeople.length > 0 ? (
              filteredPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => handleSelect(person.id)}
                  className="w-full border-b border-neutral-800 px-3 py-1.5 text-left text-sm text-neutral-100 hover:bg-neutral-800 last:border-b-0"
                >
                  {person.label}
                </button>
              ))
            ) : searchText ? (
              <div className="px-3 py-1.5 text-sm text-neutral-400">Brak wyników</div>
            ) : (
              <div className="px-3 py-1.5 text-sm text-neutral-500">Wpisz, aby wyszukać...</div>
            )}
          </div>
        )}
      </div>

      <AddPersonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleAddNewSuccess}
        cities={cities}
        countries={countries}
        federations={federations}
      />
    </>
  )
}