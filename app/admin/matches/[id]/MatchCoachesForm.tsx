'use client'

import { useState, useRef, useEffect } from 'react'
import type { AdminMatchParticipant, AdminMatchParticipantPersonOption } from '@/lib/db/matches'
import AddPersonModal from './AddPersonModal'

function buildInitialRows(coaches: AdminMatchParticipant[]): string[] {
  const rows = coaches
    .filter((participant) => participant.role === 'COACH')
    .map((participant) => participant.person_id)

  if (rows.length === 0) {
    rows.push('')
  }

  return rows
}

type PersonComboboxProps = {
  name: string
  value: string
  people: AdminMatchParticipantPersonOption[]
  placeholder: string
  onChange: (personId: string) => void
  onPeopleUpdate: (newPerson: AdminMatchParticipantPersonOption) => void
  usedPersonIds?: string[]
}

function PersonCombobox({ name, value, people, placeholder, onChange, onPeopleUpdate, usedPersonIds = [] }: PersonComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get display label for selected value
  const selectedPerson = people.find((p) => p.id === value)
  const displayLabel = selectedPerson?.label ?? ''

  // Filter and sort results with priority on last name prefix match
  const filteredPeople = searchText.trim()
    ? people.filter((person) => {
        const query = searchText.toLowerCase()
        return (
          person.firstName.toLowerCase().includes(query) ||
          person.lastName.toLowerCase().includes(query) ||
          person.nickname.toLowerCase().includes(query)
        )
      })
      .sort((a, b) => {
        const query = searchText.toLowerCase()
        const aLastNameMatch = a.lastName.toLowerCase().startsWith(query)
        const bLastNameMatch = b.lastName.toLowerCase().startsWith(query)
        if (aLastNameMatch !== bLastNameMatch) return aLastNameMatch ? -1 : 1
        return a.label.localeCompare(b.label, 'pl')
      })
    : []

  // Close dropdown when clicking outside
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
    // Check for duplicates
    if (usedPersonIds.includes(personId) && personId !== value) {
      alert('Ten pracownik jest już przypisany do roli w sztabie.')
      return
    }
    onChange(personId)
    setSearchText('')
    setIsOpen(false)
  }

  function handleAddNewSuccess(newPerson: AdminMatchParticipantPersonOption) {
    onPeopleUpdate(newPerson)
    handleSelect(newPerson.id)
    setIsModalOpen(false)
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          type="hidden"
          name={name}
          value={value}
        />
        <div className="relative w-full">
          <input
            type="text"
            value={isOpen ? searchText : displayLabel}
            onChange={(e) => {
              setSearchText(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => {
              setIsOpen(true)
              setSearchText('')
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
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1 pr-3">
            {isOpen && searchText && filteredPeople.length === 0 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsModalOpen(true)
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-white hover:bg-neutral-600 active:bg-neutral-600"
                title="Dodaj nowego pracownika"
              >
                <span className="text-xs font-bold">+</span>
              </button>
            )}
            <span className="pointer-events-none text-neutral-500">▼</span>
          </div>
        </div>
        {isOpen && (
          <div className="absolute top-full z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
            {filteredPeople.length > 0 ? (
              filteredPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => handleSelect(person.id)}
                  className="w-full border-b border-neutral-800 px-3 py-2 text-left text-sm text-neutral-100 hover:bg-neutral-800 last:border-b-0"
                >
                  {person.label}
                </button>
              ))
            ) : searchText ? (
              <div className="px-3 py-2 text-sm text-neutral-400">
                Brak wyników
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-neutral-500">
                Wpisz, aby wyszukać...
              </div>
            )}
          </div>
        )}
      </div>

      <AddPersonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleAddNewSuccess}
      />
    </>
  )
}

export default function MatchCoachesForm({
  namePrefix,
  people: initialPeople,
  coaches,
}: {
  namePrefix: string
  people: AdminMatchParticipantPersonOption[]
  coaches: AdminMatchParticipant[]
}) {
  const [rows, setRows] = useState<string[]>(() => buildInitialRows(coaches))
  const [people, setPeople] = useState<AdminMatchParticipantPersonOption[]>(initialPeople)

  function handlePeopleUpdate(newPerson: AdminMatchParticipantPersonOption) {
    setPeople((prev) => [...prev, newPerson].sort((a, b) => a.label.localeCompare(b.label, 'pl')))
  }

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
        <PersonCombobox
          key={`coach-row-${index}`}
          name={`${namePrefix}coach_person_id`}
          value={value}
          people={people}
          placeholder={`Trener ${index + 1}`}
          onChange={(personId) => updateRow(index, personId)}
          onPeopleUpdate={handlePeopleUpdate}
          usedPersonIds={rows.filter((_, i) => i !== index).filter(Boolean)}
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
