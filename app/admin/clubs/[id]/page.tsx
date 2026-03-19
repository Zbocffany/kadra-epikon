import { notFound } from 'next/navigation'
import { deleteClub, updateClub } from '../actions'
import { getAdminCities, getAdminClubDetails } from '@/lib/db/clubs'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import CitySelectField from '@/components/admin/CitySelectField'
import { createCityInline } from '@/app/admin/cities/actions'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

type Params = DetailPageParams
type SearchParams = DetailPageSearchParams

export default async function AdminClubDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams

  const [club, cities, countries] = await Promise.all([
    getAdminClubDetails(id),
    getAdminCities(),
    getAdminCountriesOptions(),
  ])

  if (!club) {
    notFound()
  }

  const isEdit = mode === 'edit'

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={club.name}
        backLabel="Powrot do listy klubow"
        backHref="/admin/clubs"
        editHref={`/admin/clubs/${club.id}?mode=edit`}
        deleteAction={deleteClub}
        deleteId={club.id}
      />

      <DetailsPageContent
        title={club.name}
        breadcrumb="Admin / Kluby"
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updateClub} className="mt-6 space-y-4">
            <input type="hidden" name="id" value={club.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-neutral-300">
                  Nazwa <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={club.name}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
              </div>

              <CitySelectField
                name="club_city_id"
                label="Miasto"
                selectedId={club.club_city_id}
                options={cities.map((c) => ({ id: c.id, label: c.city_name }))}
                countryOptions={countries}
                createCityInlineAction={createCityInline}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <a
                href={`/admin/clubs/${club.id}`}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
              >
                Anuluj
              </a>
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
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Miasto</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">
                {club.city_name ?? '—'}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Kraj</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">
                {club.country_name ?? '—'}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Stadion</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">
                {club.stadium_names.length ? club.stadium_names.join(', ') : '—'}
              </p>
            </div>
          </div>
        }
      />
    </DetailsPageContainer>
  )
}
