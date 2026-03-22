import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  createCountryInline,
  createFederationInline,
  deleteCountry,
  deleteCountryHistoryEvent,
  saveCountryHistoryEvent,
  updateCountry,
} from '../actions'
import {
  getAdminCountries,
  getAdminCountryDetails,
  getAdminFederations,
  getCountrySuccessions,
  getCountryHistory,
  COUNTRY_HISTORY_EVENT_TYPES,
} from '@/lib/db/countries'
import AdminSelectField from '@/components/admin/AdminSelectField'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import { DetailsFieldCard, DetailsFieldValue } from '@/components/admin/DetailsFieldCard'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

type Params = DetailPageParams
type SearchParams = DetailPageSearchParams

function formatEventDate(date: string | null, precision: 'YEAR' | 'MONTH' | 'DAY' | null): string {
  if (!date) return '—'
  if (precision === 'YEAR') return date.slice(0, 4)
  if (precision === 'MONTH') return date.slice(0, 7)
  return date
}

export default async function AdminCountryDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error, history } =
    (await searchParams) as Awaited<SearchParams> & { history?: string }

  const [country, federations, allCountries, historyEvents, successions] = await Promise.all([
    getAdminCountryDetails(id),
    getAdminFederations(),
    getAdminCountries(),
    getCountryHistory(id),
    getCountrySuccessions(id),
  ])

  if (!country) {
    notFound()
  }

  const isEdit = mode === 'edit'
  const otherCountries = allCountries.filter((c) => c.id !== id)
  const selectedHistoryEvent = history && history !== 'new'
    ? historyEvents.find((event) => event.id === history) ?? null
    : null
  const isHistoryModalOpen = Boolean(history)
  const isNewHistoryEvent = history === 'new'
  const countrySelectOptions = otherCountries.map((c) => ({ id: c.id, label: c.name }))
  const modalPredecessorValue = selectedHistoryEvent
    ? (successions.find(
        (s) => s.source_event_id === selectedHistoryEvent.id && s.postcountry_id === id
      )?.precountry_id ?? '')
    : ''
  const modalSuccessorValue = selectedHistoryEvent
    ? (successions.find(
        (s) => s.source_event_id === selectedHistoryEvent.id && s.precountry_id === id
      )?.postcountry_id ?? '')
    : ''
  const fields = (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <DetailsFieldCard label="Nazwa kraju" spanTwo>
        {isEdit ? (
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
        ) : (
          <DetailsFieldValue value={country.name} />
        )}
      </DetailsFieldCard>

      <DetailsFieldCard label="Kod FIFA">
        {isEdit ? (
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
        ) : (
          <DetailsFieldValue value={country.fifa_code ?? '—'} />
        )}
      </DetailsFieldCard>

      <DetailsFieldCard label="Federacja">
        {isEdit ? (
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
                      Skrót
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
                      Rok założenia
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
                    Pełna nazwa
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
        ) : (
          <DetailsFieldValue value={country.federation_short_name ?? '—'} />
        )}
      </DetailsFieldCard>
    </div>
  )

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={country.name}
        backLabel="Powrót do listy krajów"
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
          <form action={updateCountry} className="space-y-4">
            <input type="hidden" name="id" value={country.id} />
            {fields}

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
        viewContent={fields}
      />

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-5">
          Historia
        </p>

        <div className="mb-4 flex items-center justify-end">
          <Link
            href={`/admin/countries/${id}?history=new`}
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
          >
            + Dodaj zdarzenie
          </Link>
        </div>

        {historyEvents.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-800 text-sm">
              <thead className="bg-neutral-900/80 text-neutral-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Data zdarzenia</th>
                  <th className="px-4 py-3 text-left font-medium">Nazwa zdarzenia</th>
                  <th className="px-4 py-3 text-left font-medium">Typ zdarzenia</th>
                  <th className="px-4 py-3 text-right font-medium">Szczegóły</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 bg-neutral-900/40 text-neutral-200">
                {historyEvents.map((event) => {
                  const typeLabel = COUNTRY_HISTORY_EVENT_TYPES.find(
                    (t) => t.value === event.event_type
                  )?.label ?? event.event_type ?? '—'

                  return (
                    <tr key={event.id}>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                        {formatEventDate(event.event_date, event.event_date_precision)}
                      </td>
                      <td className="px-4 py-3">{event.title ?? '—'}</td>
                      <td className="px-4 py-3 text-neutral-300">{typeLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/countries/${id}?history=${event.id}`}
                          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                        >
                          Pokaż więcej
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-5 text-sm text-neutral-500">Brak wpisów w historii.</p>
        )}
      </div>

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-100">
                {isNewHistoryEvent ? 'Nowe zdarzenie historyczne' : 'Szczegóły zdarzenia'}
              </h2>
            </div>

            <form action={saveCountryHistoryEvent} className="space-y-4">
              <input type="hidden" name="country_id" value={id} />
              {!isNewHistoryEvent && selectedHistoryEvent && (
                <input type="hidden" name="event_id" value={selectedHistoryEvent.id} />
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400">Data zdarzenia</label>
                  <input
                    name="event_date"
                    type="date"
                    defaultValue={selectedHistoryEvent?.event_date ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400">Precyzja</label>
                  <select
                    name="event_date_precision"
                    defaultValue={selectedHistoryEvent?.event_date_precision ?? 'DAY'}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
                  >
                    <option value="DAY">Dzień</option>
                    <option value="MONTH">Miesiąc</option>
                    <option value="YEAR">Rok</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400">Nazwa zdarzenia <span className="text-red-400">*</span></label>
                  <input
                    name="title"
                    type="text"
                    required
                    defaultValue={selectedHistoryEvent?.title ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400">Typ zdarzenia</label>
                  <select
                    name="event_type"
                    defaultValue={selectedHistoryEvent?.event_type ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
                  >
                    <option value="">— brak —</option>
                    {COUNTRY_HISTORY_EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400">Opis</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={selectedHistoryEvent?.description ?? ''}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <AdminSelectField
                    name="predecessor_id"
                    label="Poprzednik"
                    selectedId={modalPredecessorValue}
                    options={countrySelectOptions}
                    displayKey="label"
                    addButtonLabel="+ Dodaj kraj"
                    addDialogTitle="Nowy kraj"
                    emptyResultsMessage="Brak wyników — możesz dodać nowy kraj poniżej."
                    createAction={createCountryInline}
                    inlineForm={(
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="inline_pred_country_name" className="text-xs text-neutral-400">
                            Nazwa <span className="text-red-400">*</span>
                          </label>
                          <input
                            id="inline_pred_country_name"
                            name="name"
                            type="text"
                            required
                            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="inline_pred_country_fifa" className="text-xs text-neutral-400">
                              Kod FIFA
                            </label>
                            <input
                              id="inline_pred_country_fifa"
                              name="fifa_code"
                              type="text"
                              maxLength={3}
                              className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="inline_pred_country_federation" className="text-xs text-neutral-400">
                              Federacja
                            </label>
                            <select
                              id="inline_pred_country_federation"
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
                      </div>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <AdminSelectField
                    name="successor_id"
                    label="Następnik"
                    selectedId={modalSuccessorValue}
                    options={countrySelectOptions}
                    displayKey="label"
                    addButtonLabel="+ Dodaj kraj"
                    addDialogTitle="Nowy kraj"
                    emptyResultsMessage="Brak wyników — możesz dodać nowy kraj poniżej."
                    createAction={createCountryInline}
                    inlineForm={(
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="inline_succ_country_name" className="text-xs text-neutral-400">
                            Nazwa <span className="text-red-400">*</span>
                          </label>
                          <input
                            id="inline_succ_country_name"
                            name="name"
                            type="text"
                            required
                            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="inline_succ_country_fifa" className="text-xs text-neutral-400">
                              Kod FIFA
                            </label>
                            <input
                              id="inline_succ_country_fifa"
                              name="fifa_code"
                              type="text"
                              maxLength={3}
                              className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="inline_succ_country_federation" className="text-xs text-neutral-400">
                              Federacja
                            </label>
                            <select
                              id="inline_succ_country_federation"
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
                      </div>
                    )}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {!isNewHistoryEvent && selectedHistoryEvent ? (
                  <ConfirmSubmitButton
                    type="submit"
                    formAction={deleteCountryHistoryEvent}
                    confirmMessage={selectedHistoryEvent.title
                      ? `Czy na pewno chcesz usunąć zdarzenie "${selectedHistoryEvent.title}"?`
                      : 'Czy na pewno chcesz usunąć to zdarzenie historyczne?'}
                    className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                  >
                    Usuń zdarzenie
                  </ConfirmSubmitButton>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
                  >
                    Zapisz zdarzenie
                  </button>
                  <AdminCancelLink
                    href={`/admin/countries/${id}`}
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
