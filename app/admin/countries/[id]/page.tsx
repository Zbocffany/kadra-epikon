import { notFound } from 'next/navigation'
import {
  addCountryHistoryEvent,
  clearPredecessor,
  clearSuccessor,
  createFederationInline,
  deleteCountry,
  deleteCountryHistoryEvent,
  setPredecessor,
  setSuccessor,
  updateCountry,
} from '../actions'
import {
  getAdminCountries,
  getAdminCountryDetails,
  getAdminFederations,
  getCountryHistory,
  getPredecessorOf,
  getSuccessorOf,
  COUNTRY_HISTORY_EVENT_TYPES,
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

  const [country, federations, allCountries, successor, predecessor, history] = await Promise.all([
    getAdminCountryDetails(id),
    getAdminFederations(),
    getAdminCountries(),
    getSuccessorOf(id),
    getPredecessorOf(id),
    getCountryHistory(id),
  ])

  if (!country) {
    notFound()
  }

  const isEdit = mode === 'edit'
  const otherCountries = allCountries.filter((c) => c.id !== id)

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

      {/* Sukcesja pilkarska */}
      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-5">
          Sukcesja piłkarska
        </p>

        <div className="grid gap-8 sm:grid-cols-2">
          {/* Poprzednik */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Poprzednik</p>
            {predecessor ? (
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm font-medium text-neutral-200">{predecessor.countryName}</span>
                <form action={clearPredecessor}>
                  <input type="hidden" name="country_id" value={id} />
                  <button
                    type="submit"
                    className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
                  >
                    Usuń
                  </button>
                </form>
              </div>
            ) : (
              <p className="mb-3 text-sm text-neutral-500">Brak poprzednika</p>
            )}
            <form action={setPredecessor} className="flex gap-2">
              <input type="hidden" name="country_id" value={id} />
              <select
                name="precountry_id"
                defaultValue={predecessor?.countryId ?? ''}
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              >
                <option value="">— wybierz kraj —</option>
                {otherCountries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-white"
              >
                Ustaw
              </button>
            </form>
          </div>

          {/* Nastepnik */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Następnik</p>
            {successor ? (
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm font-medium text-neutral-200">{successor.countryName}</span>
                <form action={clearSuccessor}>
                  <input type="hidden" name="country_id" value={id} />
                  <button
                    type="submit"
                    className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
                  >
                    Usuń
                  </button>
                </form>
              </div>
            ) : (
              <p className="mb-3 text-sm text-neutral-500">Brak następnika</p>
            )}
            <form action={setSuccessor} className="flex gap-2">
              <input type="hidden" name="country_id" value={id} />
              <select
                name="postcountry_id"
                defaultValue={successor?.countryId ?? ''}
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              >
                <option value="">— wybierz kraj —</option>
                {otherCountries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-white"
              >
                Ustaw
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Historia kraju */}
      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-5">
          Historia piłkarska
        </p>

        {history.length > 0 && (
          <div className="mb-6 space-y-2">
            {history.map((event) => {
              const typeLabel = COUNTRY_HISTORY_EVENT_TYPES.find(
                (t) => t.value === event.event_type
              )?.label ?? event.event_type ?? '—'

              const dateLabel = event.event_date
                ? event.event_date_precision === 'YEAR'
                  ? event.event_date.slice(0, 4)
                  : event.event_date_precision === 'MONTH'
                  ? event.event_date.slice(0, 7)
                  : event.event_date
                : null

              return (
                <div
                  key={event.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {dateLabel && (
                        <span className="text-xs font-mono text-neutral-400">{dateLabel}</span>
                      )}
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                        {typeLabel}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-neutral-200">{event.title}</p>
                    {event.description && (
                      <p className="mt-1 text-xs text-neutral-500">{event.description}</p>
                    )}
                  </div>
                  <form action={deleteCountryHistoryEvent} className="shrink-0">
                    <input type="hidden" name="country_id" value={id} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
                    >
                      Usuń
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        )}

        {history.length === 0 && (
          <p className="mb-5 text-sm text-neutral-500">Brak wpisów w historii.</p>
        )}

        {/* Formularz dodawania */}
        <form action={addCountryHistoryEvent} className="space-y-3 border-t border-neutral-800 pt-5">
          <input type="hidden" name="country_id" value={id} />
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Dodaj zdarzenie
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400">Tytuł <span className="text-red-400">*</span></label>
              <input
                name="title"
                type="text"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400">Typ zdarzenia</label>
              <select
                name="event_type"
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              >
                <option value="">— brak —</option>
                {COUNTRY_HISTORY_EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400">Data zdarzenia</label>
              <input
                name="event_date"
                type="date"
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400">Precyzja daty</label>
              <select
                name="event_date_precision"
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              >
                <option value="DAY">Dzień</option>
                <option value="MONTH">Miesiąc</option>
                <option value="YEAR">Rok</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-neutral-400">Opis</label>
            <textarea
              name="description"
              rows={2}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
            >
              + Dodaj zdarzenie
            </button>
          </div>
        </form>
      </div>
    </DetailsPageContainer>
  )
}
