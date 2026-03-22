'use client'

import { useEffect, useState } from 'react'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { createCityInline } from '@/app/admin/cities/actions'
import { createStadiumInline } from '@/app/admin/stadiums/actions'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminCityOption, AdminStadiumOption } from '@/lib/db/matches'

type EditMatchLocationFieldsProps = {
  initialStadiumId: string | null
  initialCityId: string | null
  stadiums: AdminStadiumOption[]
  cities: AdminCityOption[]
  countries: AdminCountryOption[]
}

export default function EditMatchLocationFields({
  initialStadiumId,
  initialCityId,
  stadiums,
  cities,
  countries,
}: EditMatchLocationFieldsProps) {
  const [stadiumOptions, setStadiumOptions] = useState<AdminStadiumOption[]>(stadiums)
  const [cityOptions, setCityOptions] = useState<AdminCityOption[]>(cities)
  const [selectedStadiumId, setSelectedStadiumId] = useState(initialStadiumId ?? '')
  const [selectedCityId, setSelectedCityId] = useState(initialCityId ?? '')
  const [pendingStadiumCityId, setPendingStadiumCityId] = useState('')

  useEffect(() => {
    setStadiumOptions(stadiums)
  }, [stadiums])

  useEffect(() => {
    setCityOptions(cities)
  }, [cities])

  function handleStadiumChange(stadiumId: string) {
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
    <>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Stadion</p>
        <div className="mt-2">
          <AdminSelectField
            name="match_stadium_id"
            label="Stadion"
            required
            selectedId={selectedStadiumId}
            options={stadiumOptions.map((stadium) => ({ id: stadium.id, label: stadium.label }))}
            displayKey="label"
            placeholder="Wpisz, aby filtrowac stadiony..."
            addButtonLabel="Dodaj stadion"
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
            inlineForm={(
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_edit_stadium_name" className="text-xs text-neutral-400">
                    Nazwa stadionu
                  </label>
                  <input
                    id="inline_edit_stadium_name"
                    name="name"
                    type="text"
                    required
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>

                <AdminSelectField
                  name="stadium_city_id"
                  label="Miasto"
                  required
                  options={cityOptions.map((city) => ({ id: city.id, label: city.name }))}
                  displayKey="label"
                  placeholder="Wpisz, aby filtrowac miasta..."
                  addButtonLabel="Dodaj miasto"
                  addDialogTitle="Nowe miasto"
                  emptyResultsMessage="Brak wyników - możesz dodać nowe miasto poniżej."
                  createAction={createCityInline}
                  onSelectedIdChange={setPendingStadiumCityId}
                  onOptionCreated={(option) => {
                    setCityOptions((prev) => {
                      if (prev.some((city) => city.id === option.id)) return prev
                      return [...prev, { id: option.id, name: option.label ?? '—' }]
                        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
                    })
                    setPendingStadiumCityId(option.id)
                  }}
                  inlineForm={(
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="inline_edit_stadium_city_name" className="text-xs text-neutral-400">
                          Nazwa miasta
                        </label>
                        <input
                          id="inline_edit_stadium_city_name"
                          name="city_name"
                          type="text"
                          required
                          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="inline_edit_stadium_city_country" className="text-xs text-neutral-400">
                          Kraj
                        </label>
                        <select
                          id="inline_edit_stadium_city_country"
                          name="country_id"
                          required
                          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        >
                          <option value="">- wybierz -</option>
                          {countries.map((country) => (
                            <option key={country.id} value={country.id}>
                              {country.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="inline_edit_stadium_city_voivodeship" className="text-xs text-neutral-400">
                          Wojewodztwo (tylko Polska)
                        </label>
                        <select
                          id="inline_edit_stadium_city_voivodeship"
                          name="voivodeship"
                          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        >
                          <option value="">- brak -</option>
                          {VOIVODESHIP_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                />
              </div>
            )}
          />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Miasto meczu</p>
        <div className="mt-2">
          <AdminSelectField
            name="match_city_id"
            label="Miasto meczu"
            hideLabel
            selectedId={selectedCityId}
            options={cityOptions.map((city) => ({ id: city.id, label: city.name }))}
            displayKey="label"
            placeholder="Wpisz, aby filtrowac miasta..."
            addButtonLabel="Dodaj miasto"
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
            inlineForm={(
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_edit_match_city_name" className="text-xs text-neutral-400">
                    Nazwa miasta
                  </label>
                  <input
                    id="inline_edit_match_city_name"
                    name="city_name"
                    type="text"
                    required
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_edit_match_city_country" className="text-xs text-neutral-400">
                    Kraj
                  </label>
                  <select
                    id="inline_edit_match_city_country"
                    name="country_id"
                    required
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="">- wybierz -</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_edit_match_city_voivodeship" className="text-xs text-neutral-400">
                    Wojewodztwo (tylko Polska)
                  </label>
                  <select
                    id="inline_edit_match_city_voivodeship"
                    name="voivodeship"
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="">- brak -</option>
                    {VOIVODESHIP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Miasto meczu uzupelnia sie automatycznie na podstawie wybranego stadionu.
          </p>
        </div>
      </div>
    </>
  )
}