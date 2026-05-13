'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdminMatchParticipantPersonOption } from '@/lib/db/matches'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'
import AddPersonModal from './AddPersonModal'

export const MATCH_PERSON_CREATED_EVENT = 'match:person-created'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type PersonPickerFieldProps = {
  name: string
  value: string
  /** Initial/known people — used for label display and offline fallback.
   *  Pass current match participants here; full search is done via `searchUrl`. */
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
  /** When set, people are fetched from this URL with ?q= instead of filtering `people` client-side. */
  searchUrl?: string
}

export default function PersonPickerField({
  name,
  value,
  people: initialPeople,
  placeholder,
  onChange,
  onPeopleUpdate,
  usedPersonIds = [],
  duplicateMessage,
  addButtonTitle = 'Dodaj nową osobę',
  cities,
  countries,
  federations,
  searchUrl,
}: PersonPickerFieldProps) {
  const [knownPeople, setKnownPeople] = useState<AdminMatchParticipantPersonOption[]>(initialPeople)
  const [searchResults, setSearchResults] = useState<AdminMatchParticipantPersonOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const debouncedSearch = useDebounce(searchText, 300)

  // Keep knownPeople in sync if parent updates the prop (e.g. new person added via modal)
  useEffect(() => {
    setKnownPeople(initialPeople)
  }, [initialPeople])

  // Async search — runs whenever dropdown opens or query changes
  useEffect(() => {
    if (!searchUrl || !isOpen) return
    let cancelled = false
    setIsFetching(true)
    const url = `${searchUrl}?q=${encodeURIComponent(debouncedSearch)}`
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: AdminMatchParticipantPersonOption[]) => {
        if (!cancelled) {
          // API results ARE the list — no merging with knownPeople
          setSearchResults(data)
          setIsFetching(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Fallback to known participants on error
          setSearchResults(knownPeople)
          setIsFetching(false)
        }
      })
    return () => { cancelled = true }
  }, [searchUrl, debouncedSearch, isOpen, knownPeople])

  const peoplePool = searchUrl ? searchResults : knownPeople

  const selectedPerson = useCallback(
    () => knownPeople.find((p) => p.id === value) ?? searchResults.find((p) => p.id === value),
    [knownPeople, searchResults, value]
  )

  const displayLabel = selectedPerson()?.label ?? ''

  const filteredPeople = searchUrl
    ? peoplePool
    : peoplePool
        .filter((person) => {
          const q = searchText.trim().toLowerCase()
          if (!q) return true
          return (
            person.firstName.toLowerCase().includes(q)
            || person.lastName.toLowerCase().includes(q)
            || person.nickname.toLowerCase().includes(q)
          )
        })
        .sort((a, b) => {
          const q = searchText.trim().toLowerCase()
          if (!q) return a.label.localeCompare(b.label, 'pl')
          const aMatch = a.lastName.toLowerCase().startsWith(q)
          const bMatch = b.lastName.toLowerCase().startsWith(q)
          if (aMatch !== bMatch) return aMatch ? -1 : 1
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
      if (duplicateMessage) alert(duplicateMessage)
      return
    }
    // Remember the selected person for label display
    const found = peoplePool.find((p) => p.id === personId)
    if (found && !knownPeople.some((p) => p.id === personId)) {
      setKnownPeople((prev) => [...prev, found].sort((a, b) => a.label.localeCompare(b.label, 'pl')))
    }
    onChange(personId)
    setSearchText('')
    setIsOpen(false)
  }

  function handleAddNewSuccess(newPerson: AdminMatchParticipantPersonOption) {
    setKnownPeople((prev) => {
      if (prev.some((p) => p.id === newPerson.id)) return prev
      return [...prev, newPerson].sort((a, b) => a.label.localeCompare(b.label, 'pl'))
    })
    onPeopleUpdate(newPerson)
    window.dispatchEvent(
      new CustomEvent<AdminMatchParticipantPersonOption>(MATCH_PERSON_CREATED_EVENT, { detail: newPerson })
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
              setActiveIndex(-1)
              if (value && nextValue.trim() === '') onChange('')
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setIsOpen(false)
                setSearchText('')
                setActiveIndex(-1)
                return
              }
              if ((e.key === 'Backspace' || e.key === 'Delete') && value && searchText.trim() === '') {
                e.preventDefault()
                clearSelection()
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (!isOpen) { setIsOpen(true); return }
                setActiveIndex((prev) => {
                  const next = prev < filteredPeople.length - 1 ? prev + 1 : prev
                  setTimeout(() => {
                    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
                  }, 0)
                  return next
                })
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((prev) => {
                  const next = prev > 0 ? prev - 1 : 0
                  setTimeout(() => {
                    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
                  }, 0)
                  return next
                })
                return
              }
              if (e.key !== 'Enter') return
              if (filteredPeople.length === 0) {
                if (searchText.trim() !== '') {
                  e.preventDefault()
                  setIsOpen(false)
                  setIsModalOpen(true)
                }
                return
              }
              e.preventDefault()
              const target = activeIndex >= 0 ? filteredPeople[activeIndex] : filteredPeople[0]
              handleSelect(target?.id ?? '')
              setActiveIndex(-1)
            }}
            onBlur={() => {
              setTimeout(() => {
                if (!selectedPerson()) setSearchText('')
                setIsOpen(false)
                setActiveIndex(-1)
              }, 150)
            }}
            placeholder={placeholder}
            className={`w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm ${
              value ? 'text-neutral-100' : 'text-neutral-500'
            }`}
          />

          {isOpen && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setIsModalOpen(true) }}
              className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-700 text-white hover:bg-neutral-600 active:bg-neutral-600"
              title={addButtonTitle}
            >
              <span className="text-xs font-bold">+</span>
            </button>
          )}
        </div>

        {isOpen && (
          <div ref={listRef} className="absolute left-0 top-full z-10 mt-1 max-h-80 min-w-full w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
            {filteredPeople.length > 0 ? (
              filteredPeople.map((person, idx) => {
                const birthYear = person.birth_date ? new Date(person.birth_date).getFullYear() : null
                const countryCode = person.represented_country_fifa_code
                const birthAndCountry = [birthYear?.toString(), countryCode].filter(Boolean).join(', ')
                const displayLabel = birthAndCountry ? `${person.label} (${birthAndCountry})` : person.label

                return (
                  <button
                    key={person.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(person.id); setActiveIndex(-1) }}
                    className={`w-full border-b border-neutral-800 px-3 py-1.5 text-left text-sm text-neutral-100 last:border-b-0 ${
                      idx === activeIndex ? 'bg-neutral-700' : 'hover:bg-neutral-800'
                    }`}
                  >
                    {displayLabel}
                  </button>
                )
              })
            ) : isFetching ? (
              <div className="px-3 py-1.5 text-sm text-neutral-500 animate-pulse">Szukam…</div>
            ) : searchText ? (
              <div className="px-3 py-1.5 text-sm text-neutral-400">Brak wyników</div>
            ) : (
              <div className="px-3 py-1.5 text-sm text-neutral-500">
                {searchUrl ? 'Zacznij pisać, aby wyszukać…' : 'Wpisz, aby wyszukać...'}
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
        federations={federations}
      />
    </>
  )
}
