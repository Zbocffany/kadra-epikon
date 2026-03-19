import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteCity, updateCity } from '../actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import {
  getAdminCityDetails,
  getAdminCountriesOptions,
} from '@/lib/db/cities'
import { getAdminFederations } from '@/lib/db/countries'
import CountrySelectField from '@/components/admin/CountrySelectField'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

type Params = DetailPageParams
type SearchParams = DetailPageSearchParams

export default async function AdminCityDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams

  const [city, countries, federations] = await Promise.all([
    getAdminCityDetails(id),
    getAdminCountriesOptions(),
    getAdminFederations(),
  ])

  if (!city) {
    notFound()
  }

  const isEdit = mode === 'edit'

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={city.city_name ?? '—'}
        backLabel="Powrot do listy miast"
        backHref="/admin/cities"
        editHref={`/admin/cities/${city.id}?mode=edit`}
        deleteAction={deleteCity}
        deleteId={city.id}
      />

      <DetailsPageContent
        title={city.city_name ?? '—'}
        breadcrumb="Admin / Miasta"
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updateCity} className="mt-6 space-y-4">
            <input type="hidden" name="id" value={city.id} />
            <input
              type="hidden"
              name="current_period_id"
              value={city.current_period_id ?? ''}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="city_name" className="text-sm font-medium text-neutral-300">
                  Nazwa miasta <span className="text-red-400">*</span>
                </label>
                <input
                  id="city_name"
                  name="city_name"
                  type="text"
                  required
                  defaultValue={city.city_name ?? ''}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
              </div>

              <CountrySelectField
                name="country_id"
                label="Kraj"
                required
                selectedId={city.current_country_id}
                options={countries.map((c) => ({ id: c.id, label: c.name }))}
                federationOptions={federations}
                createCountryInlineAction={createCountryInline}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={`/admin/cities/${city.id}`}
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
          <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Kraj</p>
            <p className="mt-2 text-lg font-semibold text-neutral-100">
              {city.country_name ?? '—'}
            </p>
          </div>
        }
      />
    </DetailsPageContainer>
  )
}
