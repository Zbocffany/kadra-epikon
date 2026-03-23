import Link from 'next/link'
import { createStadium } from './actions'
import StadiumsSearchTable from './StadiumsSearchTable'
import { createCityInline } from '@/app/admin/cities/actions'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCountryOption } from '@/lib/db/cities'
import { getAdminCities } from '@/lib/db/clubs'
import type { AdminCity } from '@/lib/db/clubs'
import { getAdminStadiums } from '@/lib/db/stadiums'
import type { AdminStadiumListItem } from '@/lib/db/stadiums'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'
import AdminSelectField from '@/components/admin/AdminSelectField'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import type { RawSearchParams } from '@/lib/pagination'

type SearchParams = Promise<RawSearchParams>

function StadiumCreateFields({ cities, countries }: { cities: AdminCity[]; countries: AdminCountryOption[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-neutral-300">
          Nazwa stadionu <span className="text-red-400">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="off"
          placeholder="np. Stadion Narodowy"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />
      </div>

      <AdminSelectField
        name="stadium_city_id"
        label="Miasto stadionu"
        required
        options={cities.map((c) => ({ id: c.id, label: c.city_name }))}
        displayKey="label"
        addButtonLabel="+ Dodaj miasto"
        addDialogTitle="Nowe miasto"
        emptyResultsMessage="Brak wyników - możesz dodać nowe miasto poniżej."
        createAction={createCityInline}
        inlineForm={
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_city_name" className="text-xs text-neutral-400">
                Nazwa miasta
              </label>
              <input
                id="inline_city_name"
                name="city_name"
                type="text"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_city_country" className="text-xs text-neutral-400">
                Kraj
              </label>
              <select
                id="inline_city_country"
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
              <label htmlFor="inline_city_voivodeship" className="text-xs text-neutral-400">
                Województwo (tylko Polska)
              </label>
              <select
                id="inline_city_voivodeship"
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
        }
      />
    </div>
  )
}

export default async function AdminStadiumsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams
  const { error: formError, create } = resolvedSearchParams

  let stadiums: AdminStadiumListItem[] = []
  let cities: AdminCity[] = []
  let countries: AdminCountryOption[] = []
  let fetchError: string | null = null

  try {
    const [fetchedStadiums, fetchedCities, fetchedCountries] = await Promise.all([
      getAdminStadiums(),
      getAdminCities(),
      getAdminCountriesOptions(),
    ])
    stadiums = fetchedStadiums
    cities = fetchedCities
    countries = fetchedCountries
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const pluralLabel = (() => {
    const count = stadiums.length
    if (count === 1) return 'stadion'
    if (count < 5) return 'stadiony'
    return 'stadionów'
  })()

  const isCreateModalOpen = create === '1' || Boolean(formError)

  return (
    <AdminListLayout
      title="Stadiony"
      breadcrumb="Admin"
      recordCount={stadiums.length}
      recordLabel={pluralLabel}
      fetchError={fetchError}
      headerActions={(
        <Link
          href="/admin/stadiums?create=1"
          className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
        >
          Dodaj stadion
        </Link>
      )}
    >
      {!fetchError && (
        <>
          <StadiumsSearchTable stadiums={stadiums} />

          {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
              <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-neutral-100">Dodaj stadion</h2>
                </div>

                <form action={createStadium} className="space-y-4">
                  <StadiumCreateFields cities={cities} countries={countries} />

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                    >
                      Dodaj stadion
                    </button>
                    <AdminCancelLink
                      href="/admin/stadiums"
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


