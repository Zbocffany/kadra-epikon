import Link from 'next/link'
import { createCity } from './actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import { getAdminCitiesList, getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCityListItem, AdminCountryOption } from '@/lib/db/cities'
import { getAdminFederations } from '@/lib/db/countries'
import type { AdminFederation } from '@/lib/db/countries'
import AdminSelectField from '@/components/admin/AdminSelectField'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminTable from '@/components/admin/AdminTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'

type SearchParams = Promise<{ added?: string; error?: string; create?: string }>

function CityCreateFields({
  countries,
  federations,
}: {
  countries: AdminCountryOption[]
  federations: AdminFederation[]
}) {
  return (
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
        inlineForm={(
          <div className="space-y-3">
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

      <div className="sm:col-span-2 flex flex-col gap-1.5">
        <label htmlFor="voivodeship" className="text-sm font-medium text-neutral-300">
          Województwo (tylko Polska)
        </label>
        <select
          id="voivodeship"
          name="voivodeship"
          defaultValue=""
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
  )
}

export default async function AdminCitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const { added, error: formError, create } = await searchParams

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
          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
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

  const isCreateModalOpen = create === '1' || Boolean(formError)

  return (
    <AdminListLayout
      title="Miasta"
      breadcrumb="Admin"
      recordCount={cities.length}
      recordLabel={cities.length === 1 ? 'miasto' : 'miast'}
      fetchError={fetchError}
      headerActions={(
        <Link
          href="/admin/cities?create=1"
          className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
        >
          Dodaj miasto
        </Link>
      )}
    >
      {!fetchError && (
        <>
          {added && (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
              Miasto "{added}" zostało dodane.
            </div>
          )}

          <AdminTable data={cities} columns={columns} emptyMessage="Brak miast w bazie danych." />
          {cities.length > 0 && (
            <p className="text-xs text-neutral-500">Kliknij nazwę miasta, aby przejść do strony szczegółów.</p>
          )}

          {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
              <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-neutral-100">Dodaj miasto</h2>
                  <Link
                    href="/admin/cities"
                    className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
                  >
                    Zamknij
                  </Link>
                </div>

                {formError && (
                  <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                    {formError}
                  </div>
                )}

                <form action={createCity} className="space-y-4">
                  <CityCreateFields countries={countries} federations={federations} />

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Link
                      href="/admin/cities"
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                    >
                      Anuluj
                    </Link>
                    <button
                      type="submit"
                      className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                    >
                      Dodaj miasto
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </AdminListLayout>
  )
}


