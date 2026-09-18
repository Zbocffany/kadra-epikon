'use client'

import { useState, useEffect, useMemo } from 'react'
import type {
  AdminMatchParticipant,
  AdminMatchParticipantPersonOption,
  AdminTeamOption,
  PlayerPosition,
  SquadRole,
} from '@/lib/db/matches'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { createClubInline } from '@/app/admin/clubs/actions'
import PersonPickerField, { MATCH_PERSON_CREATED_EVENT } from './PersonPickerField'
import { compareByPlayerPosition } from '../playerPositionSort'
import { renderCreateClubInlineForm } from '../inlineCreateForms'
import { formatCityWithFifa } from '@/lib/utils/cityLabel'

const STARTERS_COUNT = 11
const BENCH_BASE_COUNT = 5
const CALLED_UP_BASE_COUNT = 5

const PLAYER_POSITION_OPTIONS: Array<{ value: PlayerPosition; label: string }> = [
  { value: 'GOALKEEPER', label: 'Bramkarz' },
  { value: 'DEFENDER', label: 'Obrońca' },
  { value: 'MIDFIELDER', label: 'Pomocnik' },
  { value: 'ATTACKER', label: 'Napastnik' },
]

type SquadRow = {
  personId: string
  position: PlayerPosition | ''
  clubTeamId: string
  squadRole: SquadRole
}

function emptyRow(squadRole: SquadRole): SquadRow {
  return { personId: '', position: '', clubTeamId: '', squadRole }
}

function sortPlayersForForm(players: AdminMatchParticipant[]): AdminMatchParticipant[] {
  return [...players].sort((a, b) => {
    const rank = (p: AdminMatchParticipant) => {
      if (p.squad_role === 'STARTING' || p.is_starting) return 0
      if (p.squad_role === 'BENCH') return 1
      if (p.squad_role === 'CALLED_UP') return 2
      return p.is_starting === false ? 1 : 3
    }
    const aRank = rank(a)
    const bRank = rank(b)
    if (aRank !== bRank) return aRank - bRank
    return a.person_name.localeCompare(b.person_name, 'pl')
  })
}

function buildInitialRows(players: AdminMatchParticipant[]): SquadRow[] {
  const playerParticipants = sortPlayersForForm(players).filter((p) => p.role === 'PLAYER')

  const starting: SquadRow[] = []
  const bench: SquadRow[] = []
  const calledUp: SquadRow[] = []

  for (const p of playerParticipants) {
    const row: SquadRow = {
      personId: p.person_id,
      position: p.player_position ?? '',
      clubTeamId: p.club_team_id ?? '',
      squadRole: 'STARTING',
    }
    if (p.squad_role === 'CALLED_UP') {
      row.squadRole = 'CALLED_UP'
      calledUp.push(row)
    } else if (p.squad_role === 'BENCH' || p.is_starting === false) {
      row.squadRole = 'BENCH'
      bench.push(row)
    } else {
      row.squadRole = 'STARTING'
      starting.push(row)
    }
  }

  while (starting.length < STARTERS_COUNT) starting.push(emptyRow('STARTING'))
  while (bench.length < BENCH_BASE_COUNT) bench.push(emptyRow('BENCH'))
  while (calledUp.length < CALLED_UP_BASE_COUNT) calledUp.push(emptyRow('CALLED_UP'))

  return [...starting, ...bench, ...calledUp]
}

export default function MatchSquadForm({
  namePrefix,
  people: initialPeople,
  players,
  clubTeams: initialClubTeams,
  latestPlayerClubTeamByPersonId,
  latestPlayerPositionByPersonId,
  matchDate,
  matchId,
  cities,
  countries,
  federations,
}: {
  namePrefix: string
  people: AdminMatchParticipantPersonOption[]
  players: AdminMatchParticipant[]
  clubTeams: AdminTeamOption[]
  latestPlayerClubTeamByPersonId: Record<string, string | null>
  latestPlayerPositionByPersonId: Record<string, PlayerPosition | null>
  matchDate: string
  matchId: string
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
  federations: AdminFederation[]
}) {
  const [rows, setRows] = useState<SquadRow[]>(() => buildInitialRows(players))
  const [people, setPeople] = useState<AdminMatchParticipantPersonOption[]>(initialPeople)
  const [clubTeams, setClubTeams] = useState<AdminTeamOption[]>(initialClubTeams)
  const [cityOptions, setCityOptions] = useState<AdminPersonBirthCityOption[]>(cities)
  const [countryOptions, setCountryOptions] = useState<AdminCountryOption[]>(countries)
  const [isTouched, setIsTouched] = useState(false)
  const [dragOverSection, setDragOverSection] = useState<SquadRole | null>(null)

  const prioritizedClubTeams = useMemo(() => {
    const normalizedNoClubLabel = 'brak klubu'
    const noClub = clubTeams.find(
      (team) => team.label.trim().toLowerCase() === normalizedNoClubLabel
    )
    const rest = clubTeams
      .filter((team) => team.id !== noClub?.id)
      .sort((a, b) => a.label.localeCompare(b.label, 'pl'))

    return noClub ? [noClub, ...rest] : rest
  }, [clubTeams])

  useEffect(() => {
    setClubTeams(initialClubTeams)
  }, [initialClubTeams])

  useEffect(() => {
    setCityOptions(cities)
  }, [cities])

  useEffect(() => {
    setCountryOptions(countries)
  }, [countries])

  function updateRow(index: number, patch: Partial<SquadRow>) {
    setIsTouched(true)
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function addRow(squadRole: SquadRole) {
    if (squadRole === 'STARTING') return
    setIsTouched(true)
    setRows((prev) => {
      // Wstawiaj nowy pusty wiersz na końcu sekcji (przed pierwszym wierszem następnej sekcji)
      const insertAt = squadRole === 'BENCH'
        ? prev.findIndex((r) => r.squadRole === 'CALLED_UP')
        : -1
      const newRow = emptyRow(squadRole)
      if (insertAt === -1) {
        return [...prev, newRow]
      }
      return [...prev.slice(0, insertAt), newRow, ...prev.slice(insertAt)]
    })
  }

  function removeRow(squadRole: SquadRole) {
    if (squadRole === 'STARTING') return
    setIsTouched(true)
    setRows((prev) => {
      const sectionCount = prev.filter((r) => r.squadRole === squadRole).length
      const minCount = squadRole === 'BENCH' ? 0 : 0
      if (sectionCount <= minCount) return prev
      // Znajdź ostatni wiersz o tej roli i usuń
      let lastIdx = -1
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        if (prev[i].squadRole === squadRole) {
          lastIdx = i
          break
        }
      }
      if (lastIdx === -1) return prev
      return [...prev.slice(0, lastIdx), ...prev.slice(lastIdx + 1)]
    })
  }

  function sortByPosition() {
    setIsTouched(true)
    setRows((prev) => {
      const starting = prev.filter((r) => r.squadRole === 'STARTING')
      const bench = prev.filter((r) => r.squadRole === 'BENCH')
      const calledUp = prev.filter((r) => r.squadRole === 'CALLED_UP')

      const sortFn = (a: SquadRow, b: SquadRow) => compareByPlayerPosition(a, b, (row) => row.position)

      return [...starting.sort(sortFn), ...bench.sort(sortFn), ...calledUp.sort(sortFn)]
    })
  }

  function handleDragStart(event: React.DragEvent<Element>, rowIndex: number) {
    event.dataTransfer.setData('text/plain', String(rowIndex))
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOverSection(event: React.DragEvent, targetRole: SquadRole) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverSection !== targetRole) setDragOverSection(targetRole)
  }

  function handleDragLeaveSection() {
    setDragOverSection(null)
  }

  function handleDropSection(event: React.DragEvent, targetRole: SquadRole) {
    event.preventDefault()
    setDragOverSection(null)
    const sourceIndexRaw = event.dataTransfer.getData('text/plain')
    const sourceIndex = Number.parseInt(sourceIndexRaw, 10)
    if (Number.isNaN(sourceIndex)) return

    setRows((prev) => {
      const source = prev[sourceIndex]
      if (!source) return prev
      if (source.squadRole === targetRole) return prev

      // STARTING nie może mieć ≠ 11 → drop na STARTING i drop z STARTING niedozwolone
      if (source.squadRole === 'STARTING' || targetRole === 'STARTING') return prev

      setIsTouched(true)

      const movedRow: SquadRow = { ...source, squadRole: targetRole }
      const withoutSource = [...prev.slice(0, sourceIndex), ...prev.slice(sourceIndex + 1)]

      // 1) Preferuj wskoczenie na pierwsze PUSTE miejsce (personId === '') w sekcji targetRole
      //    — usuń ten pusty wiersz i wstaw movedRow w jego miejsce.
      const firstEmptyInTarget = withoutSource.findIndex(
        (r) => r.squadRole === targetRole && !r.personId
      )
      if (firstEmptyInTarget !== -1) {
        return [
          ...withoutSource.slice(0, firstEmptyInTarget),
          movedRow,
          ...withoutSource.slice(firstEmptyInTarget + 1),
        ]
      }

      // 2) Brak pustego slotu → wstaw na koniec sekcji targetRole
      let insertAt = withoutSource.length
      if (targetRole === 'BENCH') {
        // Wstawiaj przed pierwszym CALLED_UP
        const firstCalledUp = withoutSource.findIndex((r) => r.squadRole === 'CALLED_UP')
        if (firstCalledUp !== -1) insertAt = firstCalledUp
      }
      // Dla CALLED_UP wstawiaj na koniec
      return [...withoutSource.slice(0, insertAt), movedRow, ...withoutSource.slice(insertAt)]
    })
  }

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

  function handleClubOptionCreated(newClubTeam: AdminTeamOption) {
    setClubTeams((prev) => {
      if (prev.some((team) => team.id === newClubTeam.id)) return prev
      return [...prev, newClubTeam].sort((a, b) => a.label.localeCompare(b.label, 'pl'))
    })
  }

  function handleCityOptionCreated(option: { id: string; label?: string }) {
    setCityOptions((prev) => {
      if (prev.some((city) => city.id === option.id)) return prev
      return [
        ...prev,
        {
          id: option.id,
          city_name: option.label ?? '—',
          current_country_id: null,
          current_country_name: null,
          current_country_fifa_code: null,
        },
      ].sort((a, b) => a.city_name.localeCompare(b.city_name, 'pl'))
    })
  }

  function handleCountryOptionCreated(option: { id: string; label?: string }) {
    setCountryOptions((prev) => {
      if (prev.some((country) => country.id === option.id)) return prev
      return [...prev, { id: option.id, name: option.label ?? '—' }]
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    })
  }

  async function handlePersonSelect(personId: string, index: number, currentRow: SquadRow) {
    updateRow(index, { personId })

    if (!personId) return
    if (currentRow.position && currentRow.clubTeamId) return

    const knownPosition = latestPlayerPositionByPersonId[personId]
    const knownClub = latestPlayerClubTeamByPersonId[personId]

    if (knownPosition !== undefined || knownClub !== undefined) {
      updateRow(index, {
        personId,
        position: currentRow.position || knownPosition || '',
        clubTeamId: currentRow.clubTeamId || knownClub || '',
      })
      return
    }

    try {
      const params = new URLSearchParams({ matchDate, excludeMatchId: matchId })
      const res = await fetch(`/api/admin/people/${personId}/suggestions?${params}`)
      if (!res.ok) return
      const suggestions = await res.json() as { position: PlayerPosition | null; clubTeamId: string | null }
      setRows((prev) => prev.map((row, rowIndex) => {
        if (rowIndex !== index || row.personId !== personId) return row
        return {
          ...row,
          position: row.position || suggestions.position || '',
          clubTeamId: row.clubTeamId || suggestions.clubTeamId || '',
        }
      }))
    } catch {
      // Fail silently — auto-fill is best-effort
    }
  }

  function renderRow(row: SquadRow, index: number, placeholder: string, scopePrefix: string) {
    const usedPersonIds = rows
      .map((r, i) => (i === index ? '' : r.personId))
      .filter(Boolean)

    const isDraggable = row.squadRole !== 'STARTING'

    return (
      <tr
        key={`${scopePrefix}-${index}`}
        className="border-t border-neutral-800 first:border-t-0"
      >
        <td className="bg-neutral-950 px-1 py-2 text-center">
          {isDraggable ? (
            <button
              type="button"
              draggable
              onDragStart={(event) => handleDragStart(event, index)}
              className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 active:cursor-grabbing"
              aria-label={`Przeciągnij ${placeholder}`}
              title="Przeciągnij, aby przenieść między ławką a powołanymi"
            >
              ≡
            </button>
          ) : null}
        </td>
        <td className="bg-neutral-950 px-2 py-2">
          {/* Hidden input z squad_role — parallel array do person_id/position/club_team_id */}
          <input type="hidden" name={`${namePrefix}player_squad_role`} value={row.squadRole} />
          <PersonPickerField
            name={`${namePrefix}player_person_id`}
            value={row.personId}
            people={people}
            searchUrl="/api/admin/people/search"
            placeholder={placeholder}
            onChange={(personId) => { void handlePersonSelect(personId, index, row) }}
            onPeopleUpdate={handlePeopleUpdate}
            usedPersonIds={usedPersonIds}
            duplicateMessage="Ten piłkarz jest już przypisany do innego miejsca w składzie."
            addButtonTitle="Dodaj nowego piłkarza"
            cities={cities}
            countries={countries}
            federations={federations}
          />
        </td>
        <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
          <select
            name={`${namePrefix}player_position`}
            value={row.position}
            onChange={(event) => updateRow(index, { position: event.target.value as PlayerPosition | '' })}
            className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm ${row.position ? 'text-neutral-100' : 'text-neutral-500'}`}
          >
            <option value="" className="text-neutral-500">Brak danych</option>
            {PLAYER_POSITION_OPTIONS.map((pos) => (
              <option key={pos.value} value={pos.value}>{pos.label}</option>
            ))}
          </select>
        </td>
        <td className="border-l border-neutral-800 bg-neutral-950 px-2 py-2">
          <AdminSelectField
            name={`${namePrefix}player_club_team_id`}
            label="Klub"
            hideLabel
            required={false}
            emptyOptionLabel="Brak danych"
            selectedId={row.clubTeamId || null}
            options={prioritizedClubTeams}
            displayKey="label"
            placeholder="Brak danych"
            addButtonLabel="Dodaj klub"
            addDialogTitle="Dodaj nowy klub"
            emptyResultsMessage="Brak klubów"
            createAction={createClubInline}
            onSelectedIdChange={(clubTeamId) => updateRow(index, { clubTeamId })}
            onOptionCreated={handleClubOptionCreated}
            inlineForm={renderCreateClubInlineForm({
              scope: `${scopePrefix}_${index}`,
              cityOptions: cityOptions.map((city) => ({ id: city.id, label: formatCityWithFifa(city.city_name, city.current_country_fifa_code) })),
              countries: countryOptions,
              federations,
              onCityOptionCreated: handleCityOptionCreated,
              onCountryOptionCreated: handleCountryOptionCreated,
            })}
          />
        </td>
      </tr>
    )
  }

  // Podziel wiersze na sekcje wg squadRole zachowując oryginalny index (potrzebny do drag&drop)
  type IndexedRow = { row: SquadRow; index: number }
  const startingRows: IndexedRow[] = []
  const benchRows: IndexedRow[] = []
  const calledUpRows: IndexedRow[] = []
  rows.forEach((row, index) => {
    const bag = row.squadRole === 'STARTING' ? startingRows
      : row.squadRole === 'BENCH' ? benchRows
      : calledUpRows
    bag.push({ row, index })
  })

  const columnGroup = (
    <colgroup>
      <col className="w-9" />
      <col />
      <col className="w-[124px]" />
      <col className="w-[164px]" />
    </colgroup>
  )

  const tableHead = (
    <thead>
      <tr>
        <th className="border-b border-neutral-800 bg-neutral-900 px-1 py-2" aria-label="Uchwyt" />
        <th className="border-b border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Zawodnik
        </th>
        <th className="border-b border-l border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Pozycja
        </th>
        <th className="border-b border-l border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Klub
        </th>
      </tr>
    </thead>
  )

  return (
    <div className="space-y-6">
      <input type="hidden" name={`${namePrefix}squad_touched`} value={isTouched ? '1' : '0'} />

      {/* Pierwszy skład */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-neutral-400">
          Pierwszy skład
        </h3>
        <div className="overflow-visible rounded-lg border border-neutral-800">
          <table className="w-full table-fixed">
            {columnGroup}
            {tableHead}
            <tbody>
              {startingRows.map(({ row, index }, i) => renderRow(row, index, `Podstawowy ${i + 1}`, 'starter'))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ławka rezerwowych */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-neutral-400">
          Ławka rezerwowych
        </h3>
        <div
          className={`overflow-visible rounded-lg border ${dragOverSection === 'BENCH' ? 'border-sky-500' : 'border-neutral-800'}`}
          onDragOver={(e) => handleDragOverSection(e, 'BENCH')}
          onDragLeave={handleDragLeaveSection}
          onDrop={(e) => handleDropSection(e, 'BENCH')}
        >
          <table className="w-full table-fixed">
            {columnGroup}
            <tbody>
              {benchRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-xs text-neutral-500">
                    Brak rezerwowych. Przeciągnij tutaj z sekcji Powołani albo kliknij +.
                  </td>
                </tr>
              ) : (
                benchRows.map(({ row, index }, i) => renderRow(row, index, `Rezerwowy ${i + 1}`, 'bench'))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => addRow('BENCH')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800"
            aria-label="Dodaj rezerwowego"
            title="Dodaj rezerwowego"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => removeRow('BENCH')}
            disabled={benchRows.length === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Usuń ostatniego rezerwowego"
            title="Usuń ostatniego rezerwowego"
          >
            −
          </button>
        </div>
      </div>

      {/* Powołani */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-neutral-400">
          Powołani
        </h3>
        <div
          className={`overflow-visible rounded-lg border ${dragOverSection === 'CALLED_UP' ? 'border-sky-500' : 'border-neutral-800'}`}
          onDragOver={(e) => handleDragOverSection(e, 'CALLED_UP')}
          onDragLeave={handleDragLeaveSection}
          onDrop={(e) => handleDropSection(e, 'CALLED_UP')}
        >
          <table className="w-full table-fixed">
            {columnGroup}
            <tbody>
              {calledUpRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-xs text-neutral-500">
                    Brak powołanych. Przeciągnij tutaj z sekcji Rezerwowi albo kliknij +.
                  </td>
                </tr>
              ) : (
                calledUpRows.map(({ row, index }, i) => renderRow(row, index, `Powołany ${i + 1}`, 'called'))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => addRow('CALLED_UP')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800"
            aria-label="Dodaj powołanego"
            title="Dodaj powołanego"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => removeRow('CALLED_UP')}
            disabled={calledUpRows.length === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Usuń ostatniego powołanego"
            title="Usuń ostatniego powołanego"
          >
            −
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={sortByPosition}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-950 px-3 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
          title="Sortuj zawodników według pozycji (Bramkarz → Obrońca → Pomocnik → Napastnik)"
        >
          Sortuj wg pozycji
        </button>
      </div>
    </div>
  )
}
