'use client'

import { useState, useRef, useEffect } from 'react'
import type {
  AdminMatchParticipant,
  AdminMatchParticipantPersonOption,
  PlayerPosition,
} from '@/lib/db/matches'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import AddPersonModal from './AddPersonModal'

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

type PersonComboboxProps = {
  name: string
  value: string
  people: AdminMatchParticipantPersonOption[]
  placeholder: string
  onChange: (personId: string) => void
  onPeopleUpdate: (newPerson: AdminMatchParticipantPersonOption) => void
  usedPersonIds?: string[]
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
}

function PersonCombobox({
  name,
  value,
  people,
  placeholder,
  onChange,
  onPeopleUpdate,
  usedPersonIds = [],
  cities,
  countries,
}: PersonComboboxProps) {
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
      alert('Ten piłkarz jest już przypisany do innego miejsca w składzie.')
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
            className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm ${
              value ? 'text-neutral-100' : 'text-neutral-500'
            }`}
          />
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1 pr-2">
            {isOpen && searchText && filteredPeople.length === 0 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsModalOpen(true)
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-white hover:bg-neutral-600 active:bg-neutral-600"
                title="Dodaj nowego piłkarza"
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
        cities={cities}
        countries={countries}
      />
    </>
  )
}

export default function MatchSquadForm({
  namePrefix,
  people: initialPeople,
  players,
  cities,
  countries,
}: {
  namePrefix: string
  people: AdminMatchParticipantPersonOption[]
  players: AdminMatchParticipant[]
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
}) {
  const [rows, setRows] = useState<SquadRow[]>(() => buildInitialRows(players))
  const [people, setPeople] = useState<AdminMatchParticipantPersonOption[]>(initialPeople)

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

  function handlePeopleUpdate(newPerson: AdminMatchParticipantPersonOption) {
    setPeople((prev) => [...prev, newPerson].sort((a, b) => a.label.localeCompare(b.label, 'pl')))
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
                  <PersonCombobox
                    name={`${namePrefix}player_person_id`}
                    value={row.personId}
                    people={people}
                    placeholder={`Podstawowy ${index + 1}`}
                    onChange={(personId) => updateRow(index, { personId })}
                    onPeopleUpdate={handlePeopleUpdate}
                    usedPersonIds={rows.map((r, i) => i === index ? '' : r.personId).filter(Boolean)}
                    cities={cities}
                    countries={countries}
                  />
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
                    <PersonCombobox
                      name={`${namePrefix}player_person_id`}
                      value={row.personId}
                      people={people}
                      placeholder={`Rezerwowy ${index + 1}`}
                      onChange={(personId) => updateRow(STARTERS_COUNT + index, { personId })}
                      onPeopleUpdate={handlePeopleUpdate}
                      usedPersonIds={rows.filter((_, i) => i !== STARTERS_COUNT + index).map(r => r.personId).filter(Boolean)}
                      cities={cities}
                      countries={countries}
                    />
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
