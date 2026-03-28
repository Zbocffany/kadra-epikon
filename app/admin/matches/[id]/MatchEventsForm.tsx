'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { AdminMatchEvent, AdminMatchParticipantPersonOption, AdminTeamOption, MatchEventType } from '@/lib/db/matches'
import { Icon } from '@/components/icons'

export type MatchEventPersonOption = Pick<AdminMatchParticipantPersonOption, 'id' | 'label'> & {
  teamIds: string[]
}

type EventGroup = 'GOAL' | 'CARD' | 'SUBSTITUTION' | 'OTHER'

type EventRow = {
  minute: string
  eventType: MatchEventType
  teamId: string
  primaryPersonId: string
  secondaryPersonId: string
  minuteExtra: string
  group: EventGroup
}

const EVENT_TYPE_LABEL: Record<MatchEventType, string> = {
  GOAL: 'Gol',
  OWN_GOAL: 'Gol samobójczy',
  PENALTY_GOAL: 'Gol z karnego',
  YELLOW_CARD: 'Żółta kartka',
  SECOND_YELLOW_CARD: 'Druga żółta kartka',
  RED_CARD: 'Czerwona kartka',
  PENALTY_SHOOTOUT_SCORED: 'Karny pomeczowy - gol',
  PENALTY_SHOOTOUT_MISSED: 'Karny pomeczowy - pudło',
  PENALTY_SHOOTOUT_SAVED: 'Karny pomeczowy - obroniony',
  MATCH_PENALTY_SAVED: 'Obroniony karny w meczu',
  MATCH_PENALTY_MISSED: 'Nietrafiony karny w meczu',
  SUBSTITUTION: 'Zmiana',
}

const EVENT_TYPES_BY_GROUP: Record<EventGroup, MatchEventType[]> = {
  GOAL: ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'],
  CARD: ['YELLOW_CARD', 'SECOND_YELLOW_CARD', 'RED_CARD'],
  SUBSTITUTION: ['SUBSTITUTION'],
  OTHER: [
    'PENALTY_SHOOTOUT_SCORED',
    'PENALTY_SHOOTOUT_MISSED',
    'PENALTY_SHOOTOUT_SAVED',
    'MATCH_PENALTY_SAVED',
    'MATCH_PENALTY_MISSED',
  ],
}

const NO_SECONDARY_PERSON_TYPES = new Set<MatchEventType>([
  'PENALTY_GOAL',
  'YELLOW_CARD',
  'SECOND_YELLOW_CARD',
  'RED_CARD',
  'PENALTY_SHOOTOUT_SCORED',
  'PENALTY_SHOOTOUT_MISSED',
  'PENALTY_SHOOTOUT_SAVED',
  'MATCH_PENALTY_SAVED',
  'MATCH_PENALTY_MISSED',
])

const EXTRA_TIME_ALLOWED_MINUTES = new Set(['45', '90', '115', '120'])

function resolveGroup(eventType: MatchEventType): EventGroup {
  if (EVENT_TYPES_BY_GROUP.GOAL.includes(eventType)) return 'GOAL'
  if (EVENT_TYPES_BY_GROUP.CARD.includes(eventType)) return 'CARD'
  if (EVENT_TYPES_BY_GROUP.SUBSTITUTION.includes(eventType)) return 'SUBSTITUTION'
  return 'OTHER'
}

function mapEventToRow(event: AdminMatchEvent): EventRow {
  const group = resolveGroup(event.event_type)

  return {
    minute: String(event.minute),
    eventType: event.event_type,
    teamId: event.team_id ?? '',
    primaryPersonId: event.primary_person_id ?? '',
    secondaryPersonId: event.secondary_person_id ?? '',
    minuteExtra: event.minute_extra === null ? '' : String(event.minute_extra),
    group,
  }
}

function buildEmptyRow(group: EventGroup): EventRow {
  return {
    minute: '',
    eventType: EVENT_TYPES_BY_GROUP[group][0],
    teamId: '',
    primaryPersonId: '',
    secondaryPersonId: '',
    minuteExtra: '',
    group,
  }
}

function EventPersonPicker({
  name,
  value,
  options,
  disabled,
  onChange,
}: {
  name: string
  value: string
  options: MatchEventPersonOption[]
  disabled?: boolean
  onChange: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null)

  const selectedLabel = options.find((opt) => opt.id === value)?.label ?? ''

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(query))
  }, [options, searchText])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const clickedInsideTrigger = containerRef.current?.contains(target) ?? false
      const clickedInsideDropdown = dropdownRef.current?.contains(target) ?? false
      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsOpen(false)
        setSearchText('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 1200,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen])

  if (disabled) {
    return (
      <div className="w-full cursor-not-allowed rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-600 opacity-40">
        <input type="hidden" name={name} value="" />
        —
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <div ref={triggerRef} className="relative">
        <input
          type="text"
          value={isOpen ? searchText : selectedLabel}
          onChange={(e) => {
            setSearchText(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered.length > 0) {
                onChange(filtered[0].id)
                setSearchText('')
                setIsOpen(false)
              }
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setIsOpen(false)
              setSearchText('')
            }
          }}
          placeholder="Brak"
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 pr-6 text-sm text-neutral-100 placeholder:text-neutral-500"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setSearchText('')
              setIsOpen(false)
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-100"
            aria-label="Wyczyść wybór"
          >
            ×
          </button>
        )}
      </div>
      {isOpen && dropdownStyle && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="max-h-52 overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg"
          >
            <button
              type="button"
              onClick={() => {
                onChange('')
                setSearchText('')
                setIsOpen(false)
              }}
              className="w-full border-b border-neutral-800 px-3 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-800"
            >
              Brak
            </button>
            {filtered.length > 0 ? (
              filtered.map((opt) => (
                (() => {
                  const isSelected = opt.id === value
                  return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id)
                    setSearchText('')
                    setIsOpen(false)
                  }}
                  aria-selected={isSelected}
                  className={`w-full border-b border-neutral-800 px-3 py-1.5 text-left text-sm last:border-b-0 ${
                    isSelected
                      ? 'bg-neutral-800 text-neutral-100 font-semibold'
                      : 'text-neutral-100 hover:bg-neutral-800'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {isSelected ? <span className="text-emerald-400">✓</span> : null}
                    <span>{opt.label}</span>
                  </span>
                </button>
                  )
                })()
              ))
            ) : (
              <div className="px-3 py-1.5 text-sm text-neutral-400">Brak wyników</div>
            )}
          </div>,
          document.body
        )
        : null}
    </div>
  )
}

export default function MatchEventsForm({
  events,
  people,
  teams,
  matchId,
  clearDraft,
}: {
  events: AdminMatchEvent[]
  people: MatchEventPersonOption[]
  teams: AdminTeamOption[]
  matchId: string
  clearDraft: boolean
}) {
  const [rows, setRows] = useState<EventRow[]>(() => events.map(mapEventToRow))
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isTouched, setIsTouched] = useState(false)
  const [isDraftHydrated, setIsDraftHydrated] = useState(false)
  const storageKey = `match-events-draft:${matchId}`

  const peopleOptions = useMemo(
    () => [...people].sort((a, b) => a.label.localeCompare(b.label, 'pl')),
    [people]
  )

  const DIGITS_ONLY = /\D/g

  function sanitizeDigits(value: string, maxDigits: number): string {
    return value.replace(DIGITS_ONLY, '').slice(0, maxDigits)
  }

  function getPeopleOptionsForTeam(teamId: string): MatchEventPersonOption[] {
    if (!teamId) return peopleOptions
    return peopleOptions.filter((person) => person.teamIds.includes(teamId))
  }

  function persistDraft(nextRows: EventRow[]) {
    if (typeof window === 'undefined' || clearDraft) return
    window.sessionStorage.setItem(storageKey, JSON.stringify(nextRows))
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (clearDraft) {
      window.sessionStorage.removeItem(storageKey)
      setIsDraftHydrated(true)
      return
    }

    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) {
      setIsDraftHydrated(true)
      return
    }

    try {
      const parsed = JSON.parse(raw) as EventRow[]
      if (!Array.isArray(parsed)) {
        setIsDraftHydrated(true)
        return
      }

      setRows(parsed)
      setIsTouched(true)
    } catch {
      window.sessionStorage.removeItem(storageKey)
    } finally {
      setIsDraftHydrated(true)
    }
  }, [clearDraft, storageKey])

  useEffect(() => {
    if (typeof window === 'undefined' || clearDraft || !isDraftHydrated || !isTouched) return
    window.sessionStorage.setItem(storageKey, JSON.stringify(rows))
  }, [rows, clearDraft, isDraftHydrated, isTouched, storageKey])

  function updateRow(index: number, patch: Partial<EventRow>) {
    setIsTouched(true)
    setRows((prev) => {
      const nextRows = prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
      persistDraft(nextRows)
      return nextRows
    })
  }

  function addRow(group: EventGroup) {
    setIsTouched(true)
    setRows((prev) => {
      const nextRows = [...prev, buildEmptyRow(group)]
      persistDraft(nextRows)
      return nextRows
    })
  }

  function removeRow(index: number) {
    setIsTouched(true)
    setRows((prev) => {
      const nextRows = prev.filter((_, rowIndex) => rowIndex !== index)
      persistDraft(nextRows)
      return nextRows
    })
  }

  function moveRow(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    setIsTouched(true)

    setRows((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      persistDraft(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="events_touched" value={isTouched ? '1' : '0'} />
      <div className="overflow-visible rounded-lg border border-neutral-800">
        <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full table-auto">
          <colgroup>
            <col className="w-[36px]" />
            <col className="w-[64px]" />
            <col className="w-[56px]" />
            <col className="w-[160px]" />
            <col className="w-[150px]" />
            <col className="w-[170px]" />
            <col className="w-[170px]" />
            <col className="w-[48px]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-b border-neutral-800 bg-neutral-900 px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest text-neutral-500">
                #
              </th>
              <th className="border-b border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Minuta
              </th>
              <th className="border-b border-l border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
                +Min
              </th>
              <th className="border-b border-l border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Zdarzenie
              </th>
              <th className="border-b border-l border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Drużyna
              </th>
              <th className="border-b border-l border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Osoba 1
              </th>
              <th className="border-b border-l border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Osoba 2
              </th>
              <th className="border-b border-l border-neutral-800 bg-neutral-900 px-1 py-2 text-center text-xs font-semibold uppercase tracking-widest text-neutral-500">
                -
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="bg-neutral-950 px-3 py-4 text-sm text-neutral-500">
                  Brak zdarzeń. Użyj przycisków poniżej, aby dodać pierwszy wiersz.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const peopleOptionsForTeam = getPeopleOptionsForTeam(row.teamId)
                const opposingTeamId = teams.find((t) => t.id !== row.teamId)?.id ?? ''
                const isPerson2Disabled = NO_SECONDARY_PERSON_TYPES.has(row.eventType)
                const isMinuteExtraDisabled = !EXTRA_TIME_ALLOWED_MINUTES.has(row.minute)
                const primaryPeopleOptions = row.eventType === 'OWN_GOAL'
                  ? getPeopleOptionsForTeam(opposingTeamId)
                  : peopleOptionsForTeam

                return (
                <tr
                  key={`event-row-${index}`}
                  className="border-t border-neutral-800 first:border-t-0"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (draggedIndex === null) return
                    moveRow(draggedIndex, index)
                    setDraggedIndex(null)
                  }}
                >
                  <td className="bg-neutral-950 px-1 py-2 text-center">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragEnd={() => setDraggedIndex(null)}
                      className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 active:cursor-grabbing"
                      aria-label={`Przeciągnij zdarzenie ${index + 1}`}
                      title="Przeciągnij, aby zmienić kolejność"
                    >
                      ≡
                    </button>
                  </td>
                  <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
                    <input
                      type="text"
                      name="event_minute"
                      inputMode="numeric"
                      maxLength={3}
                      value={row.minute}
                      onChange={(event) => {
                        const nextMinute = sanitizeDigits(event.target.value, 3)
                        const allowExtra = EXTRA_TIME_ALLOWED_MINUTES.has(nextMinute)
                        updateRow(index, {
                          minute: nextMinute,
                          ...(!allowExtra ? { minuteExtra: '' } : {}),
                        })
                      }}
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100"
                    />
                  </td>
                  <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
                    <input type="hidden" name="event_minute_extra" value={isMinuteExtraDisabled ? '' : row.minuteExtra} />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      disabled={isMinuteExtraDisabled}
                      value={isMinuteExtraDisabled ? '' : row.minuteExtra}
                      onChange={(event) => updateRow(index, { minuteExtra: sanitizeDigits(event.target.value, 2) })}
                      className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm ${
                        isMinuteExtraDisabled ? 'cursor-not-allowed text-neutral-600 opacity-40' : 'text-neutral-100'
                      }`}
                    />
                  </td>
                  <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
                    <select
                      name="event_type"
                      value={row.eventType}
                      onChange={(event) => {
                        const nextType = event.target.value as MatchEventType
                        const wasOwnGoal = row.eventType === 'OWN_GOAL'
                        const isOwnGoal = nextType === 'OWN_GOAL'
                        const clearPrimary = wasOwnGoal !== isOwnGoal
                        const clearSecondary = NO_SECONDARY_PERSON_TYPES.has(nextType)
                        updateRow(index, {
                          eventType: nextType,
                          ...(clearPrimary ? { primaryPersonId: '' } : {}),
                          ...(clearSecondary ? { secondaryPersonId: '' } : {}),
                        })
                      }}
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100"
                    >
                      {EVENT_TYPES_BY_GROUP[row.group].map((type) => (
                        <option key={type} value={type}>{EVENT_TYPE_LABEL[type]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
                    <select
                      name="event_team_id"
                      value={row.teamId}
                      onChange={(event) => {
                        const nextTeamId = event.target.value
                        const nextPeople = getPeopleOptionsForTeam(nextTeamId)
                        const nextOpposingTeamId = teams.find((t) => t.id !== nextTeamId)?.id ?? ''
                        const nextPrimaryPeople = row.eventType === 'OWN_GOAL'
                          ? getPeopleOptionsForTeam(nextOpposingTeamId)
                          : nextPeople

                        updateRow(index, {
                          teamId: nextTeamId,
                          primaryPersonId: nextPrimaryPeople.some((person) => person.id === row.primaryPersonId)
                            ? row.primaryPersonId
                            : '',
                          secondaryPersonId: nextPeople.some((person) => person.id === row.secondaryPersonId)
                            ? row.secondaryPersonId
                            : '',
                        })
                      }}
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100"
                    >
                      <option value="">Brak</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
                    <EventPersonPicker
                      name="event_primary_person_id"
                      value={row.primaryPersonId}
                      options={primaryPeopleOptions}
                      onChange={(id) => updateRow(index, { primaryPersonId: id })}
                    />
                  </td>
                  <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
                    <EventPersonPicker
                      name="event_secondary_person_id"
                      value={row.secondaryPersonId}
                      options={peopleOptionsForTeam}
                      disabled={isPerson2Disabled}
                      onChange={(id) => updateRow(index, { secondaryPersonId: id })}
                    />
                  </td>
                  <td className="border-l border-neutral-800 bg-neutral-950 px-1 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800"
                      aria-label={`Usuń wiersz zdarzenia ${index + 1}`}
                      title="Usuń ten wiersz"
                    >
                      -
                    </button>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => addRow('GOAL')}
          className="inline-flex h-8 items-center rounded-full border border-neutral-700 bg-neutral-950 px-3 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
          title="Dodaj nowy wiersz zdarzenia typu gol"
        >
          Dodaj gol
          <Icon name="goal" className="ml-1 h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => addRow('CARD')}
          className="inline-flex h-8 items-center rounded-full border border-neutral-700 bg-neutral-950 px-3 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
          title="Dodaj nowy wiersz zdarzenia typu kartka"
        >
          Dodaj kartkę
          <Icon name="yellowCard" className="ml-1 h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => addRow('SUBSTITUTION')}
          className="inline-flex h-8 items-center rounded-full border border-neutral-700 bg-neutral-950 px-3 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
          title="Dodaj nowy wiersz zdarzenia typu zmiana"
        >
          Dodaj zmianę
          <Icon name="substitution" className="ml-1 h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => addRow('OTHER')}
          className="inline-flex h-8 items-center rounded-full border border-neutral-700 bg-neutral-950 px-3 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
          title="Dodaj nowy wiersz pozostałych typów zdarzeń"
        >
          Dodaj inne
        </button>
      </div>
    </div>
  )
}
