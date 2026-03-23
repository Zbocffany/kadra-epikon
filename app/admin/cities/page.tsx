import Link from 'next/link'
import { createCity } from './actions'
import CitiesSearchTable from './CitiesSearchTable'
import { createCountryInline } from '@/app/admin/countries/actions'
import { getAdminCitiesList, getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCityListItem, AdminCountryOption } from '@/lib/db/cities'
import { getAdminFederations } from '@/lib/db/countries'
import type { AdminFederation } from '@/lib/db/countries'
import AdminSelectField from '@/components/admin/AdminSelectField'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'
import type { RawSearchParams } from '@/lib/pagination'

type SearchParams = Promise<RawSearchParams>

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
  const resolvedSearchParams = await searchParams
  const { error: formError, create } = resolvedSearchParams

  let cities: AdminCityListItem[] = []
  let countries: AdminCountryOption[] = []
  let federations: AdminFederation[] = []
  let fetchError: string | null = null

  try {
    const [fetchedCities, fetchedCountries, fetchedFederations] = await Promise.all([
      getAdminCitiesList(),
      getAdminCountriesOptions(),
      getAdminFederations(),
    ])
    cities = fetchedCities
    countries = fetchedCountries
    federations = fetchedFederations
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

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
          <CitiesSearchTable cities={cities} />

          {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
              <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-neutral-100">Dodaj miasto</h2>
                </div>

                <form action={createCity} className="space-y-4">
                  <CityCreateFields countries={countries} federations={federations} />

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                    >
                      Dodaj miasto
                    </button>
                    <AdminCancelLink
                      href="/admin/cities"
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
                    >
                      Anuluj
                    </AdminCancelLink>
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


