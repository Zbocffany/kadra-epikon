import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createCityInline } from '@/app/admin/cities/actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import { deletePerson, updatePerson } from '../actions'
import {
  getAdminPersonBirthCityOptions,
  getAdminPersonDetails,
  getPersonDisplayName,
} from '@/lib/db/people'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import { DetailsFieldCard, DetailsFieldValue } from '@/components/admin/DetailsFieldCard'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'
import PersonBirthplaceFields from '@/components/admin/PersonBirthplaceFields'
import PersonRepresentedCountriesFields from '@/components/admin/PersonRepresentedCountriesFields'

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
    getAdminPersonBirthCityOptions(),
    getAdminCountriesOptions(),
  ])

  if (!person) {
    notFound()
  }

  const displayName = getPersonDisplayName(person)
  const isEdit = mode === 'edit'
  const syncScope = `admin-people-edit-${person.id}`
  const fields = (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <DetailsFieldCard label="Imię">
        {isEdit ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="first_name" className="text-sm font-medium text-neutral-300">Imię</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              defaultValue={person.first_name ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>
        ) : (
          <DetailsFieldValue value={person.first_name ?? '—'} />
        )}
      </DetailsFieldCard>

      <DetailsFieldCard label="Nazwisko">
        {isEdit ? (
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
        ) : (
          <DetailsFieldValue value={person.last_name ?? '—'} />
        )}
      </DetailsFieldCard>

      <DetailsFieldCard label="Pseudonim">
        {isEdit ? (
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
        ) : (
          <DetailsFieldValue value={person.nickname ?? '—'} />
        )}
      </DetailsFieldCard>

      <DetailsFieldCard label="Data urodzenia">
        {isEdit ? (
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
        ) : (
          <DetailsFieldValue value={formatDate(person.birth_date)} />
        )}
      </DetailsFieldCard>

      <DetailsFieldCard label="Miejsce urodzenia" spanTwo>
        {isEdit ? (
          <PersonBirthplaceFields
            cities={cities}
            countries={countries}
            createCityAction={createCityInline}
            createCountryAction={createCountryInline}
            showBirthDate={false}
            defaultBirthDate={person.birth_date}
            defaultCityId={person.birth_city_id}
            defaultCountryId={person.birth_country_id}
            syncScope={syncScope}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Miasto</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{person.birth_city_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Kraj</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">{person.birth_country_name ?? '—'}</p>
            </div>
          </div>
        )}
      </DetailsFieldCard>

      <DetailsFieldCard label="Reprezentowane kraje" spanTwo>
        {isEdit ? (
          <PersonRepresentedCountriesFields
            countries={countries}
            createCountryAction={createCountryInline}
            defaultCountryIds={person.represented_country_ids}
            defaultBirthCountryId={person.birth_country_id}
            syncScope={syncScope}
          />
        ) : (
          <DetailsFieldValue
            value={person.represented_country_names.length ? person.represented_country_names.join(', ') : '—'}
          />
        )}
      </DetailsFieldCard>

      <DetailsFieldCard label="Aktywna osoba" spanTwo>
        {isEdit ? (
          <div className="flex items-center gap-2 pt-1">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={Boolean(person.is_active)}
              className="h-4 w-4"
            />
            <label htmlFor="is_active" className="text-sm text-neutral-300">Aktywna osoba</label>
          </div>
        ) : (
          <DetailsFieldValue value={person.is_active ? 'Tak' : 'Nie'} />
        )}
      </DetailsFieldCard>
    </div>
  )

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={displayName}
        backLabel="Powrót do listy ludzi"
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
          <form action={updatePerson} className="space-y-4">
            <input type="hidden" name="id" value={person.id} />
            {fields}
            <p className="text-xs text-neutral-500">Wymagane jest przynajmniej jedno pole: imię, nazwisko lub pseudonim.</p>

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
        viewContent={fields}
      />
    </DetailsPageContainer>
  )
}
