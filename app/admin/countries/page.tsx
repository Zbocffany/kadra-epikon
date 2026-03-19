import { createCountry, createFederationInline } from './actions'
import Link from 'next/link'
import {
  getAdminCountries,
  getAdminFederations,
} from '@/lib/db/countries'
import type { AdminCountry, AdminFederation } from '@/lib/db/countries'
import FederationSelectField from '@/components/admin/FederationSelectField'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminTable from '@/components/admin/AdminTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'

function CountryForm({
  federations,
  added,
  error,
}: {
  federations: AdminFederation[]
  added?: string
  error?: string
}) {
  return (
    <form action={createCountry} className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="mb-5 text-lg font-semibold">Dodaj kraj</h2>

      {added && (
        <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
          Kraj "{added}" zostal dodany.
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

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
        <FederationSelectField
          name="federation_id"
          label="Federacja"
          options={federations}
          createFederationInlineAction={createFederationInline}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white"
        >
          Dodaj kraj
        </button>
      </div>
    </form>
  )
}

type SearchParams = Promise<{ added?: string; error?: string }>

export default async function AdminCountriesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { added, error: formError } = await searchParams

  let countries: AdminCountry[] = []
  let federations: AdminFederation[] = []
  let fetchError: string | null = null

  try {
    ;[countries, federations] = await Promise.all([
      getAdminCountries(),
      getAdminFederations(),
    ])
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const columns: AdminTableColumn<AdminCountry>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, i) => i + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'name',
      label: 'Nazwa',
      render: (country) => (
        <Link
          href={`/admin/countries/${country.id}`}
          className="text-neutral-100 underline decoration-neutral-700 underline-offset-4 transition hover:text-white hover:decoration-neutral-300"
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
    ? 'Brak krajow w tabeli tbl_Countries. Uruchom seed db/seeds/002_UEFA_countries.sql.'
    : 'Brak krajow.'

  return (
    <AdminListLayout
      title="Kraje"
      breadcrumb="Admin"
      recordCount={countries.length}
      recordLabel={countries.length === 1 ? 'kraj' : 'krajow'}
      fetchError={fetchError}
    >
      {!fetchError && (
        <>
          <CountryForm federations={federations} added={added} error={formError} />
          <AdminTable data={countries} columns={columns} emptyMessage={emptyMessage} />
          {!fetchError && countries.length > 0 && (
            <p className="text-xs text-neutral-500">
              Kliknij nazwe kraju, aby przejsc do strony szczegolow.
            </p>
          )}
        </>
      )}
    </AdminListLayout>
  )
}
