'use client'

import { useEffect, useState } from 'react'
import { createClubInline } from '@/app/admin/clubs/actions'
import { createCityInline } from '@/app/admin/cities/actions'
import { createStadiumInline } from '@/app/admin/stadiums/actions'
import AdminSelectField from '@/components/admin/AdminSelectField'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import type { AdminCountryOption } from '@/lib/db/cities'
import {
  renderCreateCityInlineForm,
  renderCreateClubInlineForm,
  renderCreateStadiumInlineForm,
} from './inlineCreateForms'
import type {
  AdminCityOption,
  AdminCompetitionOption,
  AdminStadiumOption,
  AdminTeamOption,
} from '@/lib/db/matches'

type MatchCreateModalProps = {
  competitions: AdminCompetitionOption[]
  teams: AdminTeamOption[]
  cities: AdminCityOption[]
  countries: AdminCountryOption[]
  stadiums: AdminStadiumOption[]
  createAction: (formData: FormData) => Promise<void>
}

export default function MatchCreateModal({
  competitions,
  teams,
  cities,
  countries,
  stadiums,
  createAction,
}: MatchCreateModalProps) {
  const [stadiumOptions, setStadiumOptions] = useState<AdminStadiumOption[]>(stadiums)
  const [cityOptions, setCityOptions] = useState<AdminCityOption[]>(cities)
  const [selectedStadiumId, setSelectedStadiumId] = useState('')
  const [selectedCityId, setSelectedCityId] = useState('')
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [pendingStadiumCityId, setPendingStadiumCityId] = useState('')

  const handleCityOptionCreated = (option: { id: string; label?: string }) => {
    setCityOptions((prev) => {
      if (prev.some((city) => city.id === option.id)) return prev
      return [...prev, { id: option.id, name: option.label ?? '—' }]
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    })
  }

  useEffect(() => {
    setStadiumOptions(stadiums)
  }, [stadiums])

  useEffect(() => {
    setCityOptions(cities)
  }, [cities])

  const handleStadiumChange = (stadiumId: string) => {
    setSelectedStadiumId(stadiumId)

    if (!stadiumId) {
      return
    }

    const stadium = stadiumOptions.find((item) => item.id === stadiumId)
    if (stadium?.stadium_city_id) {
      setSelectedCityId(stadium.stadium_city_id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-100">Dodaj mecz</h2>
        </div>

        <form action={createAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="match_date" className="text-sm font-medium text-neutral-300">
                Data meczu <span className="text-red-400">*</span>
              </label>
              <input
                id="match_date"
                name="match_date"
                type="date"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="match_time" className="text-sm font-medium text-neutral-300">
                Godzina
              </label>
              <input
                id="match_time"
                name="match_time"
                type="time"
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="sm:col-span-2">
              <AdminSelectField
                name="competition_id"
                label="Rozgrywki"
                required
                options={competitions.map((competition) => ({ id: competition.id, label: competition.name }))}
                displayKey="label"
                placeholder="Wpisz, aby filtrować rozgrywki..."
                emptyResultsMessage="Brak wyników."
                inlineForm={null}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <AdminSelectField
                name="match_stadium_id"
                label="Stadion"
                selectedId={selectedStadiumId}
                options={stadiumOptions.map((stadium) => ({ id: stadium.id, label: stadium.label }))}
                displayKey="label"
                placeholder="Wpisz, aby filtrować stadiony..."
                addButtonLabel="+ Dodaj stadion"
                addDialogTitle="Nowy stadion"
                emptyResultsMessage="Brak wyników - możesz dodać nowy stadion poniżej."
                createAction={createStadiumInline}
                onSelectedIdChange={handleStadiumChange}
                onOptionCreated={(option) => {
                  const stadiumCityId = pendingStadiumCityId || null
                  setStadiumOptions((prev) => {
                    if (prev.some((stadium) => stadium.id === option.id)) return prev
                    return [
                      ...prev,
                      {
                        id: option.id,
                        label: option.label ?? '—',
                        stadium_city_id: stadiumCityId,
                      },
                    ].sort((a, b) => a.label.localeCompare(b.label, 'pl'))
                  })

                  if (stadiumCityId) {
                    setSelectedCityId(stadiumCityId)
                  }

                  setPendingStadiumCityId('')
                }}
                inlineForm={renderCreateStadiumInlineForm({
                  scope: 'inline_match',
                  cityOptions: cityOptions.map((city) => ({ id: city.id, label: city.name })),
                  countries,
                  onSelectedCityIdChange: setPendingStadiumCityId,
                  onCityOptionCreated: (option) => {
                    setCityOptions((prev) => {
                      if (prev.some((city) => city.id === option.id)) return prev
                      return [...prev, { id: option.id, name: option.label ?? '—' }]
                        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
                    })
                    setPendingStadiumCityId(option.id)
                  },
                })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <AdminSelectField
                name="match_city_id"
                label="Miasto meczu"
                selectedId={selectedCityId}
                options={cityOptions.map((city) => ({ id: city.id, label: city.name }))}
                displayKey="label"
                placeholder="Wpisz, aby filtrować miasta..."
                addButtonLabel="+ Dodaj miasto"
                addDialogTitle="Nowe miasto"
                emptyResultsMessage="Brak wyników - możesz dodać nowe miasto poniżej."
                createAction={createCityInline}
                onSelectedIdChange={setSelectedCityId}
                onOptionCreated={(option) => {
                  setCityOptions((prev) => {
                    if (prev.some((city) => city.id === option.id)) return prev
                    return [...prev, { id: option.id, name: option.label ?? '—' }]
                      .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
                  })
                }}
                inlineForm={renderCreateCityInlineForm({ scope: 'inline_match', countries })}
              />
              <p className="text-xs text-neutral-500">
                Wybór stadionu automatycznie ustawia miasto meczu.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <AdminSelectField
                name="home_team_id"
                label="Gospodarz"
                required
                selectedId={homeTeamId}
                options={teams.map((team) => ({ id: team.id, label: team.label }))}
                displayKey="label"
                placeholder="Wpisz, aby filtrować gospodarza..."
                addButtonLabel="+ Dodaj klub"
                addDialogTitle="Nowy klub"
                emptyResultsMessage="Brak wyników - możesz dodać nowy klub poniżej."
                createAction={createClubInline}
                onSelectedIdChange={(teamId) => {
                  setHomeTeamId(teamId)
                  if (teamId && teamId === awayTeamId) {
                    setAwayTeamId('')
                  }
                }}
                inlineForm={renderCreateClubInlineForm({
                  scope: 'inline_match_home',
                  cityOptions: cityOptions.map((city) => ({ id: city.id, label: city.name })),
                  countries,
                  onCityOptionCreated: handleCityOptionCreated,
                })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <AdminSelectField
                name="away_team_id"
                label="Gość"
                required
                selectedId={awayTeamId}
                options={teams.map((team) => ({ id: team.id, label: team.label }))}
                displayKey="label"
                placeholder="Wpisz, aby filtrować gościa..."
                addButtonLabel="+ Dodaj klub"
                addDialogTitle="Nowy klub"
                emptyResultsMessage="Brak wyników - możesz dodać nowy klub poniżej."
                createAction={createClubInline}
                onSelectedIdChange={(teamId) => {
                  setAwayTeamId(teamId)
                  if (teamId && teamId === homeTeamId) {
                    setHomeTeamId('')
                  }
                }}
                inlineForm={renderCreateClubInlineForm({
                  scope: 'inline_match_away',
                  cityOptions: cityOptions.map((city) => ({ id: city.id, label: city.name })),
                  countries,
                  onCityOptionCreated: handleCityOptionCreated,
                })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
            >
              Dodaj mecz
            </button>
            <AdminCancelLink
              href="/admin/matches"
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
            >
              Anuluj
            </AdminCancelLink>
          </div>
        </form>
      </div>
    </div>
  )
}
