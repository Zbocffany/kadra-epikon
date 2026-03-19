'use client'

import { useMemo, useState } from 'react'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import AdminSelectField from '@/components/admin/AdminSelectField'
import type { InlineCreateState } from '@/lib/types/admin'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'

type PersonBirthplaceFieldsProps = {
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
  createCityAction: (prevState: InlineCreateState, formData: FormData) => Promise<InlineCreateState>
  defaultBirthDate?: string | null
  defaultCityId?: string | null
  defaultCountryId?: string | null
}

export default function PersonBirthplaceFields({
  cities,
  countries,
  createCityAction,
  defaultBirthDate,
  defaultCityId,
  defaultCountryId,
}: PersonBirthplaceFieldsProps) {
  const initialCountryId =
    (defaultCityId
      ? (cities.find((city) => city.id === defaultCityId)?.current_country_id ?? null)
      : defaultCountryId) ?? ''

  const [selectedCityId, setSelectedCityId] = useState(defaultCityId ?? '')
  const [selectedCountryId, setSelectedCountryId] = useState(initialCountryId)

  const cityCountryMap = useMemo(
    () => new Map(cities.map((city) => [city.id, city.current_country_id] as const)),
    [cities]
  )

  const cityCountryNameMap = useMemo(
    () => new Map(cities.map((city) => [city.id, city.current_country_name] as const)),
    [cities]
  )

  const handleBirthCityChange = (cityId: string) => {
    setSelectedCityId(cityId)

    if (!cityId) return

    const mappedCountryId = cityCountryMap.get(cityId) ?? ''
    setSelectedCountryId(mappedCountryId)
  }

  const derivedCountryName = selectedCityId ? cityCountryNameMap.get(selectedCityId) ?? null : null

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="birth_date" className="text-sm font-medium text-neutral-300">
          Data urodzenia
        </label>
        <input
          id="birth_date"
          name="birth_date"
          type="date"
          defaultValue={defaultBirthDate ?? ''}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        />
      </div>

      <AdminSelectField
        name="birth_city_id"
        label="Miasto urodzenia"
        selectedId={selectedCityId}
        options={cities.map((city) => ({ id: city.id, label: city.city_name }))}
        displayKey="label"
        placeholder="Wpisz, aby filtrowac miasta..."
        addButtonLabel="+ Dodaj miasto"
        addDialogTitle="Nowe miasto"
        emptyResultsMessage="Brak wyników - możesz dodać nowe miasto poniżej."
        createAction={createCityAction}
        onSelectedIdChange={handleBirthCityChange}
        inlineForm={(
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_birth_city_name" className="text-xs text-neutral-400">
                Nazwa miasta
              </label>
              <input
                id="inline_birth_city_name"
                name="city_name"
                type="text"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_birth_city_country" className="text-xs text-neutral-400">
                Kraj
              </label>
              <select
                id="inline_birth_city_country"
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
              <label htmlFor="inline_birth_city_voivodeship" className="text-xs text-neutral-400">
                Województwo (tylko Polska)
              </label>
              <select
                id="inline_birth_city_voivodeship"
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="birth_country_id" className="text-sm font-medium text-neutral-300">
          Kraj urodzenia
        </label>
        <select
          id="birth_country_id"
          name="birth_country_id"
          value={selectedCountryId}
          onChange={(event) => setSelectedCountryId(event.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">- brak -</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </select>

        {!selectedCityId && (
          <p className="text-xs text-neutral-500">możesz ustawić sam kraj, jesli miasto urodzenia jest nieznane.</p>
        )}
        {selectedCityId && (
          <p className="text-xs text-neutral-500">
            Kraj uzupelnia sie automatycznie z miasta
            {derivedCountryName ? ` (${derivedCountryName})` : ''}.
          </p>
        )}
      </div>
    </div>
  )
}


