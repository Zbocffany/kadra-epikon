'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AdminCountryOption } from '@/lib/db/cities'
import AdminSelectField from '@/components/admin/AdminSelectField'
import type { InlineCreateState } from '@/lib/types/admin'

const BIRTH_COUNTRY_CHANGED_EVENT = 'person:birth-country-changed'
const COUNTRY_CREATED_EVENT = 'person:country-created'

type PersonRepresentedCountriesFieldsProps = {
  countries: AdminCountryOption[]
  createCountryAction: (prevState: InlineCreateState, formData: FormData) => Promise<InlineCreateState>
  defaultCountryIds?: string[]
  defaultBirthCountryId?: string | null
  syncScope?: string
}

export default function PersonRepresentedCountriesFields({
  countries,
  createCountryAction,
  defaultCountryIds = [],
  defaultBirthCountryId = null,
  syncScope,
}: PersonRepresentedCountriesFieldsProps) {
  const [countryOptions, setCountryOptions] = useState<AdminCountryOption[]>(countries)
  const [rows, setRows] = useState<string[]>(
    defaultCountryIds.length
      ? defaultCountryIds
      : [defaultBirthCountryId ?? '']
  )
  const [isManualSelection, setIsManualSelection] = useState(defaultCountryIds.length > 0)

  useEffect(() => {
    setCountryOptions(countries)
  }, [countries])

  useEffect(() => {
    if (!syncScope || typeof window === 'undefined') return

    function handleBirthCountryChanged(event: Event) {
      const customEvent = event as CustomEvent<{ scope?: string; countryId?: string }>
      if (customEvent.detail?.scope !== syncScope) return
      if (isManualSelection) return

      const syncedCountryId = customEvent.detail?.countryId ?? ''
      setRows((prev) => {
        const next = prev.length ? [...prev] : ['']
        next[0] = syncedCountryId
        return next
      })
    }

    function handleCountryCreated(event: Event) {
      const customEvent = event as CustomEvent<{
        scope?: string
        country?: { id: string; name?: string | null }
      }>
      if (customEvent.detail?.scope !== syncScope) return

      const createdCountry = customEvent.detail?.country
      if (!createdCountry?.id) return

      setCountryOptions((prev) => {
        if (prev.some((country) => country.id === createdCountry.id)) return prev
        return [...prev, { id: createdCountry.id, name: createdCountry.name ?? '—' }]
          .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
      })
    }

    window.addEventListener(BIRTH_COUNTRY_CHANGED_EVENT, handleBirthCountryChanged)
    window.addEventListener(COUNTRY_CREATED_EVENT, handleCountryCreated)

    return () => {
      window.removeEventListener(BIRTH_COUNTRY_CHANGED_EVENT, handleBirthCountryChanged)
      window.removeEventListener(COUNTRY_CREATED_EVENT, handleCountryCreated)
    }
  }, [syncScope, isManualSelection])

  const usedCountryIds = useMemo(() => rows.filter(Boolean), [rows])

  function updateRow(index: number, countryId: string) {
    setRows((prev) => {
      const next = [...prev]
      next[index] = countryId
      return next
    })
  }

  function addRow() {
    setIsManualSelection(true)
    setRows((prev) => [...prev, ''])
  }

  function removeLastRow() {
    setIsManualSelection(true)
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.slice(0, -1)
    })
  }

  function handleCountryOptionCreated(option: { id: string; label?: string }) {
    setCountryOptions((prev) => {
      if (prev.some((country) => country.id === option.id)) return prev
      return [...prev, { id: option.id, name: option.label ?? '—' }].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">Reprezentowane kraje</p>

      {rows.map((value, index) => (
        <AdminSelectField
          key={`represented-country-${index}`}
          name="represented_country_ids"
          label={`Kraj ${index + 1}`}
          selectedId={value}
          emptyOptionLabel="— brak —"
          options={countryOptions.map((country) => ({ id: country.id, label: country.name }))}
          displayKey="label"
          placeholder="Wpisz, aby filtrowac kraje..."
          addButtonLabel="+ Dodaj kraj"
          addDialogTitle="Nowy kraj"
          emptyResultsMessage="Brak wyników - możesz dodać nowy kraj poniżej."
          createAction={createCountryAction}
          onSelectedIdChange={(countryId) => {
            setIsManualSelection(true)
            if (countryId && usedCountryIds.includes(countryId) && countryId !== value) {
              return
            }
            updateRow(index, countryId)
          }}
          onOptionCreated={handleCountryOptionCreated}
          inlineForm={(
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`inline_represented_country_name_${index}`} className="text-xs text-neutral-400">
                  Nazwa kraju
                </label>
                <input
                  id={`inline_represented_country_name_${index}`}
                  name="name"
                  type="text"
                  required
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`inline_represented_country_fifa_${index}`} className="text-xs text-neutral-400">
                  Kod FIFA
                </label>
                <input
                  id={`inline_represented_country_fifa_${index}`}
                  name="fifa_code"
                  type="text"
                  maxLength={3}
                  className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                />
              </div>
            </div>
          )}
        />
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800"
          aria-label="Dodaj kraj"
          title="Dodaj kraj"
        >
          +
        </button>
        <button
          type="button"
          onClick={removeLastRow}
          disabled={rows.length <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Usuń ostatni kraj"
          title="Usuń ostatni kraj"
        >
          −
        </button>
      </div>

      <p className="text-xs text-neutral-500">
        Jeśli nie wybierzesz żadnego kraju, domyślnie używany będzie kraj urodzenia.
      </p>
    </div>
  )
}
