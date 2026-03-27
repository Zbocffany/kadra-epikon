import Link from 'next/link'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCountryOption } from '@/lib/db/cities'
import { getAdminPeople, getAdminPersonBirthCityOptions } from '@/lib/db/people'
import type { AdminPersonBirthCityOption, AdminPersonListItem } from '@/lib/db/people'
import AdminListLayout from '@/components/admin/AdminListLayout'
import type { RawSearchParams } from '@/lib/pagination'
import PeopleSearchTable from './PeopleSearchTable'
import PeopleCreateFormClient from './PeopleCreateFormClient'

type SearchParams = Promise<RawSearchParams>

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

                <PeopleCreateFormClient cities={cities} countries={countries} />
              </div>
            </div>
          )}
        </>
      )}
    </AdminListLayout>
  )
}


