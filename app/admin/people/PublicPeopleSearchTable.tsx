'use client'

import { useEffect, useMemo, useState } from 'react'
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
type PublicPlayerMode = 'poland' | 'rivals'
type PublicCoachMode = 'poland' | 'rivals'

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
  publicPlayerMode,
  publicCoachMode,
  defaultCountryFilter,
}: {
  people: AdminPersonListItem[]
  basePath?: string
  variant?: PeopleCardVariant
  publicPlayerMode?: PublicPlayerMode
  publicCoachMode?: PublicCoachMode
  defaultCountryFilter?: string
}) {
  type PlayerSortKey = 'appearance_count' | 'goal_count' | 'assist_count' | 'yellow_card_count' | 'red_card_count' | 'minute_count' | 'bench_count'
  type CoachSortKey = 'coach_match_count' | 'coach_wins' | 'coach_draws' | 'coach_losses' | 'coach_goals_scored' | 'coach_goals_conceded' | 'coach_points_per_match'
  type RefereeSortKey = 'referee_match_count' | 'referee_wins' | 'referee_draws' | 'referee_losses' | 'referee_goals_scored' | 'referee_goals_conceded'

  const [sortKey, setSortKey] = useState<PlayerSortKey>('appearance_count')
  const [coachSortKey, setCoachSortKey] = useState<CoachSortKey>('coach_match_count')
  const [refereeSortKey, setRefereeSortKey] = useState<RefereeSortKey>('referee_match_count')
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState(defaultCountryFilter ?? '')
  const [playerMode, setPlayerMode] = useState<PublicPlayerMode>(publicPlayerMode ?? 'poland')
  const [coachMode, setCoachMode] = useState<PublicCoachMode>(publicCoachMode ?? 'poland')
  const [visibleCount, setVisibleCount] = useState(50)
  const isPublicPlayersView = variant === 'players' && Boolean(publicPlayerMode)
  const isPublicCoachesView = variant === 'coaches' && Boolean(publicCoachMode)

  useEffect(() => {
    if (publicPlayerMode) {
      setPlayerMode(publicPlayerMode)
    }
  }, [publicPlayerMode])

  useEffect(() => {
    if (publicCoachMode) {
      setCoachMode(publicCoachMode)
    }
  }, [publicCoachMode])

  const countryOptions = useMemo(() => {
    if (isPublicPlayersView || isPublicCoachesView) return []

    const countries = new Set<string>()
    for (const person of people) {
      if (variant === 'coaches') {
        person.coached_country_names.forEach(name => countries.add(name))
      } else {
        person.represented_country_names.forEach(name => countries.add(name))
      }
    }
    return [...countries].sort((a, b) => a.localeCompare(b, 'pl'))
  }, [people, variant, isPublicPlayersView, isPublicCoachesView])

  const basePeople = useMemo(() => {
    if (isPublicPlayersView) {
      if (playerMode === 'rivals') {
        return people.filter((person) => person.roles.includes('PLAYER') && Boolean(person.has_played_against_poland))
      }

      return people.filter((person) => person.roles.includes('PLAYER') && Boolean(person.has_represented_poland))
    }

    if (isPublicCoachesView) {
      if (coachMode === 'rivals') {
        return people.filter((person) => person.roles.includes('COACH') && Boolean(person.has_coached_against_poland))
      }

      return people.filter((person) => person.roles.includes('COACH') && Boolean(person.has_coached_poland))
    }

    return people
  }, [isPublicPlayersView, isPublicCoachesView, people, playerMode, coachMode])

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    let base = basePeople
    
    // Apply country filter
    if (!isPublicPlayersView && !isPublicCoachesView && countryFilter) {
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
      return [...base].sort((a, b) => getCoachStatValue(b, coachSortKey) - getCoachStatValue(a, coachSortKey))
    }
    if (variant === 'referees') {
      return [...base].sort((a, b) => (b[refereeSortKey] as number) - (a[refereeSortKey] as number))
    }
    if (variant !== 'players') {
      return [...base].sort((a, b) => {
        const aMatches = variant === 'referees' ? a.referee_match_count : a.player_match_count
        const bMatches = variant === 'referees' ? b.referee_match_count : b.player_match_count
        return (b as any)[variant === 'referees' ? 'referee_match_count' : 'player_match_count'] - (a as any)[variant === 'referees' ? 'referee_match_count' : 'player_match_count']
      })
    }
    return [...base].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
  }, [basePeople, query, sortKey, coachSortKey, refereeSortKey, countryFilter, variant, isPublicPlayersView, isPublicCoachesView])

  useEffect(() => {
    setVisibleCount(50)
  }, [query, countryFilter, sortKey, coachSortKey, refereeSortKey, variant, playerMode, coachMode])

  const displayed = filtered.slice(0, visibleCount)

  function renderStatBadge(value: number) {
    return value > 0
      ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value}</span>
      : <span className="text-sm text-neutral-600">–</span>
  }

  function renderCoachPointsPerMatchBadge(value: number) {
    return <span className="stat-badge inline-flex min-w-[3rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  }

  function getCoachStatValue(person: AdminPersonListItem, key: CoachSortKey): number {
    if (!isPublicCoachesView) {
      return person[key]
    }

    if (coachMode === 'poland') {
      if (key === 'coach_match_count') return person.coach_poland_match_count
      if (key === 'coach_wins') return person.coach_poland_wins
      if (key === 'coach_draws') return person.coach_poland_draws
      if (key === 'coach_losses') return person.coach_poland_losses
      if (key === 'coach_goals_scored') return person.coach_poland_goals_scored
      if (key === 'coach_goals_conceded') return person.coach_poland_goals_conceded
      return person.coach_poland_points_per_match
    }

    if (key === 'coach_match_count') return person.coach_against_poland_match_count
    if (key === 'coach_wins') return person.coach_against_poland_wins
    if (key === 'coach_draws') return person.coach_against_poland_draws
    if (key === 'coach_losses') return person.coach_against_poland_losses
    if (key === 'coach_goals_scored') return person.coach_against_poland_goals_scored
    if (key === 'coach_goals_conceded') return person.coach_against_poland_goals_conceded
    return person.coach_against_poland_points_per_match
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
        {isPublicPlayersView ? (
          <div className="grid w-full grid-cols-2 gap-2 sm:w-72">
            <button
              type="button"
              onClick={() => setPlayerMode('poland')}
              aria-pressed={playerMode === 'poland'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${playerMode === 'poland'
                ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
              }`}
            >
              Polska
            </button>
            <button
              type="button"
              onClick={() => setPlayerMode('rivals')}
              aria-pressed={playerMode === 'rivals'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${playerMode === 'rivals'
                ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
              }`}
            >
              Rywale
            </button>
          </div>
        ) : isPublicCoachesView ? (
          <div className="grid w-full grid-cols-2 gap-2 sm:w-72">
            <button
              type="button"
              onClick={() => setCoachMode('poland')}
              aria-pressed={coachMode === 'poland'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${coachMode === 'poland'
                ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
              }`}
            >
              Polska
            </button>
            <button
              type="button"
              onClick={() => setCoachMode('rivals')}
              aria-pressed={coachMode === 'rivals'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${coachMode === 'rivals'
                ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
              }`}
            >
              Rywale
            </button>
          </div>
        ) : (
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
        )}
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
                <col className="w-[4.5rem]" />
                <col className="w-[5rem]" />
              </>
            ) : variant === 'referees' ? (
              <>
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
              </>
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
                    <SortableStatHeader active={coachSortKey === 'coach_match_count'} onClick={() => setCoachSortKey('coach_match_count')} icon={<span className="text-xs font-bold">M</span>} label={coachMode === 'rivals' ? 'Mecze przeciwko Polsce' : 'Mecze'} />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_wins'} onClick={() => setCoachSortKey('coach_wins')} icon={<span className="text-xs font-bold">Z</span>} label="Zwycięstwa" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_draws'} onClick={() => setCoachSortKey('coach_draws')} icon={<span className="text-xs font-bold">R</span>} label="Remisy" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_losses'} onClick={() => setCoachSortKey('coach_losses')} icon={<span className="text-xs font-bold">P</span>} label="Porażki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_goals_scored'} onClick={() => setCoachSortKey('coach_goals_scored')} icon={<span className="text-xs font-bold">G+</span>} label="Bramki strzelone" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_goals_conceded'} onClick={() => setCoachSortKey('coach_goals_conceded')} icon={<span className="text-xs font-bold">G-</span>} label="Bramki stracone" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_points_per_match'} onClick={() => setCoachSortKey('coach_points_per_match')} icon={<span className="text-xs font-bold">ŚR.P.</span>} label="Średnia liczba punktów na mecz" />
                  </th>
                </>
              ) : variant === 'referees' ? (
                <>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_match_count'} onClick={() => setRefereeSortKey('referee_match_count')} icon={<span className="text-xs font-bold">M</span>} label="Mecze" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_wins'} onClick={() => setRefereeSortKey('referee_wins')} icon={<span className="text-xs font-bold">Z</span>} label="Zwycięstwa Polski" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_draws'} onClick={() => setRefereeSortKey('referee_draws')} icon={<span className="text-xs font-bold">R</span>} label="Remisy" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_losses'} onClick={() => setRefereeSortKey('referee_losses')} icon={<span className="text-xs font-bold">P</span>} label="Porażki Polski" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_goals_scored'} onClick={() => setRefereeSortKey('referee_goals_scored')} icon={<span className="text-xs font-bold">G+</span>} label="Bramki strzelone przez Polskę" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_goals_conceded'} onClick={() => setRefereeSortKey('referee_goals_conceded')} icon={<span className="text-xs font-bold">G-</span>} label="Bramki stracone przez Polskę" />
                  </th>
                </>
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
                <td colSpan={variant === 'coaches' ? 9 : variant === 'referees' ? 8 : 9} className="px-4 py-8 text-center text-sm text-neutral-500">
                  {query ? 'Brak osób pasujących do wyszukiwanej frazy.' : 'Brak osób w bazie danych.'}
                </td>
              </tr>
            ) : (
              displayed.map((person, i) => (
                <tr key={person.id} className="table-data-row border-b border-neutral-800 last:border-b-0 bg-neutral-950 transition-colors hover:bg-neutral-900/60">
                  <td className="pl-4 pr-1 py-3 text-neutral-500 text-sm">{i + 1}</td>
                  <td className="pl-1 pr-4 py-3">
                    <div className="flex items-center gap-2.5">
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
                      {variant === 'coaches' ? (
                        isPublicCoachesView && coachMode === 'poland' ? (
                          person.birth_country_name ? (
                            <CountryFlag
                              fifaCode={person.birth_country_fifa_code ?? null}
                              countryName={person.birth_country_name}
                              className="h-3.5 w-[21px] shrink-0"
                            />
                          ) : null
                        ) : person.coached_country_names.length > 0 ? (
                          <div className="flex items-center gap-0.5">
                            {person.coached_country_names
                              .map((name, idx) => ({ name, fifaCode: person.coached_country_fifa_codes?.[idx] ?? null }))
                              .filter((country) => country.name !== 'Polska')
                              .map((country, idx) => (
                                <CountryFlag
                                  key={`${country.name}-${idx}`}
                                  fifaCode={country.fifaCode}
                                  countryName={country.name}
                                  className="h-3.5 w-[21px] shrink-0"
                                />
                              ))}
                          </div>
                        ) : null
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
                              {isPublicPlayersView && playerMode === 'poland' && person.birth_country_name && person.birth_country_name !== 'Polska' && (
                                <>
                                  <span className="mx-0.5 text-neutral-600 text-[10px]">·</span>
                                  <CountryFlag
                                    fifaCode={person.birth_country_fifa_code ?? null}
                                    countryName={person.birth_country_name}
                                    className="h-3.5 w-[21px] shrink-0 opacity-60"
                                  />
                                </>
                              )}
                            </div>
                        ) : null
                      )}
                    </div>
                  </td>
                  {variant === 'coaches' ? (
                    <>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getCoachStatValue(person, 'coach_match_count'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getCoachStatValue(person, 'coach_wins'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getCoachStatValue(person, 'coach_draws'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getCoachStatValue(person, 'coach_losses'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getCoachStatValue(person, 'coach_goals_scored'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getCoachStatValue(person, 'coach_goals_conceded'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderCoachPointsPerMatchBadge(getCoachStatValue(person, 'coach_points_per_match'))}
                      </td>
                    </>
                  ) : variant === 'referees' ? (
                    <>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_match_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_wins)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_draws)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_losses)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_goals_scored)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_goals_conceded)}
                      </td>
                    </>
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

      {filtered.length > visibleCount && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + 50)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            Pokaż kolejne {Math.min(50, filtered.length - visibleCount)}
          </button>
        </div>
      )}
    </div>
  )
}
