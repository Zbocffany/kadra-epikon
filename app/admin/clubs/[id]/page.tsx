import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteClub, deleteClubHistoryEvent, saveClubHistoryEvent, updateClub } from '../actions'
import {
  CLUB_HISTORY_EVENT_TYPES,
  getAdminCities,
  getAdminClubDetails,
  getAdminClubDetailStats,
  getAdminClubPlayerStats,
  getClubHistory,
  getPublicClubDetails,
  getPublicClubDetailStats,
  getPublicClubHistory,
  getPublicClubPlayerStats,
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
import PlayerSilhouetteIcon from '@/components/icons/PlayerSilhouetteIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import ClockIcon from '@/components/icons/ClockIcon'
import { GoalIcon, AssistIcon } from '@/components/icons'
import PublicClubPlayersTable from '@/components/clubs/PublicClubPlayersTable'
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
  isPublic = false,
}: {
  params: Params
  searchParams: SearchParams
  isPublic?: boolean
}) {
  const { id } = await params
  const { mode, saved, error, history } =
    (await searchParams) as Awaited<SearchParams> & { history?: string }
  const isEdit = !isPublic && mode === 'edit'

  const [club, cities, countries, stadiums, historyEvents, clubStats, clubPlayers] = await Promise.all([
    isPublic ? getPublicClubDetails(id) : getAdminClubDetails(id),
    isEdit ? getAdminCities() : Promise.resolve([]),
    isEdit ? getAdminCountriesOptions() : Promise.resolve([]),
    isEdit ? getAdminStadiumOptions() : Promise.resolve([]),
    isPublic ? getPublicClubHistory(id) : getClubHistory(id),
    isPublic ? getPublicClubDetailStats(id) : getAdminClubDetailStats(id),
    isPublic ? getPublicClubPlayerStats(id) : getAdminClubPlayerStats(id),
  ])

  if (!club) {
    notFound()
  }

  const selectedHistoryEvent = history && history !== 'new'
    ? historyEvents.find((event) => event.id === history) ?? null
    : null
  const isHistoryModalOpen = !isPublic && Boolean(history)
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
        backHref={isPublic ? '/clubs' : '/admin/clubs'}
        showBackButton={!isPublic}
        editHref={`/admin/clubs/${club.id}?mode=edit`}
        deleteAction={deleteClub}
        deleteId={club.id}
        showActions={!isPublic}
      />

      <DetailsPageContent
        title={isPublic ? null : club.name}
        breadcrumb={isPublic ? null : ''}
        subtitle={!isPublic && club.city_name ? (
          <span className="stat-badge inline-flex items-center gap-1.5 rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">
            {club.city_name}
          </span>
        ) : undefined}
        headerRight={!isPublic && club.country_fifa_code ? (
          <CountryFlag fifaCode={club.country_fifa_code} countryName={club.country_name ?? '—'} className="h-10 w-[60px]" />
        ) : undefined}
        containerClassName={isPublic
          ? 'relative overflow-hidden rounded-xl border border-emerald-900/70 bg-[linear-gradient(165deg,#2d7a52_0%,#1e603f_18%,#134b33_40%,#0f3f2b_60%,#0b3423_80%,#08281c_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.34),0_8px_18px_rgba(0,0,0,0.28)]'
          : undefined}
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
            {isPublic ? (
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex flex-col items-start gap-2">
                  <h1 className="font-barlow text-[1.8rem] font-semibold leading-tight text-emerald-50">{club.name}</h1>
                  <span
                    title={`Zawodnicy: ${clubStats.player_count} | Występy-Gole: ${clubStats.appearance_count}-${clubStats.goal_count}`}
                    className="stat-badge inline-flex items-center gap-2 rounded-md border border-white/30 bg-slate-950/35 px-2.5 py-1 font-barlow text-[1.06rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]"
                  >
                    <span>{clubStats.player_count}</span>
                    <span className="mx-2 text-emerald-200/50">|</span>
                    <span>{clubStats.appearance_count}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{clubStats.goal_count}</span>
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {club.country_fifa_code ? (
                    <CountryFlag
                      fifaCode={club.country_fifa_code}
                      countryName={club.country_name ?? '—'}
                      glossy
                      className="h-[33px] w-[50px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]"
                    />
                  ) : null}
                  {(club.country_name || club.city_name) ? (
                    <div className="flex items-center gap-2">
                      {club.city_name ? (
                        <span className="stat-badge inline-flex items-center rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.82rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]">
                          {club.city_name}
                        </span>
                      ) : null}
                      {club.country_name ? (
                        <span className="stat-badge inline-flex items-center rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.82rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]">
                          {club.country_name}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!isPublic ? (
              <div className="mt-4 grid grid-cols-5">
                {([
                  { icon: <PlayerSilhouetteIcon className="h-5 w-5 text-neutral-400" />, label: 'Zawodnicy', value: clubStats.player_count },
                  { icon: <PitchIcon className="h-5 w-5 text-neutral-400" />, label: 'Występy', value: clubStats.appearance_count },
                  { icon: <GoalIcon className="h-5 w-5 text-neutral-400" />, label: 'Gole', value: clubStats.goal_count },
                  { icon: <AssistIcon className="h-5 w-5 text-neutral-400" />, label: 'Asysty', value: clubStats.assist_count },
                  { icon: <ClockIcon className="h-5 w-5 text-neutral-400" />, label: 'Minuty', value: clubStats.minute_count },
                ] as const).map(({ icon, label, value }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 py-3">
                    <span title={label}>{icon}</span>
                    <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-6">
              {isPublic ? (
                <div className="rounded-xl border border-emerald-900/80 bg-emerald-950/30">
                  <div className="border-b border-emerald-900/80 bg-emerald-950/45 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-emerald-100/80">
                    Piłkarze reprezentacji Polski w tym klubie
                  </div>

                  <div className="p-4">
                    {clubPlayers.length > 0 ? (
                      <PublicClubPlayersTable
                        players={clubPlayers}
                        summary={{
                          appearance_count: clubStats.appearance_count,
                          goal_count: clubStats.goal_count,
                          assist_count: clubStats.assist_count,
                          minute_count: clubStats.minute_count,
                        }}
                      />
                    ) : (
                      <p className="mb-1 text-sm text-neutral-500">Brak piłkarzy reprezentacji Polski powiązanych z tym klubem.</p>
                    )}
                  </div>
                </div>
              ) : (
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
              )}
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
