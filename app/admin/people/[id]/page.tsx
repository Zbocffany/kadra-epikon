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
import CountryFlag from '@/components/CountryFlag'
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

function getAge(date: string | null): number | null {
  if (!date) return null

  const [yearRaw, monthRaw, dayRaw] = date.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - year
  const hasBirthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day)

  if (!hasBirthdayPassed) {
    age -= 1
  }

  return age >= 0 ? age : null
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
  const birthAge = getAge(person.birth_date)
  const birthDateLabel = person.birth_date
    ? `${formatDate(person.birth_date)}${birthAge !== null ? ` (${birthAge} l.)` : ''}`
    : '—'

  const visibleFlags: { fifaCode: string | null; countryName: string; key: string }[] = []
  const seenFlagKeys = new Set<string>()

  person.represented_country_names.forEach((name, i) => {
    const fifaCode = person.represented_country_fifa_codes[i] ?? null
    const key = `${fifaCode ?? '—'}|${name}`

    if (seenFlagKeys.has(key)) return
    seenFlagKeys.add(key)
    visibleFlags.push({ fifaCode, countryName: name, key: `rep-${key}` })
  })

  const fields = (
    <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-neutral-100">{displayName}</p>
          <p className="mt-0.5 text-sm text-neutral-400">{birthDateLabel}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-400">
            <span>{person.birth_city_name ?? '—'}</span>
            <span>(</span>
            <CountryFlag
              fifaCode={person.birth_country_fifa_code}
              countryName={person.birth_country_name ?? '—'}
              className="h-[13.5px] w-[20px]"
            />
            <span>)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {visibleFlags.map((flag) => (
            <CountryFlag
              key={flag.key}
              fifaCode={flag.fifaCode}
              countryName={flag.countryName}
              className="h-[30px] w-[45px]"
            />
          ))}
        </div>
      </div>

      {isEdit ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="nickname" className="text-sm font-medium text-neutral-300">Pseudonim</label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              defaultValue={person.nickname ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="birth_date" className="text-sm font-medium text-neutral-300">Data urodzenia</label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              defaultValue={person.birth_date ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="sm:col-span-2">
            <PersonBirthplaceFields
              cities={cities}
              countries={countries}
              createCityAction={createCityInline}
              createCountryAction={createCountryInline}
              showBirthDate={false}
              defaultBirthDate={person.birth_date}
              defaultDeathDate={person.death_date}
              defaultCityId={person.birth_city_id}
              defaultCountryId={person.birth_country_id}
              syncScope={syncScope}
            />
          </div>

          <div className="sm:col-span-2">
            <PersonRepresentedCountriesFields
              countries={countries}
              createCountryAction={createCountryInline}
              defaultCountryIds={person.represented_country_ids}
              defaultBirthCountryId={person.birth_country_id}
              syncScope={syncScope}
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={Boolean(person.is_active)}
              className="h-4 w-4"
            />
            <label htmlFor="is_active" className="text-sm text-neutral-300">Aktywna osoba</label>
          </div>
        </div>
      ) : null}
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
        title={null}
        breadcrumb={null}
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
