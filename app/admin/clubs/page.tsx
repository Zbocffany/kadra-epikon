import { getAdminClubs, getAdminCities } from '@/lib/db/clubs'
import type { AdminClub, AdminCity } from '@/lib/db/clubs'
import { createClub } from './actions'

// ─── Form ─────────────────────────────────────────────────────────────────────

function ClubForm({
  cities,
  error,
  added,
}: {
  cities: AdminCity[]
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

        {/* City */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="club_city_id" className="text-sm font-medium text-neutral-300">
            Miasto
          </label>
          <select
            id="club_city_id"
            name="club_city_id"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          >
            <option value="">— brak —</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.city_name}
              </option>
            ))}
          </select>
        </div>
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

// ─── Table ────────────────────────────────────────────────────────────────────

function ClubsTable({ clubs }: { clubs: AdminClub[] }) {
  if (!clubs.length) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-6 py-16 text-center text-neutral-500">
        Brak klubów w bazie danych.
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
            <th className="px-4 py-3 font-medium text-neutral-400">Miasto</th>
          </tr>
        </thead>
        <tbody>
          {clubs.map((club, i) => (
            <tr
              key={club.id}
              className={`border-b border-neutral-800 last:border-b-0 ${
                i % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/40'
              }`}
            >
              <td className="px-4 py-3 text-neutral-500">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-neutral-100">{club.name}</td>
              <td className="px-4 py-3 text-neutral-400">{club.city_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  let fetchError: string | null = null

  try {
    ;[clubs, cities] = await Promise.all([getAdminClubs(), getAdminCities()])
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Admin
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Kluby</h1>
          </div>
          <span className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
            {clubs.length}{' '}
            {clubs.length === 1 ? 'klub' : clubs.length < 5 ? 'kluby' : 'klubów'}
          </span>
        </div>

        {/* Fetch error */}
        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
            <strong className="font-semibold">Błąd pobierania danych:</strong> {fetchError}
          </div>
        )}

        {/* Form */}
        {!fetchError && (
          <div className="mb-8">
            <ClubForm cities={cities} added={added} error={formError} />
          </div>
        )}

        {/* List */}
        {!fetchError && <ClubsTable clubs={clubs} />}
      </div>
    </main>
  )
}
