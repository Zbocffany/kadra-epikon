import { notFound } from 'next/navigation'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import CountryFlag from '@/components/CountryFlag'
import GlossyDisclosureCircle from '@/components/admin/GlossyDisclosureCircle'
import { getPublicCityProfile, type PublicCityPersonRole } from '@/lib/db/citiesPublic'
import type { DetailPageParams } from '@/lib/types/admin'

export const dynamic = 'force-dynamic'

function formatYear(date: string | null): string {
  if (!date) return '—'
  return date.slice(0, 4)
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return date.slice(0, 10)
}

const ROLE_LABEL: Record<PublicCityPersonRole, string> = {
  PLAYER: 'Piłkarz',
  COACH: 'Trener',
  REFEREE: 'Sędzia',
}

const ROLE_HREF: Record<PublicCityPersonRole, string> = {
  PLAYER: '/players',
  COACH: '/coaches',
  REFEREE: '/referees',
}

const ROLE_BADGE_CLASS: Record<PublicCityPersonRole, string> = {
  PLAYER: 'bg-sky-900/60 text-sky-100 border-sky-700/70',
  COACH: 'bg-amber-900/60 text-amber-100 border-amber-700/70',
  REFEREE: 'bg-fuchsia-900/60 text-fuchsia-100 border-fuchsia-700/70',
}

export default async function PublicCityPage({ params }: { params: DetailPageParams }) {
  const { id } = await params
  const city = await getPublicCityProfile(id)
  if (!city) notFound()

  return (
    <div className="public-theme">
      <main className="min-h-screen px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-[74rem] space-y-6">
          <section className="relative overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] sm:p-6">
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <h1 className="font-barlow text-3xl font-semibold text-emerald-50">{city.city_name}</h1>
                {city.voivodeship && (
                  <p className="mt-1 text-sm text-emerald-200/70">{city.voivodeship}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-emerald-100/80">
                  <span className="rounded-md border border-white/20 bg-slate-950/30 px-2 py-0.5">
                    Osoby: <strong className="font-semibold text-emerald-50">{city.people.length}</strong>
                  </span>
                  <span className="rounded-md border border-white/20 bg-slate-950/30 px-2 py-0.5">
                    Kluby: <strong className="font-semibold text-emerald-50">{city.clubs.length}</strong>
                  </span>
                  <span className="rounded-md border border-white/20 bg-slate-950/30 px-2 py-0.5">
                    Mecze: <strong className="font-semibold text-emerald-50">{city.matches.length}</strong>
                  </span>
                </div>
              </div>
              {city.current_country.current_country_fifa_code && (
                <CountryFlag
                  fifaCode={city.current_country.current_country_fifa_code}
                  countryName={city.current_country.current_country_name ?? '—'}
                  className="h-[33px] w-[50px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]"
                />
              )}
            </div>
          </section>

          {/* Sekcja: Osoby urodzone */}
          <Section title={`Osoby urodzone (${city.people.length})`} defaultOpen>
            {city.people.length === 0 ? (
              <EmptyState text="Brak osób przypisanych do tego miasta." />
            ) : (
              <ul className="divide-y divide-neutral-800">
                {city.people.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <SmartPrefetchLink
                      href={`/people/${p.id}`}
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                    >
                      {p.display_name}
                      {p.death_date && <span className="font-black text-neutral-500">&#x2020;</span>}
                    </SmartPrefetchLink>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      {p.birth_date && <span className="font-mono">{formatYear(p.birth_date)}</span>}
                      <div className="flex gap-1">
                        {p.roles.map((role) => (
                          <SmartPrefetchLink
                            key={role}
                            href={ROLE_HREF[role]}
                            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_BADGE_CLASS[role]}`}
                          >
                            {ROLE_LABEL[role]}
                          </SmartPrefetchLink>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Sekcja: Kluby */}
          <Section title={`Kluby (${city.clubs.length})`} defaultOpen={city.clubs.length > 0}>
            {city.clubs.length === 0 ? (
              <EmptyState text="Brak klubów z tego miasta." />
            ) : (
              <ul className="divide-y divide-neutral-800">
                {city.clubs.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <SmartPrefetchLink
                      href={`/clubs/${c.id}`}
                      className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                    >
                      {c.name}
                    </SmartPrefetchLink>
                    {c.founded_date && (
                      <span className="font-mono text-xs text-neutral-500">
                        zał. {formatYear(c.founded_date)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Sekcja: Mecze */}
          <Section title={`Mecze rozegrane w mieście (${city.matches.length})`}>
            {city.matches.length === 0 ? (
              <EmptyState text="Brak meczów w tym mieście." />
            ) : (
              <ul className="divide-y divide-neutral-800">
                {city.matches.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <SmartPrefetchLink
                      href={`/matches/${m.id}`}
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                    >
                      <span className="font-mono text-neutral-400">{formatDate(m.match_date)}</span>
                      <span className="flex items-center gap-1.5">
                        <CountryFlag
                          fifaCode={m.home_team_fifa_code}
                          countryName={m.home_team_name}
                          className="h-3 w-[18px]"
                        />
                        <span>{m.home_team_name}</span>
                        <span className="text-neutral-500">vs</span>
                        <span>{m.away_team_name}</span>
                        <CountryFlag
                          fifaCode={m.away_team_fifa_code}
                          countryName={m.away_team_name}
                          className="h-3 w-[18px]"
                        />
                      </span>
                    </SmartPrefetchLink>
                    {m.stadium_name && (
                      <span className="text-xs text-neutral-500">{m.stadium_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Sekcja: Linia czasowa krajów */}
          <Section title={`Przynależność do krajów (${city.periods.length})`}>
            {city.periods.length === 0 ? (
              <EmptyState text="Brak wpisów historycznych." />
            ) : (
              <div className="relative flex flex-col">
                {city.periods.map((p, i) => (
                  <div key={p.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                    {i < city.periods.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-neutral-700" />
                    )}
                    <span
                      aria-hidden
                      className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-600 bg-neutral-900"
                    >
                      <span className="h-2 w-2 rounded-full bg-neutral-500" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <CountryFlag
                          fifaCode={p.country_fifa_code}
                          countryName={p.country_name ?? '—'}
                          className="h-5 w-[30px]"
                        />
                        <span className="text-sm font-semibold text-neutral-200">
                          {p.country_name ?? '—'}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-neutral-500">
                        {p.valid_from && p.valid_to
                          ? `${formatYear(p.valid_from)} – ${formatYear(p.valid_to)}`
                          : p.valid_from && !p.valid_to
                          ? `od ${formatYear(p.valid_from)} (obecnie)`
                          : !p.valid_from && p.valid_to
                          ? `do ${formatYear(p.valid_to)}`
                          : 'cały okres'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </main>
    </div>
  )
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <details {...(defaultOpen ? { open: true } : {})} className="overflow-hidden rounded-lg border border-neutral-800 group/det">
        <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-400 marker:content-none">
          <span>{title}</span>
          <GlossyDisclosureCircle rotateClassName="group-open/det:rotate-180" />
        </summary>
        <div className="p-3">{children}</div>
      </details>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-neutral-500">{text}</p>
}
