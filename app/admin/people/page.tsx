import Link from 'next/link'
import { createPerson } from './actions'
import { createCityInline } from '@/app/admin/cities/actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCountryOption } from '@/lib/db/cities'
import { getAdminPeople, getAdminPersonBirthCityOptions } from '@/lib/db/people'
import type { AdminPersonBirthCityOption, AdminPersonListItem } from '@/lib/db/people'
import AdminListLayout from '@/components/admin/AdminListLayout'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import PersonBirthplaceFields from '@/components/admin/PersonBirthplaceFields'
import PersonRepresentedCountriesFields from '@/components/admin/PersonRepresentedCountriesFields'
import type { RawSearchParams } from '@/lib/pagination'
import PeopleSearchTable from './PeopleSearchTable'

type SearchParams = Promise<RawSearchParams>

function PeopleCreateFields({
  cities,
  countries,
}: {
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
}) {
  const syncScope = 'admin-people-create'

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="first_name" className="text-sm font-medium text-neutral-300">Imię</label>
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
        <PersonBirthplaceFields
          cities={cities}
          countries={countries}
          createCityAction={createCityInline}
          createCountryAction={createCountryInline}
          syncScope={syncScope}
        />
      </div>

      <div className="mt-4">
        <PersonRepresentedCountriesFields
          countries={countries}
          createCountryAction={createCountryInline}
          syncScope={syncScope}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input id="is_active" name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
        <label htmlFor="is_active" className="text-sm text-neutral-300">Aktywna osoba</label>
      </div>

      <p className="mt-3 text-xs text-neutral-500">Wymagane jest przynajmniej jedno pole: imię, nazwisko lub pseudonim.</p>
    </>
  )
}

export default async function AdminPeoplePage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams
  const { error: formError, create } = resolvedSearchParams

  let people: AdminPersonListItem[] = []
  let cities: AdminPersonBirthCityOption[] = []
  let countries: AdminCountryOption[] = []
  let fetchError: string | null = null

  try {
    const [fetchedPeople, fetchedCities, fetchedCountries] = await Promise.all([
      getAdminPeople(),
      getAdminPersonBirthCityOptions(),
      getAdminCountriesOptions(),
    ])
    people = fetchedPeople
    cities = fetchedCities
    countries = fetchedCountries
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const pluralLabel = (() => {
    const count = people.length
    if (count === 1) return 'osoba'
    if (count < 5) return 'osoby'
    return 'osób'
  })()

  const isCreateModalOpen = create === '1' || Boolean(formError)

  return (
    <AdminListLayout
      title="Ludzie"
      breadcrumb="Admin"
      recordCount={people.length}
      recordLabel={pluralLabel}
      fetchError={fetchError}
      headerActions={(
        <Link
          href="/admin/people?create=1"
          className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
        >
          Dodaj osobę
        </Link>
      )}
    >
      {!fetchError && (
        <>
          <PeopleSearchTable people={people} />

          {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
              <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-neutral-100">Dodaj osobę</h2>
                </div>

                <form action={createPerson} className="space-y-4">
                  <PeopleCreateFields cities={cities} countries={countries} />

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                    >
                      Dodaj osobę
                    </button>
                    <AdminCancelLink
                      href="/admin/people"
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


