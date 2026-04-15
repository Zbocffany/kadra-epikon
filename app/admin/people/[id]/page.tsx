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
import {
  getAdminMatchesForPlayer,
  getAdminPlayerYearStats,
  getAdminPlayerMatchEventsByMatch,
} from '@/lib/db/matches'
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
import PlayerMatchesByYearSection from '@/components/matches/PlayerMatchesByYearSection'

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

  let playerMatches: Awaited<ReturnType<typeof getAdminMatchesForPlayer>> = []
  let playerYearStats: Awaited<ReturnType<typeof getAdminPlayerYearStats>> = {}
  let playerEventsByMatch: Awaited<ReturnType<typeof getAdminPlayerMatchEventsByMatch>> = {}

  if (person.roles.includes('PLAYER')) {
    ;[playerMatches, playerYearStats] = await Promise.all([
      getAdminMatchesForPlayer(person.id),
      getAdminPlayerYearStats(person.id),
    ])
    playerEventsByMatch = await getAdminPlayerMatchEventsByMatch(
      person.id,
      playerMatches.map((match) => match.id)
    )
  }

  const displayName = getPersonDisplayName(person)
  const isEdit = mode === 'edit'
  const syncScope = `admin-people-edit-${person.id}`
  const birthDateFormatted = person.birth_date ? formatDate(person.birth_date) : '—'

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
          <p className="font-barlow text-2xl font-semibold text-neutral-100">{displayName}</p>
          {!isEdit && (
            <div className="mt-2 flex flex-col items-start gap-2">
              {person.birth_date && (
                <span className="stat-badge inline-flex items-center gap-1.5 rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">
                  {birthDateFormatted}
                  {getAge(person.birth_date) !== null && !person.death_date && (
                    <span className="font-normal text-neutral-500 light:text-neutral-400">({getAge(person.birth_date)} l.)</span>
                  )}
                </span>
              )}
              {person.birth_city_name && (
                <span className="stat-badge inline-flex items-center gap-1.5 rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">
                  {person.birth_city_name}
                  {person.birth_country_fifa_code && (
                    <CountryFlag
                      fifaCode={person.birth_country_fifa_code}
                      countryName={person.birth_country_name ?? '—'}
                      className="h-[13.5px] w-[20px]"
                    />
                  )}
                </span>
              )}
            </div>
          )}
          {isEdit && (
            <div>
              <p className="mt-0.5 text-sm text-neutral-400">
                {birthDateFormatted}
                {person.birth_date && getAge(person.birth_date) !== null && (
                  <> <span className="font-semibold">({getAge(person.birth_date)} l.)</span></>
                )}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-400">
                <span>{person.birth_city_name ?? '—'}</span>
                <CountryFlag
                  fifaCode={person.birth_country_fifa_code}
                  countryName={person.birth_country_name ?? '—'}
                  className="h-[13.5px] w-[20px]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {visibleFlags.map((flag) => (
              <CountryFlag
                key={flag.key}
                fifaCode={flag.fifaCode}
                countryName={flag.countryName}
                className="h-[33px] w-[50px]"
              />
            ))}
          </div>
          {!isEdit && person.roles.includes('PLAYER') && (
            <div className="group/stats relative">
              <span className="stat-badge inline-flex min-w-[2.4rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-2 py-1 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[1.08rem] font-semibold text-neutral-200 light:text-neutral-900">
                {person.appearance_count}<span className="mx-0.5 font-normal text-neutral-500 light:text-neutral-400">/</span>{person.goal_count}
              </span>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/stats:opacity-100">
                <span className="font-normal text-neutral-400">Występy</span> {person.appearance_count} <span className="mx-1 text-neutral-600">/</span> <span className="font-normal text-neutral-400">Gole</span> {person.goal_count}
              </div>
            </div>
          )}
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

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="death_date" className="text-sm font-medium text-neutral-300">Data śmierci</label>
            <input
              id="death_date"
              name="death_date"
              type="date"
              defaultValue={person.death_date ?? ''}
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
        viewContent={
          <>
            {fields}
            {!isEdit && person.roles.includes('PLAYER') && (
              <PlayerMatchesByYearSection
                matches={playerMatches}
                yearStats={playerYearStats}
                eventsByMatch={playerEventsByMatch}
                detailBasePath="/admin/matches"
              />
            )}
          </>
        }
      />
    </DetailsPageContainer>
  )
}
