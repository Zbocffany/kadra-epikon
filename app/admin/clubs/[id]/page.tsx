import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteClub, deleteClubHistoryEvent, saveClubHistoryEvent, updateClub } from '../actions'
import {
  CLUB_HISTORY_EVENT_TYPES,
  getAdminCities,
  getAdminClubDetails,
  getClubHistory,
} from '@/lib/db/clubs'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import { getAdminStadiumOptions } from '@/lib/db/stadiums'
import type { AdminStadiumOption } from '@/lib/db/stadiums'
import AdminSelectField from '@/components/admin/AdminSelectField'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import ClubCityCountryFields from '@/components/admin/ClubCityCountryFields'
import GlossyDisclosureCircle from '@/components/admin/GlossyDisclosureCircle'
import CountryFlag from '@/components/CountryFlag'
import { createCityInline } from '@/app/admin/cities/actions'
import { createStadiumInline } from '@/app/admin/stadiums/actions'
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

function StadiumInlineForm({ cities }: { cities: { id: string; city_name: string }[] }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inline_stadium_name" className="text-xs text-neutral-400">
          Nazwa stadionu
        </label>
        <input
          id="inline_stadium_name"
          name="name"
          type="text"
          required
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="inline_stadium_city" className="text-xs text-neutral-400">
          Miasto stadionu
        </label>
        <select
          id="inline_stadium_city"
          name="stadium_city_id"
          required
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">— wybierz —</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.city_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default async function AdminClubDetailsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { mode, saved, error, history } =
    (await searchParams) as Awaited<SearchParams> & { history?: string }

  const [club, cities, countries, stadiums, historyEvents] = await Promise.all([
    getAdminClubDetails(id),
    getAdminCities(),
    getAdminCountriesOptions(),
    getAdminStadiumOptions(),
    getClubHistory(id),
  ])

  if (!club) {
    notFound()
  }

  const isEdit = mode === 'edit'
  const selectedHistoryEvent = history && history !== 'new'
    ? historyEvents.find((event) => event.id === history) ?? null
    : null
  const isHistoryModalOpen = Boolean(history)
  const isNewHistoryEvent = history === 'new'
  const fields = (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <DetailsFieldCard label="Nazwa klubu" spanTwo>
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
              defaultValue={club.name}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>
        ) : (
          <DetailsFieldValue value={club.name} />
        )}
      </DetailsFieldCard>

      {isEdit ? (
        <DetailsFieldCard label="Miasto / Kraj" spanTwo>
          <ClubCityCountryFields
            cities={cities}
            countries={countries}
            defaultCityId={club.club_city_id}
            createCityAction={createCityInline}
          />
        </DetailsFieldCard>
      ) : (
        <>
          <DetailsFieldCard label="Miasto">
            <DetailsFieldValue value={club.city_name ?? '—'} />
          </DetailsFieldCard>
          <DetailsFieldCard label="Kraj">
            <DetailsFieldValue value={club.country_name ?? '—'} />
          </DetailsFieldCard>
        </>
      )}

      <DetailsFieldCard label="Stadion" spanTwo>
        {isEdit ? (
          <AdminSelectField
            name="stadium_id"
            label="Stadion"
            selectedId={club.stadium_id}
            options={(stadiums as AdminStadiumOption[]).map((s) => ({ id: s.id, label: s.name ?? '—' }))}
            displayKey="label"
            placeholder="Wpisz, aby filtrowac stadiony..."
            addButtonLabel="+ Dodaj stadion"
            addDialogTitle="Nowy stadion"
            emptyResultsMessage="Brak wyników — możesz dodać nowy stadion poniżej."
            createAction={createStadiumInline}
            inlineForm={<StadiumInlineForm cities={cities} />}
          />
        ) : (
          <DetailsFieldValue value={club.stadium_name ?? '—'} />
        )}
      </DetailsFieldCard>
    </div>
  )

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={club.name}
        backLabel="Powrót do listy klubów"
        backHref="/admin/clubs"
        editHref={`/admin/clubs/${club.id}?mode=edit`}
        deleteAction={deleteClub}
        deleteId={club.id}
      />

      <DetailsPageContent
        title={club.name}
        breadcrumb=""
        subtitle={club.city_name ? (
          <span className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-400">
            {club.city_name}
          </span>
        ) : undefined}
        headerRight={club.country_fifa_code ? (
          <CountryFlag fifaCode={club.country_fifa_code} countryName={club.country_name ?? '—'} className="h-10 w-[60px]" />
        ) : undefined}
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updateClub} className="space-y-4">
            <input type="hidden" name="id" value={club.id} />
            {fields}

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
          <>
            <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
              <details open={historyEvents.length > 0} className="overflow-hidden rounded-lg border border-neutral-800 group/det">
                <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-500 marker:content-none">
                  <span>Historia</span>
                  <GlossyDisclosureCircle rotateClassName="group-open/det:rotate-180" />
                </summary>

                <div className="p-3">
                  <div className="mb-4 flex items-center justify-end">
                    <Link
                      href={`/admin/clubs/${id}?history=new`}
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
                            <th className="px-4 py-3 text-right font-medium">Szczegóły</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800 bg-neutral-900/40 text-neutral-200">
                          {historyEvents.map((event) => {
                            return (
                              <tr key={event.id}>
                                <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                                  {formatEventDate(event.event_date, event.event_date_precision)}
                                </td>
                                <td className="px-4 py-3">{event.title ?? '—'}</td>
                                <td className="px-4 py-3 text-right">
                                  <Link
                                    href={`/admin/clubs/${id}?history=${event.id}`}
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
                    <p className="mb-1 text-sm text-neutral-500">Brak wpisów w historii.</p>
                  )}
                </div>
              </details>
            </div>
          </>
        }
      />

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-100">
                {isNewHistoryEvent ? 'Nowe zdarzenie historyczne' : 'Szczegóły zdarzenia'}
              </h2>
            </div>

            <form action={saveClubHistoryEvent} className="space-y-4">
              <input type="hidden" name="club_id" value={id} />
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
                  <label className="text-xs text-neutral-400">
                    Nazwa zdarzenia <span className="text-red-400">*</span>
                  </label>
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
                    {CLUB_HISTORY_EVENT_TYPES.map((t) => (
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
              </div>

              <div className="flex items-center justify-between pt-2">
                {!isNewHistoryEvent && selectedHistoryEvent ? (
                  <ConfirmSubmitButton
                    type="submit"
                    formAction={deleteClubHistoryEvent}
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
                    href={`/admin/clubs/${id}`}
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
