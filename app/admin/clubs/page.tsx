import { getAdminClubs, getAdminCities } from '@/lib/db/clubs'
import type { AdminClub, AdminCity } from '@/lib/db/clubs'
import { createClub } from './actions'
import Link from 'next/link'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { createCityInline } from '@/app/admin/cities/actions'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCountryOption } from '@/lib/db/cities'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminTable from '@/components/admin/AdminTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'

// ─── Form ─────────────────────────────────────────────────────────────────────

function ClubForm({
  cities,
  countries,
  error,
  added,
}: {
  cities: AdminCity[]
  countries: AdminCountryOption[]
  error?: string
  added?: string
}) {
  return (
    <form action={createClub} className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="mb-5 text-lg font-semibold">Dodaj klub</h2>

      {added && (
        <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
          Klub „{added}" został dodany.
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name */}
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
          renderInlineForm={(ref) => (
            <div ref={ref} className="space-y-3">
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
            </div>
          )}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white"
        >
          Dodaj klub
        </button>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ added?: string; error?: string }>

export default async function AdminClubsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { added, error: formError } = await searchParams

  let clubs: AdminClub[] = []
  let cities: AdminCity[] = []
  let countries: AdminCountryOption[] = []
  let fetchError: string | null = null

  try {
    ;[clubs, cities, countries] = await Promise.all([
      getAdminClubs(),
      getAdminCities(),
      getAdminCountriesOptions(),
    ])
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const columns: AdminTableColumn<AdminClub>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, i) => i + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'name',
      label: 'Nazwa',
      render: (club) => (
        <Link
          href={`/admin/clubs/${club.id}`}
          className="text-neutral-100 underline decoration-neutral-700 underline-offset-4 transition hover:text-white hover:decoration-neutral-300"
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
    const count = clubs.length
    if (count === 1) return 'klub'
    if (count < 5) return 'kluby'
    return 'klubów'
  })()

  return (
    <AdminListLayout
      title="Kluby"
      breadcrumb="Admin"
      recordCount={clubs.length}
      recordLabel={pluralLabel}
      fetchError={fetchError}
    >
      {!fetchError && (
        <>
          <ClubForm
            cities={cities}
            countries={countries}
            added={added}
            error={formError}
          />
          <AdminTable data={clubs} columns={columns} emptyMessage="Brak klubów w bazie danych." />
          {!fetchError && clubs.length > 0 && (
            <p className="text-xs text-neutral-500">
              Kliknij nazwe klubu, aby przejsc do strony szczegolow.
            </p>
          )}
        </>
      )}
    </AdminListLayout>
  )
}
