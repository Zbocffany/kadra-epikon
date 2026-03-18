import { createCountry } from './actions'
import Link from 'next/link'
import {
  getAdminCountries,
  getAdminFederations,
} from '@/lib/db/countries'
import type { AdminCountry, AdminFederation } from '@/lib/db/countries'

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

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="federation_id" className="text-sm font-medium text-neutral-300">
          Federacja
        </label>
        <select
          id="federation_id"
          name="federation_id"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        >
          <option value="">— brak —</option>
          {federations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.short_name}
            </option>
          ))}
        </select>
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

function CountriesTable({ countries }: { countries: AdminCountry[] }) {
  if (!countries.length) {
    return (
      <div className="rounded-xl border border-amber-800 bg-amber-950/40 px-6 py-8 text-sm text-amber-200">
        Brak krajow w tabeli <code>tbl_Countries</code>. Uruchom seed
        <code> db/seeds/002_UEFA_countries.sql</code>.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
            <th className="px-4 py-3 font-medium text-neutral-400">#</th>
            <th className="px-4 py-3 font-medium text-neutral-400">Nazwa</th>
            <th className="px-4 py-3 font-medium text-neutral-400">FIFA</th>
            <th className="px-4 py-3 font-medium text-neutral-400">Federacja</th>
          </tr>
        </thead>
        <tbody>
          {countries.map((country, i) => (
            <tr
              key={country.id}
              className={`border-b border-neutral-800 last:border-b-0 ${
                i % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/40'
              }`}
            >
              <td className="px-4 py-3 text-neutral-500">{i + 1}</td>
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/admin/countries/${country.id}`}
                  className="text-neutral-100 underline decoration-neutral-700 underline-offset-4 transition hover:text-white hover:decoration-neutral-300"
                >
                  {country.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-neutral-300">{country.fifa_code ?? '—'}</td>
              <td className="px-4 py-3 text-neutral-400">
                {country.federation_short_name ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Admin
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Kraje</h1>
          </div>
          <span className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
            {countries.length} {countries.length === 1 ? 'kraj' : 'krajow'}
          </span>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
            <strong className="font-semibold">Blad pobierania danych:</strong> {fetchError}
          </div>
        )}

        {!fetchError && (
          <div className="mb-8">
            <CountryForm federations={federations} added={added} error={formError} />
          </div>
        )}

        {!fetchError && <CountriesTable countries={countries} />}
        {!fetchError && countries.length > 0 && (
          <p className="mt-4 text-xs text-neutral-500">
            Kliknij nazwe kraju, aby przejsc do strony szczegolow.
          </p>
        )}
      </div>
    </main>
  )
}
