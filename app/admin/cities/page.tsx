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
import AdminSelectField from '@/components/admin/AdminSelectField'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminTable from '@/components/admin/AdminTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'

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

        <AdminSelectField
          name="country_id"
          label="Kraj"
          required
          options={countries.map((c) => ({ id: c.id, label: c.name }))}
          displayKey="label"
          addButtonLabel="+ Dodaj kraj"
          addDialogTitle="Nowy kraj"
          emptyResultsMessage="Brak wyników — możesz dodać nowy kraj poniżej."
          createAction={createCountryInline}
          renderInlineForm={(ref) => (
            <div ref={ref} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_country_name" className="text-xs text-neutral-400">
                    Nazwa kraju
                  </label>
                  <input
                    id="inline_country_name"
                    name="name"
                    type="text"
                    required
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_country_fifa" className="text-xs text-neutral-400">
                    Kod FIFA
                  </label>
                  <input
                    id="inline_country_fifa"
                    name="fifa_code"
                    type="text"
                    maxLength={3}
                    className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="inline_country_federation" className="text-xs text-neutral-400">
                  Federacja
                </label>
                <select
                  id="inline_country_federation"
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
          )}
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

  const columns: AdminTableColumn<AdminCityListItem>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, i) => i + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'city_name',
      label: 'Miasto',
      render: (city) => (
        <Link
          href={`/admin/cities/${city.id}`}
          className="text-neutral-100 underline decoration-neutral-700 underline-offset-4 transition hover:text-white hover:decoration-neutral-300"
        >
          {city.city_name ?? '—'}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'country',
      label: 'Kraj',
      render: (city) => city.country_name ?? '—',
      className: 'text-neutral-400',
    },
  ]

  return (
    <AdminListLayout
      title="Miasta"
      breadcrumb="Admin"
      recordCount={cities.length}
      recordLabel={cities.length === 1 ? 'miasto' : 'miast'}
      fetchError={fetchError}
    >
      {!fetchError && (
        <>
          <CityForm
            countries={countries}
            federations={federations}
            added={added}
            error={formError}
          />
          <AdminTable data={cities} columns={columns} emptyMessage="Brak miast w bazie danych." />
          {!fetchError && cities.length > 0 && (
            <p className="text-xs text-neutral-500">
              Kliknij nazwe miasta, aby przejsc do strony szczegolow.
            </p>
          )}
        </>
      )}
    </AdminListLayout>
  )
}
