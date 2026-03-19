import { notFound } from 'next/navigation'
import {
  createFederationInline,
  deleteCountry,
  updateCountry,
} from '../actions'
import {
  getAdminCountryDetails,
  getAdminFederations,
} from '@/lib/db/countries'
import AdminSelectField from '@/components/admin/AdminSelectField'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

type Params = DetailPageParams
type SearchParams = DetailPageSearchParams

export default async function AdminCountryDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams

  const [country, federations] = await Promise.all([
    getAdminCountryDetails(id),
    getAdminFederations(),
  ])

  if (!country) {
    notFound()
  }

  const isEdit = mode === 'edit'

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={country.name}
        backLabel="Powrot do listy krajow"
        backHref="/admin/countries"
        editHref={`/admin/countries/${country.id}?mode=edit`}
        deleteAction={deleteCountry}
        deleteId={country.id}
      />

      <DetailsPageContent
        title={country.name}
        breadcrumb="Admin / Kraje"
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updateCountry} className="mt-6 space-y-4">
            <input type="hidden" name="id" value={country.id} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-neutral-300">
                Nazwa <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={country.name}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fifa_code" className="text-sm font-medium text-neutral-300">
                  Kod FIFA
                </label>
                <input
                  id="fifa_code"
                  name="fifa_code"
                  type="text"
                  maxLength={3}
                  defaultValue={country.fifa_code ?? ''}
                  className="uppercase rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
              </div>

              <AdminSelectField
                name="federation_id"
                label="Federacja"
                selectedId={country.federation_id}
                options={federations}
                displayKey="short_name"
                addButtonLabel="+ Dodaj federacje"
                addDialogTitle="Nowa federacja"
                emptyResultsMessage="Brak wyników — możesz dodać nową federację poniżej."
                createAction={createFederationInline}
                inlineForm={(
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="inline_fed_short" className="text-xs text-neutral-400">
                          Skrot
                        </label>
                        <input
                          id="inline_fed_short"
                          name="short_name"
                          type="text"
                          required
                          className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="inline_fed_year" className="text-xs text-neutral-400">
                          Rok zalozenia
                        </label>
                        <input
                          id="inline_fed_year"
                          name="foundation_year"
                          type="number"
                          min={1800}
                          max={new Date().getFullYear()}
                          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="inline_fed_full" className="text-xs text-neutral-400">
                        Pelna nazwa
                      </label>
                      <input
                        id="inline_fed_full"
                        name="full_name"
                        type="text"
                        required
                        className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                      />
                    </div>
                  </div>
                )}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <a
                href={`/admin/countries/${country.id}`}
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
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Kod FIFA</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">
                {country.fifa_code ?? '—'}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Federacja</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">
                {country.federation_short_name ?? '—'}
              </p>
            </div>
          </div>
        }
      />
    </DetailsPageContainer>
  )
}
