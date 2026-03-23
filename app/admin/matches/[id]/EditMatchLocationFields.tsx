'use client'

import { useEffect, useState } from 'react'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { createCityInline } from '@/app/admin/cities/actions'
import { createStadiumInline } from '@/app/admin/stadiums/actions'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'
import type { AdminCityOption, AdminStadiumOption } from '@/lib/db/matches'
import { renderCreateCityInlineForm, renderCreateStadiumInlineForm } from '../inlineCreateForms'

type EditMatchLocationFieldsProps = {
  initialStadiumId: string | null
  initialCityId: string | null
  stadiums: AdminStadiumOption[]
  cities: AdminCityOption[]
  countries: AdminCountryOption[]
  federations: AdminFederation[]
}

export default function EditMatchLocationFields({
  initialStadiumId,
  initialCityId,
  stadiums,
  cities,
  countries,
  federations,
}: EditMatchLocationFieldsProps) {
  const [stadiumOptions, setStadiumOptions] = useState<AdminStadiumOption[]>(stadiums)
  const [cityOptions, setCityOptions] = useState<AdminCityOption[]>(cities)
  const [countryOptions, setCountryOptions] = useState<AdminCountryOption[]>(countries)
  const [selectedStadiumId, setSelectedStadiumId] = useState(initialStadiumId ?? '')
  const [selectedCityId, setSelectedCityId] = useState(initialCityId ?? '')
  const [pendingStadiumCityId, setPendingStadiumCityId] = useState('')

  useEffect(() => {
    setStadiumOptions(stadiums)
  }, [stadiums])

  useEffect(() => {
    setCityOptions(cities)
  }, [cities])

  useEffect(() => {
    setCountryOptions(countries)
  }, [countries])

  function handleCountryOptionCreated(option: { id: string; label?: string }) {
    setCountryOptions((prev) => {
      if (prev.some((country) => country.id === option.id)) return prev
      return [...prev, { id: option.id, name: option.label ?? '—' }]
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    })
  }

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
            placeholder="Wpisz, aby filtrować stadiony..."
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
            inlineForm={renderCreateStadiumInlineForm({
              scope: 'inline_edit',
              cityOptions: cityOptions.map((city) => ({ id: city.id, label: city.name })),
              countries: countryOptions,
              federations,
              onSelectedCityIdChange: setPendingStadiumCityId,
              onCityOptionCreated: (option) => {
                setCityOptions((prev) => {
                  if (prev.some((city) => city.id === option.id)) return prev
                  return [...prev, { id: option.id, name: option.label ?? '—' }]
                    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
                })
                setPendingStadiumCityId(option.id)
              },
              onCountryOptionCreated: handleCountryOptionCreated,
            })}
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
            placeholder="Wpisz, aby filtrować miasta..."
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
            inlineForm={renderCreateCityInlineForm({
              scope: 'inline_edit_match',
              countries: countryOptions,
              federations,
              onCountryOptionCreated: handleCountryOptionCreated,
            })}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Miasto meczu uzupełnia się automatycznie na podstawie wybranego stadionu.
          </p>
        </div>
      </div>
    </>
  )
}