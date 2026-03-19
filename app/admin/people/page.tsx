import Link from 'next/link'
import { createPerson } from './actions'
import { createCityInline } from '@/app/admin/cities/actions'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCountryOption } from '@/lib/db/cities'
import { getAdminPeople, getPersonDisplayName, getAdminPersonBirthCityOptions } from '@/lib/db/people'
import type { AdminPersonBirthCityOption, AdminPersonListItem } from '@/lib/db/people'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminTable from '@/components/admin/AdminTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import PersonBirthplaceFields from '@/components/admin/PersonBirthplaceFields'

type SearchParams = Promise<{ added?: string; error?: string }>

function PeopleForm({
  cities,
  countries,
  added,
  error,
}: {
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
  added?: string
  error?: string
}) {
  return (
    <form action={createPerson} className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="mb-5 text-lg font-semibold">Dodaj osobe</h2>

      {added && (
        <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
          Osoba "{added}" zostala dodana.
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="first_name" className="text-sm font-medium text-neutral-300">Imie</label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            autoComplete="off"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="last_name" className="text-sm font-medium text-neutral-300">Nazwisko</label>
          <input
            id="last_name"
            name="last_name"
            type="text"
            autoComplete="off"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nickname" className="text-sm font-medium text-neutral-300">Pseudonim</label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            autoComplete="off"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </div>
      </div>

      <div className="mt-4">
        <PersonBirthplaceFields cities={cities} countries={countries} createCityAction={createCityInline} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input id="is_active" name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
        <label htmlFor="is_active" className="text-sm text-neutral-300">Aktywna osoba</label>
      </div>

      <p className="mt-3 text-xs text-neutral-500">Wymagane jest przynajmniej jedno pole: imie, nazwisko lub pseudonim.</p>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white"
        >
          Dodaj osobe
        </button>
      </div>
    </form>
  )
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

export default async function AdminPeoplePage({ searchParams }: { searchParams: SearchParams }) {
  const { added, error: formError } = await searchParams

  let people: AdminPersonListItem[] = []
  let cities: AdminPersonBirthCityOption[] = []
  let countries: AdminCountryOption[] = []
  let fetchError: string | null = null

  try {
    ;[people, cities, countries] = await Promise.all([
      getAdminPeople(),
      getAdminPersonBirthCityOptions(),
      getAdminCountriesOptions(),
    ])
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const columns: AdminTableColumn<AdminPersonListItem>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, i) => i + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'person',
      label: 'Osoba',
      render: (person) => (
        <Link
          href={`/admin/people/${person.id}`}
          className="text-neutral-100 underline decoration-neutral-700 underline-offset-4 transition hover:text-white hover:decoration-neutral-300"
        >
          {getPersonDisplayName(person)}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'birth_date',
      label: 'Data ur.',
      render: (person) => formatDate(person.birth_date),
      className: 'text-neutral-300',
    },
    {
      key: 'birth_city',
      label: 'Miasto ur.',
      render: (person) => person.birth_city_name ?? '—',
      className: 'text-neutral-400',
    },
    {
      key: 'birth_country',
      label: 'Kraj ur.',
      render: (person) => person.birth_country_name ?? '—',
      className: 'text-neutral-400',
    },
    {
      key: 'active',
      label: 'Aktywna',
      render: (person) => (person.is_active ? 'Tak' : 'Nie'),
      className: 'text-neutral-400',
    },
  ]

  const pluralLabel = (() => {
    const count = people.length
    if (count === 1) return 'osoba'
    if (count < 5) return 'osoby'
    return 'osob'
  })()

  return (
    <AdminListLayout
      title="Ludzie"
      breadcrumb="Admin"
      recordCount={people.length}
      recordLabel={pluralLabel}
      fetchError={fetchError}
    >
      {!fetchError && (
        <>
          <PeopleForm cities={cities} countries={countries} added={added} error={formError} />
          <AdminTable data={people} columns={columns} emptyMessage="Brak osob w bazie danych." />
          {people.length > 0 && (
            <p className="text-xs text-neutral-500">Kliknij osobe, aby przejsc do strony szczegolow.</p>
          )}
        </>
      )}
    </AdminListLayout>
  )
}
