'use client'

import { useMemo, useState } from 'react'
import CountryFlag from '@/components/CountryFlag'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminPersonListItem } from '@/lib/db/people'
import { getPersonDisplayName } from '@/lib/db/people'
import PitchIcon from '@/components/icons/PitchIcon'
import ClockIcon from '@/components/icons/ClockIcon'
import { GoalIcon, AssistIcon, YellowCardIcon, RedCardIcon } from '@/components/icons'
import BenchIcon from '@/components/icons/BenchIcon'
import SortableStatHeader from '@/components/admin/SortableStatHeader'

export type PeopleCardVariant = 'players' | 'coaches' | 'referees'

function getAgeDisplay(person: AdminPersonListItem): string | null {
  if (!person.birth_date) return null
  const birth = new Date(person.birth_date)
  const ref = person.death_date ? new Date(person.death_date) : new Date()
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return person.death_date ? null : `(${age} l.)`
}

function normalizeText(v: string) {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export default function PublicPeopleSearchTable({
  people,
  basePath = '/people',
  variant = 'players',
  defaultCountryFilter,
}: {
  people: AdminPersonListItem[]
  basePath?: string
  variant?: PeopleCardVariant
  defaultCountryFilter?: string
}) {
  type PlayerSortKey = 'appearance_count' | 'goal_count' | 'assist_count' | 'yellow_card_count' | 'red_card_count' | 'minute_count' | 'bench_count'
  type CoachSortKey = 'coach_match_count' | 'coach_wins' | 'coach_draws' | 'coach_losses' | 'coach_goals_scored' | 'coach_goals_conceded' | 'coach_points_per_match'

  const [sortKey, setSortKey] = useState<PlayerSortKey>('appearance_count')
  const [coachSortKey, setCoachSortKey] = useState<CoachSortKey>('coach_match_count')
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState(defaultCountryFilter ?? '')

  const countryOptions = useMemo(() => {
    const countries = new Set<string>()
    for (const person of people) {
      if (variant === 'coaches') {
        person.coached_country_names.forEach(name => countries.add(name))
      } else {
        person.represented_country_names.forEach(name => countries.add(name))
      }
    }
    return [...countries].sort((a, b) => a.localeCompare(b, 'pl'))
  }, [people, variant])

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    let base = people
    
    // Apply country filter
    if (countryFilter) {
      base = base.filter(p => {
        if (variant === 'coaches') {
          return p.coached_country_names.includes(countryFilter)
        } else {
          return p.represented_country_names.includes(countryFilter) || 
                 (p.represented_country_names.length === 0 && p.birth_country_name === countryFilter)
        }
      })
    }

    // Apply search query
    if (q) {
      base = base.filter((p) => 
        normalizeText(getPersonDisplayName(p) ?? '').includes(q) || 
        normalizeText(p.nickname ?? '').includes(q) ||
        normalizeText(p.birth_country_name ?? '').includes(q) ||
        p.represented_country_names.some(name => normalizeText(name).includes(q)) ||
        p.coached_country_names.some(name => normalizeText(name).includes(q))
      )
    }

    if (variant === 'coaches') {
      return [...base].sort((a, b) => (b[coachSortKey] as number) - (a[coachSortKey] as number))
    }
    if (variant !== 'players') {
      return [...base].sort((a, b) => {
        const aMatches = variant === 'referees' ? a.referee_match_count : a.player_match_count
        const bMatches = variant === 'referees' ? b.referee_match_count : b.player_match_count
        return (b as any)[variant === 'referees' ? 'referee_match_count' : 'player_match_count'] - (a as any)[variant === 'referees' ? 'referee_match_count' : 'player_match_count']
      })
    }
    return [...base].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
  }, [people, query, sortKey, coachSortKey, countryFilter, variant])

  function renderStatBadge(value: number) {
    return value > 0
      ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value}</span>
      : <span className="text-sm text-neutral-600">–</span>
  }

  function renderCoachPointsPerMatchBadge(value: number) {
    return <span className="stat-badge inline-flex min-w-[3rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  }

  return (
    <div className="space-y-3">
      {/* Search bar and filter — blends with green card */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={variant === 'coaches' ? 'Wpisz imię lub nazwisko trenera...' : variant === 'referees' ? 'Wpisz imię lub nazwisko sędziego...' : 'Wpisz imię lub nazwisko gracza...'}
            className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-300/40 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        </div>
        <div className="w-full sm:w-52">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          >
            <option value="">Wszystkie kraje</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* People table */}
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full border-collapse text-sm table-auto">
          <colgroup>
            <col className="w-8" />
            <col className="min-w-[440px]" />
            {variant === 'coaches' ? (
              <>
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[5rem]" />
              </>
            ) : variant === 'referees' ? (
              <col className="w-[4.5rem]" />
            ) : (
              <>
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
              </>
            )}
          </colgroup>

          {/* Header row */}
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
              <th className="px-4 py-3 font-medium text-neutral-400" />
              <th className="px-4 py-3 font-medium text-neutral-400" />
              {variant === 'coaches' ? (
                <>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_match_count'} onClick={() => setCoachSortKey('coach_match_count')} icon={<PitchIcon className="h-5 w-5" />} label="Mecze" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_wins'} onClick={() => setCoachSortKey('coach_wins')} icon={<span className="text-xs font-bold text-emerald-400">Z</span>} label="Zwycięstwa" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_draws'} onClick={() => setCoachSortKey('coach_draws')} icon={<span className="text-xs font-bold text-amber-400">R</span>} label="Remisy" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_losses'} onClick={() => setCoachSortKey('coach_losses')} icon={<span className="text-xs font-bold text-red-400">P</span>} label="Porażki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_goals_scored'} onClick={() => setCoachSortKey('coach_goals_scored')} icon={<span className="text-xs font-bold text-emerald-300">G+</span>} label="Bramki strzelone" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_points_per_match'} onClick={() => setCoachSortKey('coach_points_per_match')} icon={<span className="text-xs font-bold text-sky-300">ŚR.P.</span>} label="Średnia liczba punktów na mecz" />
                  </th>
                </>
              ) : variant === 'referees' ? (
                <th className="px-1 py-3 text-center font-medium text-neutral-400">
                  <span className="inline-flex items-center"><PitchIcon className="h-5 w-5" /></span>
                </th>
              ) : (
                <>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'appearance_count'} onClick={() => setSortKey('appearance_count')} icon={<PitchIcon className="h-5 w-5" />} label="Występy" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'goal_count'} onClick={() => setSortKey('goal_count')} icon={<GoalIcon className="h-5 w-5" />} label="Bramki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'assist_count'} onClick={() => setSortKey('assist_count')} icon={<AssistIcon className="h-5 w-5" />} label="Asysty" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'yellow_card_count'} onClick={() => setSortKey('yellow_card_count')} icon={<YellowCardIcon className="h-5 w-5" />} label="Żółte kartki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'red_card_count'} onClick={() => setSortKey('red_card_count')} icon={<RedCardIcon className="h-5 w-5" />} label="Czerwone kartki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'bench_count'} onClick={() => setSortKey('bench_count')} icon={<BenchIcon className="h-5 w-5" />} label="Ławka rezerwowych" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'minute_count'} onClick={() => setSortKey('minute_count')} icon={<ClockIcon className="h-5 w-5" />} label="Minuty" />
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={variant === 'coaches' ? 8 : variant === 'referees' ? 3 : 9} className="px-4 py-8 text-center text-sm text-neutral-500">
                  {query ? 'Brak osób pasujących do wyszukiwanej frazy.' : 'Brak osób w bazie danych.'}
                </td>
              </tr>
            ) : (
              filtered.map((person, i) => (
                <tr key={person.id} className="table-data-row border-b border-neutral-800 last:border-b-0 bg-neutral-950 transition-colors hover:bg-neutral-900/60">
                  <td className="px-4 py-3 text-neutral-500 text-sm">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {variant === 'coaches' ? (
                        person.coached_country_names.length > 0 ? (
                          <div className="flex items-center gap-0.5">
                            {person.coached_country_names.map((name, idx) => (
                              <CountryFlag
                                key={`${name}-${idx}`}
                                fifaCode={(person.coached_country_fifa_codes?.[idx]) ?? null}
                                countryName={name}
                                className="h-3.5 w-[21px] shrink-0"
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="inline-block h-3.5 w-[21px] shrink-0" />
                        )
                      ) : (
                        person.represented_country_fifa_codes.length > 0 ? (
                          <div className="flex items-center gap-0.5">
                            {person.represented_country_names.map((name, idx) => (
                              <CountryFlag
                                key={`${name}-${idx}`}
                                fifaCode={person.represented_country_fifa_codes[idx] ?? null}
                                countryName={name}
                                className="h-3.5 w-[21px] shrink-0"
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="inline-block h-3.5 w-[21px] shrink-0" />
                        )
                      )}
                      <SmartPrefetchLink
                        href={`${basePath}/${person.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        {getPersonDisplayName(person)}
                        {person.death_date && (
                          <span className="font-black text-neutral-500">&#x2020;</span>
                        )}
                        {getAgeDisplay(person) && (
                          <span className="text-neutral-500 font-normal">{getAgeDisplay(person)}</span>
                        )}
                      </SmartPrefetchLink>
                    </div>
                  </td>
                  {variant === 'coaches' ? (
                    <>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.coach_match_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.coach_wins)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.coach_draws)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.coach_losses)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.coach_goals_scored)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderCoachPointsPerMatchBadge(person.coach_points_per_match)}
                      </td>
                    </>
                  ) : variant === 'referees' ? (
                    <td className="px-1 py-3 text-center">
                      {renderStatBadge(person.referee_match_count)}
                    </td>
                  ) : (
                    <>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.appearance_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.goal_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.assist_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.yellow_card_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.red_card_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.bench_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.minute_count)}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
