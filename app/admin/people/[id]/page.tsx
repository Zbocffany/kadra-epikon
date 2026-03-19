import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deletePerson, updatePerson } from '../actions'
import { getAdminPeople, getAdminPersonDetails, getPersonDisplayName } from '@/lib/db/people'
import { getAdminCities } from '@/lib/db/clubs'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

type Params = DetailPageParams
type SearchParams = DetailPageSearchParams

function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

export default async function AdminPersonDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams

  const [person, cities, countries] = await Promise.all([
    getAdminPersonDetails(id),
    getAdminCities(),
    getAdminCountriesOptions(),
  ])

  if (!person) {
    notFound()
  }

  const displayName = getPersonDisplayName(person)
  const isEdit = mode === 'edit'

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={displayName}
        backLabel="Powrot do listy ludzi"
        backHref="/admin/people"
        editHref={`/admin/people/${person.id}?mode=edit`}
        deleteAction={deletePerson}
        deleteId={person.id}
      />

      <DetailsPageContent
        title={displayName}
        breadcrumb="Admin / Ludzie"
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updatePerson} className="mt-6 space-y-4">
            <input type="hidden" name="id" value={person.id} />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="first_name" className="text-sm font-medium text-neutral-300">Imie</label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  defaultValue={person.first_name ?? ''}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="last_name" className="text-sm font-medium text-neutral-300">Nazwisko</label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  defaultValue={person.last_name ?? ''}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="nickname" className="text-sm font-medium text-neutral-300">Pseudonim</label>
                <input
                  id="nickname"
                  name="nickname"
                  type="text"
                  defaultValue={person.nickname ?? ''}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="birth_date" className="text-sm font-medium text-neutral-300">Data urodzenia</label>
                <input
                  id="birth_date"
                  name="birth_date"
                  type="date"
                  defaultValue={person.birth_date ?? ''}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="birth_city_id" className="text-sm font-medium text-neutral-300">Miasto urodzenia</label>
                <select
                  id="birth_city_id"
                  name="birth_city_id"
                  defaultValue={person.birth_city_id ?? ''}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                >
                  <option value="">— brak —</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.city_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="birth_country_id" className="text-sm font-medium text-neutral-300">Kraj urodzenia</label>
                <select
                  id="birth_country_id"
                  name="birth_country_id"
                  defaultValue={person.birth_country_id ?? ''}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                >
                  <option value="">— brak —</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is_active"
                name="is_active"
                type="checkbox"
                defaultChecked={Boolean(person.is_active)}
                className="h-4 w-4"
              />
              <label htmlFor="is_active" className="text-sm text-neutral-300">Aktywna osoba</label>
            </div>

            <p className="text-xs text-neutral-500">Wymagane jest przynajmniej jedno pole: imie, nazwisko lub pseudonim.</p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={`/admin/people/${person.id}`}
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
        }
        viewContent={
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Imie</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{person.first_name ?? '—'}</p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Nazwisko</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{person.last_name ?? '—'}</p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Pseudonim</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{person.nickname ?? '—'}</p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Data urodzenia</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{formatDate(person.birth_date)}</p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Miasto urodzenia</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{person.birth_city_name ?? '—'}</p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Kraj urodzenia</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{person.birth_country_name ?? '—'}</p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Aktywna osoba</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{person.is_active ? 'Tak' : 'Nie'}</p>
            </div>
          </div>
        }
      />
    </DetailsPageContainer>
  )
}
