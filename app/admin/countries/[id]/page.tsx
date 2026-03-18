import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  createFederationInline,
  deleteCountry,
  updateCountry,
} from '../actions'
import {
  getAdminCountryDetails,
  getAdminFederations,
} from '@/lib/db/countries'
import FederationSelectField from '@/components/admin/FederationSelectField'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ mode?: string; saved?: string; error?: string }>

export default async function AdminCountryDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams

  const [country, federations] = await Promise.all([
    getAdminCountryDetails(id),
    getAdminFederations(),
  ])

  if (!country) {
    notFound()
  }

  const isEdit = mode === 'edit'

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/admin/countries"
            className="text-sm text-neutral-400 underline decoration-neutral-700 underline-offset-4 hover:text-neutral-200"
          >
            Powrot do listy krajow
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/admin/countries/${country.id}?mode=edit`}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              Edytuj
            </Link>
            <form action={deleteCountry}>
              <input type="hidden" name="id" value={country.id} />
              <button
                type="submit"
                className="rounded-md border border-red-800 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/40"
              >
                Usun
              </button>
            </form>
          </div>
        </div>

        {saved && (
          <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
            Zmiany zostaly zapisane.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Admin / Kraje
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{country.name}</h1>

          {isEdit ? (
            <form action={updateCountry} className="mt-6 space-y-4">
              <input type="hidden" name="id" value={country.id} />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-neutral-300">
                  Nazwa <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={country.name}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fifa_code" className="text-sm font-medium text-neutral-300">
                    Kod FIFA
                  </label>
                  <input
                    id="fifa_code"
                    name="fifa_code"
                    type="text"
                    maxLength={3}
                    defaultValue={country.fifa_code ?? ''}
                    className="uppercase rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                  />
                </div>

                <FederationSelectField
                  name="federation_id"
                  label="Federacja"
                  selectedId={country.federation_id}
                  options={federations}
                  createFederationInlineAction={createFederationInline}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href={`/admin/countries/${country.id}`}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                >
                  Anuluj
                </Link>
                <button
                  type="submit"
                  className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                >
                  Zapisz
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Kod FIFA</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">
                  {country.fifa_code ?? '—'}
                </p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Federacja</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">
                  {country.federation_short_name ?? '—'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
