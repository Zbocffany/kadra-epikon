'use client'

import { useMemo, useState, useTransition } from 'react'
import type { AdminCity } from '@/lib/db/clubs'
import type { AdminCountryOption } from '@/lib/db/cities'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'
import type { InlineCreateState } from '@/lib/types/admin'
import { getCityCurrentCountry } from '@/app/admin/cities/actions'

type Props = {
  cities: AdminCity[]
  countries: AdminCountryOption[]
  defaultCityId?: string | null
  createCityAction: (prevState: InlineCreateState, formData: FormData) => Promise<InlineCreateState>
}

export default function ClubCityCountryFields({
  cities,
  countries,
  defaultCityId,
  createCityAction,
}: Props) {
  const [selectedCityId, setSelectedCityId] = useState(defaultCityId ?? '')
  const [selectedCountryId, setSelectedCountryId] = useState<string>(() => {
    const city = cities.find((c) => c.id === defaultCityId)
    return city?.current_country_id ?? ''
  })
  const [selectedCountryName, setSelectedCountryName] = useState<string>(() => {
    const city = cities.find((c) => c.id === defaultCityId)
    return city?.current_country_name ?? ''
  })
  const [createdCityCountryById, setCreatedCityCountryById] = useState<
    Record<string, { id: string; name: string | null }>
  >({})
  const [isPending, startTransition] = useTransition()

  const cityCountryMap = useMemo(
    () =>
      new Map(
        cities.map((city) => [
          city.id,
          { id: city.current_country_id, name: city.current_country_name },
        ])
      ),
    [cities]
  )

  const countryNameById = useMemo(
    () => new Map(countries.map((c) => [c.id, c.name] as const)),
    [countries]
  )

  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId)
    if (!cityId) {
      setSelectedCountryId('')
      setSelectedCountryName('')
      return
    }

    // First check pre-loaded map (instant)
    const mapped = cityCountryMap.get(cityId) ?? createdCityCountryById[cityId]
    if (mapped?.id) {
      setSelectedCountryId(mapped.id)
      setSelectedCountryName(mapped.name ?? countryNameById.get(mapped.id) ?? '')
      return
    }

    // Fallback: fetch from DB via server action
    startTransition(async () => {
      const result = await getCityCurrentCountry(cityId)
      if (result) {
        setSelectedCountryId(result.id)
        setSelectedCountryName(result.name)
      } else {
        setSelectedCountryId('')
        setSelectedCountryName('')
      }
    })
  }

  const displayCountry =
    selectedCountryName ||
    (selectedCountryId ? countryNameById.get(selectedCountryId) : null) ||
    null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AdminSelectField
        name="club_city_id"
        label="Miasto"
        selectedId={selectedCityId}
        options={cities.map((c) => ({ id: c.id, label: c.city_name }))}
        displayKey="label"
        addButtonLabel="+ Dodaj miasto"
        addDialogTitle="Nowe miasto"
        emptyResultsMessage="Brak wyników — możesz dodać nowe miasto poniżej."
        createAction={createCityAction}
        onSelectedIdChange={handleCityChange}
        onOptionCreated={(option, context) => {
          const createdCountryId =
            (context?.formData.get('country_id') as string | null)?.trim() ?? ''
          if (!createdCountryId) return

          const createdCountryName = countryNameById.get(createdCountryId) ?? null
          setCreatedCityCountryById((prev) => ({
            ...prev,
            [option.id]: { id: createdCountryId, name: createdCountryName },
          }))
          setSelectedCountryId(createdCountryId)
          setSelectedCountryName(createdCountryName ?? '')
        }}
        inlineForm={(
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_club_city_name" className="text-xs text-neutral-400">
                Nazwa miasta
              </label>
              <input
                id="inline_club_city_name"
                name="city_name"
                type="text"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_club_city_country" className="text-xs text-neutral-400">
                Kraj
              </label>
              <select
                id="inline_club_city_country"
                name="country_id"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— wybierz —</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_club_city_voivodeship" className="text-xs text-neutral-400">
                Województwo (tylko Polska)
              </label>
              <select
                id="inline_club_city_voivodeship"
                name="voivodeship"
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— brak —</option>
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
        <p className="text-sm font-medium text-neutral-300">Kraj</p>
        <p className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-400 min-h-[2.5rem] flex items-center">
          {isPending ? '…' : (displayCountry ?? '— uzupełnia się z miasta —')}
        </p>
      </div>
    </div>
  )
}
