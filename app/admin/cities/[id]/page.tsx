import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteCity, updateCity, saveCityPeriod, deleteCityPeriod } from '../actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import {
  getAdminCityDetails,
  getAdminCountriesOptions,
  getCityCountryPeriods,
} from '@/lib/db/cities'
import { getAdminFederations } from '@/lib/db/countries'
import AdminSelectField from '@/components/admin/AdminSelectField'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import CountryFlag from '@/components/CountryFlag'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import type { DetailPageParams } from '@/lib/types/admin'

type Params = DetailPageParams
type SearchParams = Promise<{
  mode?: string
  saved?: string
  error?: string
  period?: string
}>

function formatYear(date: string | null): string {
  if (!date) return '—'
  return date.slice(0, 4)
}

export default async function AdminCityDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error, period } = await searchParams

  const [city, countries, federations, periods] = await Promise.all([
    getAdminCityDetails(id),
    getAdminCountriesOptions(),
    getAdminFederations(),
    getCityCountryPeriods(id),
  ])

  if (!city) {
    notFound()
  }

  const isEdit = mode === 'edit'
  const isPeriodModalOpen = Boolean(period)
  const isNewPeriod = period === 'new'
  const selectedPeriod = period && period !== 'new'
    ? periods.find((p) => p.id === period) ?? null
    : null
  const historyPeriods = periods.filter((p) => p.valid_from || p.valid_to)

  const countryOptions = countries.map((c) => ({ id: c.id, label: c.name }))

  const inlineCountryForm = (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inline_country_name" className="text-xs text-neutral-400">
            Nazwa kraju
          </label>
          <input
            id="inline_country_name"
            name="name"
            type="text"
            required
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inline_country_fifa" className="text-xs text-neutral-400">
            Kod FIFA
          </label>
          <input
            id="inline_country_fifa"
            name="fifa_code"
            type="text"
            maxLength={3}
            className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inline_country_federation" className="text-xs text-neutral-400">
          Federacja
        </label>
        <select
          id="inline_country_federation"
          name="federation_id"
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">— brak —</option>
          {federations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.short_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  const fields = (
    <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-neutral-100">
            {city.city_name}
            {city.country_fifa_code ? ` (${city.country_fifa_code})` : ''}
          </p>
          {city.voivodeship && (
            <p className="mt-0.5 text-sm text-neutral-400">{city.voivodeship}</p>
          )}
        </div>
        <CountryFlag
          fifaCode={city.country_fifa_code}
          countryName={city.country_name ?? '—'}
          className="h-7 w-[42px]"
        />
      </div>

      {isEdit ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
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

          <div className="flex flex-col gap-1.5">
            <AdminSelectField
              name="country_id"
              label="Kraj"
              required
              selectedId={city.current_country_id}
              options={countryOptions}
              displayKey="label"
              addButtonLabel="+ Dodaj kraj"
              addDialogTitle="Nowy kraj"
              emptyResultsMessage="Brak wyników — możesz dodać nowy kraj poniżej."
              createAction={createCountryInline}
              inlineForm={inlineCountryForm}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="voivodeship" className="text-sm font-medium text-neutral-300">
              Województwo
            </label>
            <select
              id="voivodeship"
              name="voivodeship"
              defaultValue={city.voivodeship ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            >
              <option value="">— brak —</option>
              {VOIVODESHIP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={city.city_name ?? '—'}
        backLabel="Powrót do listy miast"
        backHref="/admin/cities"
        editHref={`/admin/cities/${city.id}?mode=edit`}
        deleteAction={deleteCity}
        deleteId={city.id}
      />

      <DetailsPageContent
        title={null}
        breadcrumb={null}
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updateCity} className="space-y-4">
            <input type="hidden" name="id" value={city.id} />
            <input
              type="hidden"
              name="current_period_id"
              value={city.current_period_id ?? ''}
            />
            {fields}
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
        viewContent={fields}
      />

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <details open className="overflow-hidden rounded-lg border border-neutral-800 group/det">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-500 marker:content-none">
            <span>Historia</span>
            <span className="text-sm font-bold leading-none text-neutral-400 transition-transform duration-150 group-open/det:rotate-180">▾</span>
          </summary>

          <div className="p-3">
            <div className="mb-4 flex items-center justify-end">
              <Link
                href={`/admin/cities/${id}?period=new`}
                className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
              >
                + Dodaj okres
              </Link>
            </div>

            {historyPeriods.length > 0 ? (
              <div className="relative flex flex-col">
                {historyPeriods.map((p, i) => (
                  <div key={p.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                    {i < historyPeriods.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-neutral-700" />
                    )}
                    <Link
                      href={`/admin/cities/${id}?period=${p.id}`}
                      className="group relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-600 bg-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-800"
                      title="Szczegóły okresu"
                    >
                      <span className="h-2 w-2 rounded-full bg-neutral-500 transition-colors group-hover:bg-neutral-300" />
                    </Link>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <CountryFlag
                          fifaCode={p.country_fifa_code}
                          countryName={p.country_name ?? '—'}
                          className="h-5 w-[30px]"
                        />
                      </div>
                      <span className="font-mono text-xs text-neutral-500">
                        {p.valid_from && p.valid_to
                          ? `${formatYear(p.valid_from)} do ${formatYear(p.valid_to)}`
                          : p.valid_from && !p.valid_to
                          ? `Od ${formatYear(p.valid_from)}`
                          : !p.valid_from && p.valid_to
                          ? `Do ${formatYear(p.valid_to)}`
                          : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-1 text-sm text-neutral-500">Brak wpisów w historii.</p>
            )}
          </div>
        </details>
      </div>

      {isPeriodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-100">
                {isNewPeriod ? 'Nowy okres przynależności' : 'Szczegóły okresu'}
              </h2>
            </div>

            <form action={saveCityPeriod} className="space-y-4">
              <input type="hidden" name="city_id" value={id} />
              {!isNewPeriod && selectedPeriod && (
                <input type="hidden" name="period_id" value={selectedPeriod.id} />
              )}

              <AdminSelectField
                name="country_id"
                label="Kraj"
                required
                selectedId={selectedPeriod?.country_id ?? null}
                options={countryOptions}
                displayKey="label"
                addButtonLabel="+ Dodaj kraj"
                addDialogTitle="Nowy kraj"
                emptyResultsMessage="Brak wyników — możesz dodać nowy kraj poniżej."
                createAction={createCountryInline}
                inlineForm={inlineCountryForm}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400">Od</label>
                  <input
                    name="valid_from"
                    type="date"
                    defaultValue={selectedPeriod?.valid_from ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400">Do</label>
                  <input
                    name="valid_to"
                    type="date"
                    defaultValue={selectedPeriod?.valid_to ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-neutral-400">Opis</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={selectedPeriod?.description ?? ''}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {!isNewPeriod && selectedPeriod ? (
                  <ConfirmSubmitButton
                    type="submit"
                    formAction={deleteCityPeriod}
                    confirmMessage="Czy na pewno chcesz usunąć ten okres przynależności?"
                    className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                  >
                    Usuń okres
                  </ConfirmSubmitButton>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                  >
                    Zapisz okres
                  </button>
                  <AdminCancelLink
                    href={`/admin/cities/${id}`}
                    className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
                  >
                    Anuluj
                  </AdminCancelLink>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </DetailsPageContainer>
  )
}

