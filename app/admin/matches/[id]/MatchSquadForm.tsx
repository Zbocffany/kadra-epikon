'use client'

import { useState, useEffect, useMemo } from 'react'
import type {
  AdminMatchParticipant,
  AdminMatchParticipantPersonOption,
  AdminTeamOption,
  PlayerPosition,
} from '@/lib/db/matches'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { createClubInline } from '@/app/admin/clubs/actions'
import PersonPickerField, { MATCH_PERSON_CREATED_EVENT } from './PersonPickerField'
import { compareByPlayerPosition } from '../playerPositionSort'
import { renderCreateClubInlineForm } from '../inlineCreateForms'

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
  clubTeamId: string
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
      clubTeamId: participant.club_team_id ?? '',
    }))

  while (rows.length < BASE_ROWS) {
    rows.push({ personId: '', position: '', clubTeamId: '' })
  }

  return rows
}

export default function MatchSquadForm({
  namePrefix,
  people: initialPeople,
  players,
  clubTeams: initialClubTeams,
  latestPlayerClubTeamByPersonId,
  cities,
  countries,
  federations,
}: {
  namePrefix: string
  people: AdminMatchParticipantPersonOption[]
  players: AdminMatchParticipant[]
  clubTeams: AdminTeamOption[]
  latestPlayerClubTeamByPersonId: Record<string, string | null>
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

  function addBenchRow() {
    setIsTouched(true)
    setRows((prev) => [...prev, { personId: '', position: '', clubTeamId: '' }])
  }

  function removeBenchRow() {
    setIsTouched(true)
    setRows((prev) => {
      if (prev.length <= STARTERS_COUNT) return prev
      return prev.slice(0, -1)
    })
  }

  function sortByPosition() {
    setIsTouched(true)
    setRows((prev) => {
      const starters = prev.slice(0, STARTERS_COUNT)
      const bench = prev.slice(STARTERS_COUNT)

      const sortFn = (a: SquadRow, b: SquadRow) => compareByPlayerPosition(a, b, (row) => row.position)

      return [...starters.sort(sortFn), ...bench.sort(sortFn)]
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

  return (
    <div className="space-y-4">
      <input type="hidden" name={`${namePrefix}squad_touched`} value={isTouched ? '1' : '0'} />

      {/* Skład podstawowy */}
      <div className="overflow-visible rounded-lg border border-neutral-800">
        <table className="w-full table-fixed">
          <colgroup>
            <col />
            <col className="w-[150px]" />
            <col className="w-[190px]" />
          </colgroup>
          <thead>
            <tr>
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
          <tbody>
            {rows.slice(0, STARTERS_COUNT).map((row, index) => (
              <tr key={`starter-${index}`} className="border-t border-neutral-800 first:border-t-0">
                <td className="bg-neutral-950 px-2 py-2">
                  <PersonPickerField
                    name={`${namePrefix}player_person_id`}
                    value={row.personId}
                    people={people}
                    placeholder={`Podstawowy ${index + 1}`}
                    onChange={(personId) => {
                      const suggestedClubTeamId = latestPlayerClubTeamByPersonId[personId] ?? null
                      updateRow(index, {
                        personId,
                        clubTeamId: row.clubTeamId || suggestedClubTeamId || '',
                      })
                    }}
                    onPeopleUpdate={handlePeopleUpdate}
                    usedPersonIds={rows.map((r, i) => i === index ? '' : r.personId).filter(Boolean)}
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
                      scope: `starter_${index}`,
                      cityOptions: cityOptions.map((city) => ({ id: city.id, label: city.city_name })),
                      countries: countryOptions,
                      federations,
                      onCityOptionCreated: handleCityOptionCreated,
                      onCountryOptionCreated: handleCountryOptionCreated,
                    })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rezerwa */}
      {rows.length > STARTERS_COUNT && (
        <div className="overflow-visible rounded-lg border border-neutral-800">
          <table className="w-full table-fixed">
            <colgroup>
              <col />
              <col className="w-[150px]" />
              <col className="w-[190px]" />
            </colgroup>
            <tbody>
              {rows.slice(STARTERS_COUNT).map((row, index) => (
                <tr key={`bench-${index}`} className="border-t border-neutral-800 first:border-t-0">
                  <td className="bg-neutral-950 px-2 py-2">
                    <PersonPickerField
                      name={`${namePrefix}player_person_id`}
                      value={row.personId}
                      people={people}
                      placeholder={`Rezerwowy ${index + 1}`}
                      onChange={(personId) => {
                        const suggestedClubTeamId = latestPlayerClubTeamByPersonId[personId] ?? null
                        updateRow(STARTERS_COUNT + index, {
                          personId,
                          clubTeamId: row.clubTeamId || suggestedClubTeamId || '',
                        })
                      }}
                      onPeopleUpdate={handlePeopleUpdate}
                      usedPersonIds={rows.filter((_, i) => i !== STARTERS_COUNT + index).map(r => r.personId).filter(Boolean)}
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
                      onChange={(event) => updateRow(STARTERS_COUNT + index, { position: event.target.value as PlayerPosition | '' })}
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
                      onSelectedIdChange={(clubTeamId) => updateRow(STARTERS_COUNT + index, { clubTeamId })}
                      onOptionCreated={handleClubOptionCreated}
                      inlineForm={renderCreateClubInlineForm({
                        scope: `bench_${index}`,
                        cityOptions: cityOptions.map((city) => ({ id: city.id, label: city.city_name })),
                        countries: countryOptions,
                        federations,
                        onCityOptionCreated: handleCityOptionCreated,
                        onCountryOptionCreated: handleCountryOptionCreated,
                      })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
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
