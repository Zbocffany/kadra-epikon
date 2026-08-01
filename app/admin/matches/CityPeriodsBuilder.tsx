'use client'

import { useId, useMemo, useState } from 'react'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { createCountryInline } from '@/app/admin/countries/actions'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'
import {
  validateCityCountryPeriods,
  type CityPeriodForValidation,
} from '@/lib/db/cityPeriodsValidation'

type InlineCreatedOption = {
  id: string
  label?: string
}

type DraftPeriod = {
  tempId: string
  country_id: string
  valid_from: string
  valid_to: string
  description: string
}

type CityPeriodsBuilderProps = {
  scope: string
  countries: AdminCountryOption[]
  federations: AdminFederation[]
  onCountryOptionCreated?: (option: InlineCreatedOption) => void
}

let tempPeriodCounter = 0
function nextTempId(prefix: string): string {
  tempPeriodCounter += 1
  return `${prefix}-${tempPeriodCounter}-${Date.now().toString(36)}`
}

function buildCountryInlineForm(scope: string, federations: AdminFederation[]) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${scope}_country_name`} className="text-xs text-neutral-400">
          Nazwa kraju
        </label>
        <input
          id={`${scope}_country_name`}
          name="name"
          type="text"
          required
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${scope}_country_fifa`} className="text-xs text-neutral-400">
          Kod FIFA
        </label>
        <input
          id={`${scope}_country_fifa`}
          name="fifa_code"
          type="text"
          maxLength={3}
          className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${scope}_country_federation`} className="text-xs text-neutral-400">
          Federacja
        </label>
        <select
          id={`${scope}_country_federation`}
          name="federation_id"
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">— brak —</option>
          {federations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.short_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/**
 * Builder okresów przynależności miasta do kraju (tbl_City_Country_Periods)
 * używany w inline-formularzach tworzenia miasta.
 *
 * Stan trzymany lokalnie; serializowany do ukrytego pola `periods_json`,
 * które parsuje server action `createCityInline`. AdminSelectField dla
 * kraju per-okres używa unikatowych nazw (`_period_country_<tempId>`),
 * które serwer ignoruje — kanoniczne dane idą przez `periods_json`.
 *
 * Walidacja kliencka (`validateCityCountryPeriods`) jest ostrzegawcza
 * (nie blokuje zapisu) — tak samo jak na `/admin/cities/[id]`. Twarde
 * naruszenia (nakładki, dwa otwarte okresy, brak daty) zablokuje baza
 * przez constraints z migracji 038.
 */
export default function CityPeriodsBuilder({
  scope,
  countries,
  federations,
  onCountryOptionCreated,
}: CityPeriodsBuilderProps) {
  const reactId = useId()
  const [periods, setPeriods] = useState<DraftPeriod[]>([])
  const [countryOptions, setCountryOptions] = useState<AdminCountryOption[]>(countries)

  const countryOptionsForSelect = useMemo(
    () => countryOptions.map((c) => ({ id: c.id, label: c.name })),
    [countryOptions]
  )

  const periodsForValidation: CityPeriodForValidation[] = useMemo(() => {
    return periods
      .filter((p) => p.country_id || p.valid_from || p.valid_to)
      .map((p) => {
        const country = countryOptions.find((c) => c.id === p.country_id)
        return {
          id: p.tempId,
          country_id: p.country_id,
          country_name: country?.name ?? null,
          valid_from: p.valid_from || null,
          valid_to: p.valid_to || null,
        }
      })
  }, [periods, countryOptions])

  const issues = useMemo(
    () => (periodsForValidation.length > 0 ? validateCityCountryPeriods(periodsForValidation) : []),
    [periodsForValidation]
  )

  const periodsJson = useMemo(() => {
    // Wyślij tylko okresy, w których cokolwiek wpisano — pusty wiersz traktuj
    // jako placeholder UI. CHECK w bazie i tak wymaga przynajmniej jednej daty.
    const cleaned = periods
      .filter((p) => p.country_id || p.valid_from || p.valid_to || p.description.trim())
      .map((p) => ({
        country_id: p.country_id,
        valid_from: p.valid_from || null,
        valid_to: p.valid_to || null,
        description: p.description.trim() || null,
      }))
    return JSON.stringify(cleaned)
  }, [periods])

  function addPeriod() {
    setPeriods((prev) => [
      ...prev,
      {
        tempId: nextTempId(reactId),
        country_id: '',
        valid_from: '',
        valid_to: '',
        description: '',
      },
    ])
  }

  function removePeriod(tempId: string) {
    setPeriods((prev) => prev.filter((p) => p.tempId !== tempId))
  }

  function updatePeriod(tempId: string, patch: Partial<DraftPeriod>) {
    setPeriods((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)))
  }

  function handleCountryCreatedFromPeriod(
    option: InlineCreatedOption,
    tempId: string
  ) {
    const created: AdminCountryOption = { id: option.id, name: option.label ?? '—' }
    setCountryOptions((prev) => {
      if (prev.some((c) => c.id === created.id)) return prev
      return [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    })
    updatePeriod(tempId, { country_id: created.id })
    onCountryOptionCreated?.(option)
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
      <input type="hidden" name="periods_json" value={periodsJson} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
            Historia kraju (opcjonalna)
          </span>
          <span className="text-[11px] text-neutral-500">
            Dodaj okresy przynależności miasta do różnych krajów (np. Lwów: Polska → ZSRR → Ukraina).
          </span>
        </div>
        <button
          type="button"
          onClick={addPeriod}
          className="shrink-0 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          + Dodaj okres
        </button>
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1.5 rounded-md border border-amber-700/60 bg-amber-950/40 p-2 text-xs">
          {issues.map((issue, i) => (
            <li
              key={i}
              className={
                issue.level === 'error'
                  ? 'flex items-start gap-2 text-red-200'
                  : 'flex items-start gap-2 text-amber-200'
              }
            >
              <span
                aria-hidden
                className={
                  issue.level === 'error'
                    ? 'mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-400'
                    : 'mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400'
                }
              />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      {periods.length === 0 ? (
        <p className="text-[11px] text-neutral-500">
          Brak okresów. Kliknij &bdquo;+ Dodaj okres&rdquo;, aby wprowadzić zmianę przynależności
          państwowej. Bez wpisów miasto zachowa tylko aktualny kraj (z pola powyżej).
        </p>
      ) : (
        <div className="space-y-3">
          {periods.map((period, index) => {
            const rowScope = `${scope}_period_${period.tempId}`
            return (
              <div
                key={period.tempId}
                className="space-y-2 rounded-md border border-neutral-800 bg-neutral-900/60 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Okres #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePeriod(period.tempId)}
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-800"
                  >
                    Usuń
                  </button>
                </div>

                <AdminSelectField
                  name={`_period_country_${period.tempId}`}
                  label="Kraj"
                  selectedId={period.country_id}
                  options={countryOptionsForSelect}
                  displayKey="label"
                  placeholder="Wpisz, aby filtrować kraje..."
                  addButtonLabel="+ Dodaj kraj"
                  addDialogTitle="Nowy kraj"
                  emptyResultsMessage="Brak wyników - możesz dodać nowy kraj poniżej."
                  createAction={createCountryInline}
                  onSelectedIdChange={(countryId) =>
                    updatePeriod(period.tempId, { country_id: countryId })
                  }
                  onOptionCreated={(option) =>
                    handleCountryCreatedFromPeriod(option, period.tempId)
                  }
                  inlineForm={buildCountryInlineForm(rowScope, federations)}
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-neutral-400">Od</label>
                    <input
                      type="date"
                      value={period.valid_from}
                      onChange={(e) =>
                        updatePeriod(period.tempId, { valid_from: e.target.value })
                      }
                      className="rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-neutral-400">Do</label>
                    <input
                      type="date"
                      value={period.valid_to}
                      onChange={(e) =>
                        updatePeriod(period.tempId, { valid_to: e.target.value })
                      }
                      className="rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-neutral-400">Opis (opcjonalnie)</label>
                  <textarea
                    rows={2}
                    value={period.description}
                    onChange={(e) =>
                      updatePeriod(period.tempId, { description: e.target.value })
                    }
                    className="rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-100"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
