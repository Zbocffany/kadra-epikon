import { getAdminClubsPage, getAdminCities } from '@/lib/db/clubs'
import type { AdminClub, AdminCity } from '@/lib/db/clubs'
import { createClub } from './actions'
import Link from 'next/link'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { createCityInline } from '@/app/admin/cities/actions'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCountryOption } from '@/lib/db/cities'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'
import AdminPagination from '@/components/admin/AdminPagination'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminTable from '@/components/admin/AdminTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import { getPaginationMeta, parsePaginationParams, type RawSearchParams } from '@/lib/pagination'

function ClubCreateFields({
  cities,
  countries,
}: {
  cities: AdminCity[]
  countries: AdminCountryOption[]
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-neutral-300">
          Nazwa <span className="text-red-400">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="off"
          placeholder="np. Legia Warszawa"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />
      </div>

      <AdminSelectField
        name="club_city_id"
        label="Miasto"
        options={cities.map((c) => ({ id: c.id, label: c.city_name }))}
        displayKey="label"
        addButtonLabel="+ Dodaj miasto"
        addDialogTitle="Nowe miasto"
        emptyResultsMessage="Brak wyników — możesz dodać nowe miasto poniżej."
        createAction={createCityInline}
        inlineForm={(
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
                <option value="">— wybierz —</option>
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
        )}
      />
    </div>
  )
}

type SearchParams = Promise<RawSearchParams>

export default async function AdminClubsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const resolvedSearchParams = await searchParams
  const { error: formError, create } = resolvedSearchParams
  const { page, pageSize } = parsePaginationParams(resolvedSearchParams)

  let clubs: AdminClub[] = []
  let totalClubs = 0
  let cities: AdminCity[] = []
  let countries: AdminCountryOption[] = []
  let fetchError: string | null = null

  try {
    const [clubsPage, fetchedCities, fetchedCountries] = await Promise.all([
      getAdminClubsPage(page, pageSize),
      getAdminCities(),
      getAdminCountriesOptions(),
    ])
    clubs = clubsPage.items
    totalClubs = clubsPage.total
    cities = fetchedCities
    countries = fetchedCountries
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const pagination = getPaginationMeta(totalClubs, page, pageSize)
  const indexOffset = pagination.from > 0 ? pagination.from - 1 : 0

  const columns: AdminTableColumn<AdminClub>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, i) => indexOffset + i + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'name',
      label: 'Nazwa',
      render: (club) => (
        <Link
          href={`/admin/clubs/${club.id}`}
          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          {club.name}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'city',
      label: 'Miasto',
      render: (club) => club.city_name ?? '—',
      className: 'text-neutral-400',
    },
  ]

  const pluralLabel = (() => {
    const count = totalClubs
    if (count === 1) return 'klub'
    if (count < 5) return 'kluby'
    return 'klubów'
  })()

  const isCreateModalOpen = create === '1' || Boolean(formError)

  return (
    <AdminListLayout
      title="Kluby"
      breadcrumb="Admin"
      recordCount={totalClubs}
      recordLabel={pluralLabel}
      fetchError={fetchError}
      headerActions={(
        <Link
          href="/admin/clubs?create=1"
          className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
        >
          Dodaj klub
        </Link>
      )}
    >
      {!fetchError && (
        <>
          <AdminTable data={clubs} columns={columns} emptyMessage="Brak klubów w bazie danych." />
          {clubs.length > 0 && (
            <AdminPagination
              basePath="/admin/clubs"
              searchParams={resolvedSearchParams}
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              from={pagination.from}
              to={pagination.to}
              itemLabel={pagination.total === 1 ? 'klubu' : 'klubów'}
            />
          )}
          {!fetchError && clubs.length > 0 && (
            <p className="text-xs text-neutral-500">
              Kliknij nazwę klubu, aby przejść do strony szczegółów.
            </p>
          )}

          {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
              <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-neutral-100">Dodaj klub</h2>
                </div>

                <form action={createClub} className="space-y-4">
                  <ClubCreateFields cities={cities} countries={countries} />

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                    >
                      Dodaj klub
                    </button>
                    <Link
                      href="/admin/clubs"
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
                    >
                      Zamknij
                    </Link>
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

