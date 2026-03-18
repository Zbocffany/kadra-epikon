import Link from 'next/link'
import { createCity } from './actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import {
  getAdminCitiesList,
  getAdminCountriesOptions,
} from '@/lib/db/cities'
import type { AdminCityListItem, AdminCountryOption } from '@/lib/db/cities'
import { getAdminFederations } from '@/lib/db/countries'
import type { AdminFederation } from '@/lib/db/countries'
import CountrySelectField from '@/components/admin/CountrySelectField'

type SearchParams = Promise<{ added?: string; error?: string }>

function CityForm({
  countries,
  federations,
  added,
  error,
}: {
  countries: AdminCountryOption[]
  federations: AdminFederation[]
  added?: string
  error?: string
}) {
  return (
    <form action={createCity} className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="mb-5 text-lg font-semibold">Dodaj miasto</h2>

      {added && (
        <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
          Miasto "{added}" zostalo dodane.
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="city_name" className="text-sm font-medium text-neutral-300">
            Nazwa miasta <span className="text-red-400">*</span>
          </label>
          <input
            id="city_name"
            name="city_name"
            type="text"
            required
            autoComplete="off"
            placeholder="np. Warszawa"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        <CountrySelectField
          name="country_id"
          label="Kraj"
          required
          options={countries.map((c) => ({ id: c.id, label: c.name }))}
          federationOptions={federations}
          createCountryInlineAction={createCountryInline}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white"
        >
          Dodaj miasto
        </button>
      </div>
    </form>
  )
}

function CitiesTable({ cities }: { cities: AdminCityListItem[] }) {
  if (!cities.length) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-6 py-16 text-center text-neutral-500">
        Brak miast w bazie danych.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
            <th className="px-4 py-3 font-medium text-neutral-400">#</th>
            <th className="px-4 py-3 font-medium text-neutral-400">Miasto</th>
            <th className="px-4 py-3 font-medium text-neutral-400">Kraj</th>
          </tr>
        </thead>
        <tbody>
          {cities.map((city, i) => (
            <tr
              key={city.id}
              className={`border-b border-neutral-800 last:border-b-0 ${
                i % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/40'
              }`}
            >
              <td className="px-4 py-3 text-neutral-500">{i + 1}</td>
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/admin/cities/${city.id}`}
                  className="text-neutral-100 underline decoration-neutral-700 underline-offset-4 transition hover:text-white hover:decoration-neutral-300"
                >
                  {city.city_name ?? '—'}
                </Link>
              </td>
              <td className="px-4 py-3 text-neutral-400">{city.country_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function AdminCitiesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { added, error: formError } = await searchParams

  let cities: AdminCityListItem[] = []
  let countries: AdminCountryOption[] = []
  let federations: AdminFederation[] = []
  let fetchError: string | null = null

  try {
    ;[cities, countries, federations] = await Promise.all([
      getAdminCitiesList(),
      getAdminCountriesOptions(),
      getAdminFederations(),
    ])
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Admin
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Miasta</h1>
          </div>
          <span className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
            {cities.length} {cities.length === 1 ? 'miasto' : 'miast'}
          </span>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
            <strong className="font-semibold">Blad pobierania danych:</strong> {fetchError}
          </div>
        )}

        {!fetchError && (
          <div className="mb-8">
            <CityForm
              countries={countries}
              federations={federations}
              added={added}
              error={formError}
            />
          </div>
        )}

        {!fetchError && <CitiesTable cities={cities} />}
        {!fetchError && cities.length > 0 && (
          <p className="mt-4 text-xs text-neutral-500">
            Kliknij nazwe miasta, aby przejsc do strony szczegolow.
          </p>
        )}
      </div>
    </main>
  )
}
