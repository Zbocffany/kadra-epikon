import { createCountry, createFederationInline } from './actions'
import Link from 'next/link'
import AdminPagination from '@/components/admin/AdminPagination'
import { getAdminCountriesPage, getAdminFederations } from '@/lib/db/countries'
import type { AdminCountry, AdminFederation } from '@/lib/db/countries'
import AdminSelectField from '@/components/admin/AdminSelectField'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminTable from '@/components/admin/AdminTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import { getPaginationMeta, parsePaginationParams, type RawSearchParams } from '@/lib/pagination'

function CountryCreateFields({ federations }: { federations: AdminFederation[] }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="name" className="text-sm font-medium text-neutral-300">
            Nazwa <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="off"
            placeholder="np. Polska"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fifa_code" className="text-sm font-medium text-neutral-300">
            Kod FIFA
          </label>
          <input
            id="fifa_code"
            name="fifa_code"
            type="text"
            autoComplete="off"
            maxLength={3}
            placeholder="POL"
            className="uppercase rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        </div>
      </div>

      <div className="mt-4">
        <AdminSelectField
          name="federation_id"
          label="Federacja"
          options={federations}
          displayKey="short_name"
          addButtonLabel="+ Dodaj federacje"
          addDialogTitle="Nowa federacja"
          emptyResultsMessage="Brak wyników — możesz dodać nową federację poniżej."
          createAction={createFederationInline}
          inlineForm={(
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_fed_short" className="text-xs text-neutral-400">
                    Skrót
                  </label>
                  <input
                    id="inline_fed_short"
                    name="short_name"
                    type="text"
                    required
                    className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_fed_year" className="text-xs text-neutral-400">
                    Rok założenia
                  </label>
                  <input
                    id="inline_fed_year"
                    name="foundation_year"
                    type="number"
                    min={1800}
                    max={new Date().getFullYear()}
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="inline_fed_full" className="text-xs text-neutral-400">
                  Pełna nazwa
                </label>
                <input
                  id="inline_fed_full"
                  name="full_name"
                  type="text"
                  required
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                />
              </div>
            </div>
          )}
        />
      </div>
    </>
  )
}

type SearchParams = Promise<RawSearchParams>

export default async function AdminCountriesPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams
  const { error: formError, create } = resolvedSearchParams
  const { page, pageSize } = parsePaginationParams(resolvedSearchParams)

  let countries: AdminCountry[] = []
  let totalCountries = 0
  let federations: AdminFederation[] = []
  let fetchError: string | null = null

  try {
    const [countriesPage, fetchedFederations] = await Promise.all([
      getAdminCountriesPage(page, pageSize),
      getAdminFederations(),
    ])
    countries = countriesPage.items
    totalCountries = countriesPage.total
    federations = fetchedFederations
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const pagination = getPaginationMeta(totalCountries, page, pageSize)
  const indexOffset = pagination.from > 0 ? pagination.from - 1 : 0

  const columns: AdminTableColumn<AdminCountry>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, i) => indexOffset + i + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'name',
      label: 'Nazwa',
      render: (country) => (
        <Link
          href={`/admin/countries/${country.id}`}
          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          {country.name}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'fifa_code',
      label: 'FIFA',
      render: (country) => country.fifa_code ?? '—',
      className: 'text-neutral-300',
    },
    {
      key: 'federation',
      label: 'Federacja',
      render: (country) => country.federation_short_name ?? '—',
      className: 'text-neutral-400',
    },
  ]

  const emptyMessage = !countries.length
    ? 'Brak krajów w tabeli tbl_Countries. Uruchom seed db/seeds/002_UEFA_countries.sql.'
    : 'Brak krajów.'

  const isCreateModalOpen = create === '1' || Boolean(formError)

  return (
    <AdminListLayout
      title="Kraje"
      breadcrumb="Admin"
      recordCount={totalCountries}
      recordLabel={totalCountries === 1 ? 'kraj' : 'krajów'}
      fetchError={fetchError}
      headerActions={(
        <Link
          href="/admin/countries?create=1"
          className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
        >
          Dodaj kraj
        </Link>
      )}
    >
      {!fetchError && (
        <>
          <AdminTable data={countries} columns={columns} emptyMessage={emptyMessage} />
          {countries.length > 0 && (
            <AdminPagination
              basePath="/admin/countries"
              searchParams={resolvedSearchParams}
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              from={pagination.from}
              to={pagination.to}
              itemLabel={pagination.total === 1 ? 'kraju' : 'krajów'}
            />
          )}
          {countries.length > 0 && (
            <p className="text-xs text-neutral-500">Kliknij nazwę kraju, aby przejść do strony szczegółów.</p>
          )}

          {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
              <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-neutral-100">Dodaj kraj</h2>
                </div>

                <form action={createCountry} className="space-y-4">
                  <CountryCreateFields federations={federations} />

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                    >
                      Dodaj kraj
                    </button>
                    <AdminCancelLink
                      href="/admin/countries"
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


