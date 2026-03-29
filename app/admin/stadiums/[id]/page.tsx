import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createCityInline } from '@/app/admin/cities/actions'
import { deleteStadium, updateStadium } from '../actions'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import type { AdminCountryOption } from '@/lib/db/cities'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'
import { getAdminCities } from '@/lib/db/clubs'
import { getAdminStadiumDetails } from '@/lib/db/stadiums'
import AdminSelectField from '@/components/admin/AdminSelectField'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import CountryFlag from '@/components/CountryFlag'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

type Params = DetailPageParams
type SearchParams = DetailPageSearchParams

function CityInlineForm({ countries }: { countries: AdminCountryOption[] }) {
  return (
    <div className="space-y-3">
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
          <option value="">- wybierz -</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="inline_city_voivodeship" className="text-xs text-neutral-400">
          Województwo (tylko Polska)
        </label>
        <select
          id="inline_city_voivodeship"
          name="voivodeship"
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">- brak -</option>
          {VOIVODESHIP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default async function AdminStadiumDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams

  const [stadium, cities, countries] = await Promise.all([
    getAdminStadiumDetails(id),
    getAdminCities(),
    getAdminCountriesOptions(),
  ])

  if (!stadium) {
    notFound()
  }

  const isEdit = mode === 'edit'
  const stadiumSummary = [stadium.name, stadium.city_name ? `(${stadium.city_name})` : null]
    .filter(Boolean)
    .join(' ')

  const fields = (
    <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-lg font-semibold text-neutral-100">{stadiumSummary || '—'}</p>
        <CountryFlag
          fifaCode={stadium.country_fifa_code}
          countryName={stadium.country_name ?? '—'}
          className="h-7 w-[42px]"
        />
      </div>

      {isEdit ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="name" className="text-sm font-medium text-neutral-300">
              Nazwa stadionu <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={stadium.name ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <AdminSelectField
              name="stadium_city_id"
              label="Miasto stadionu"
              required
              selectedId={stadium.stadium_city_id}
              options={cities.map((c) => ({ id: c.id, label: c.city_name }))}
              displayKey="label"
              addButtonLabel="+ Dodaj miasto"
              addDialogTitle="Nowe miasto"
              emptyResultsMessage="Brak wyników - możesz dodać nowe miasto poniżej."
              createAction={createCityInline}
              inlineForm={<CityInlineForm countries={countries} />}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-300">Kraj stadionu</label>
            <p className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200">
              {stadium.country_name ?? '—'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={stadium.name ?? '-'}
        backLabel="Powrót do listy stadionów"
        backHref="/admin/stadiums"
        editHref={`/admin/stadiums/${stadium.id}?mode=edit`}
        deleteAction={deleteStadium}
        deleteId={stadium.id}
      />

      <DetailsPageContent
        title={null}
        breadcrumb={null}
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updateStadium} className="space-y-4">
            <input type="hidden" name="id" value={stadium.id} />
            {fields}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={`/admin/stadiums/${stadium.id}`}
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
