import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteClub, updateClub } from '../actions'
import { getAdminCities, getAdminClubDetails } from '@/lib/db/clubs'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import CitySelectField from '@/components/admin/CitySelectField'
import { createCityInline } from '@/app/admin/cities/actions'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ mode?: string; saved?: string; error?: string }>

export default async function AdminClubDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams

  const [club, cities, countries] = await Promise.all([
    getAdminClubDetails(id),
    getAdminCities(),
    getAdminCountriesOptions(),
  ])

  if (!club) {
    notFound()
  }

  const isEdit = mode === 'edit'

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/admin/clubs"
            className="text-sm text-neutral-400 underline decoration-neutral-700 underline-offset-4 hover:text-neutral-200"
          >
            Powrot do listy klubow
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/admin/clubs/${club.id}?mode=edit`}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              Edytuj
            </Link>
            <form action={deleteClub}>
              <input type="hidden" name="id" value={club.id} />
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
            Admin / Kluby
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{club.name}</h1>

          {isEdit ? (
            <form action={updateClub} className="mt-6 space-y-4">
              <input type="hidden" name="id" value={club.id} />

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
                    defaultValue={club.name}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                  />
                </div>

                <CitySelectField
                  name="club_city_id"
                  label="Miasto"
                  selectedId={club.club_city_id}
                  options={cities.map((c) => ({ id: c.id, label: c.city_name }))}
                  countryOptions={countries}
                  createCityInlineAction={createCityInline}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href={`/admin/clubs/${club.id}`}
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
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Miasto</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">
                  {club.city_name ?? '—'}
                </p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Kraj</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">
                  {club.country_name ?? '—'}
                </p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Stadion</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">
                  {club.stadium_names.length ? club.stadium_names.join(', ') : '—'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
