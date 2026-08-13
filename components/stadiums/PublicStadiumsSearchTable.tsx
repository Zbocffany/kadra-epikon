'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import CountryFlag from '@/components/CountryFlag'
import DrawIcon from '@/components/icons/DrawIcon'
import LossIcon from '@/components/icons/LossIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import WinIcon from '@/components/icons/WinIcon'
import { GoalIcon, OwnGoalIcon } from '@/components/icons'
import type { AdminStadiumListItem } from '@/lib/db/stadiums'

type SortKey = 'matches' | 'wins' | 'draws' | 'losses' | 'goals_for' | 'goals_against'

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'matches', label: 'Mecze' },
  { key: 'wins', label: 'Zwycięstwa' },
  { key: 'draws', label: 'Remisy' },
  { key: 'losses', label: 'Porażki' },
  { key: 'goals_for', label: 'Gole strzelone' },
  { key: 'goals_against', label: 'Gole stracone' },
]

function isSortKey(value: string | null): value is SortKey {
  return SORT_OPTIONS.some((option) => option.key === value)
}

function normalize(value: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl')
}

function StatValue({ value }: { value: number }) {
  return value > 0 ? (
    <span className="inline-flex min-w-8 items-center justify-center rounded border border-emerald-200/35 bg-emerald-950/65 px-1.5 py-0.5 font-barlow text-sm font-semibold text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_5px_rgba(0,0,0,0.22)]">
      {value}
    </span>
  ) : (
    <span className="text-emerald-200/45">-</span>
  )
}

export default function PublicStadiumsSearchTable({ stadiums }: { stadiums: AdminStadiumListItem[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [country, setCountry] = useState(() => searchParams.get('country') ?? '')
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const requestedSort = searchParams.get('sort')
    return isSortKey(requestedSort) ? requestedSort : 'matches'
  })

  useEffect(() => {
    function syncFiltersFromUrl() {
      const params = new URLSearchParams(window.location.search)
      const requestedSort = params.get('sort')
      setQuery(params.get('q') ?? '')
      setCountry(params.get('country') ?? '')
      setSortKey(isSortKey(requestedSort) ? requestedSort : 'matches')
    }

    window.addEventListener('popstate', syncFiltersFromUrl)
    return () => window.removeEventListener('popstate', syncFiltersFromUrl)
  }, [])

  function setParam(name: string, value: string, replace = false) {
    const params = new URLSearchParams(window.location.search)
    if (value) params.set(name, value)
    else params.delete(name)
    const href = params.size ? `${pathname}?${params.toString()}` : pathname
    if (name === 'q') setQuery(value)
    else if (name === 'country') setCountry(value)
    else if (name === 'sort' && isSortKey(value)) setSortKey(value)
    window.history[replace ? 'replaceState' : 'pushState'](null, '', href)
  }

  const countries = [...new Set(stadiums.map((stadium) => stadium.country_name).filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right, 'pl'))
  const normalizedQuery = normalize(query)
  const filtered = stadiums
    .filter((stadium) => !country || stadium.country_name === country)
    .filter((stadium) => {
      if (!normalizedQuery) return true
      return [stadium.name, stadium.city_name, stadium.country_name]
        .some((value) => normalize(value).includes(normalizedQuery))
    })
    .sort((left, right) => {
      const statDifference = right[sortKey] - left[sortKey]
      if (statDifference !== 0) return statDifference
      return (left.name ?? '').localeCompare(right.name ?? '', 'pl')
    })

  const headers: Array<{ key: SortKey; label: string; icon: React.ReactNode }> = [
    { key: 'matches', label: 'Mecze', icon: <PitchIcon className="h-5 w-5" /> },
    { key: 'wins', label: 'Zwycięstwa', icon: <WinIcon className="h-5 w-5" /> },
    { key: 'draws', label: 'Remisy', icon: <DrawIcon className="h-5 w-5" /> },
    { key: 'losses', label: 'Porażki', icon: <LossIcon className="h-5 w-5" /> },
    { key: 'goals_for', label: 'Gole strzelone', icon: <GoalIcon className="h-5 w-5" /> },
    { key: 'goals_against', label: 'Gole stracone', icon: <OwnGoalIcon className="h-5 w-5" /> },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setParam('q', event.target.value, true)}
          placeholder="Wpisz stadion, miasto albo kraj..."
          className="min-w-0 flex-1 rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-300/40 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        />
        <select
          value={country}
          onChange={(event) => setParam('country', event.target.value)}
          aria-label="Filtruj stadiony według kraju"
          className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 sm:w-56"
        >
          <option value="">Wszystkie kraje</option>
          {countries.map((countryName) => <option key={countryName} value={countryName}>{countryName}</option>)}
        </select>
        <select
          value={sortKey}
          onChange={(event) => setParam('sort', event.target.value)}
          aria-label="Sortuj stadiony"
          className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 sm:hidden"
        >
          {SORT_OPTIONS.map((option) => <option key={option.key} value={option.key}>Sortuj: {option.label}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between text-xs font-semibold uppercase text-emerald-100/70">
        <span>Stadiony</span>
        <span>{filtered.length} z {stadiums.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-emerald-950/70 bg-emerald-950/32 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-emerald-950/55 text-emerald-100">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Stadion</th>
                {headers.map((header) => (
                  <th key={header.key} className="w-20 px-1 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setParam('sort', header.key)}
                      title={header.label}
                      aria-label={`Sortuj: ${header.label}`}
                      aria-pressed={sortKey === header.key}
                      className={`inline-flex h-8 w-10 items-center justify-center rounded-md border transition ${sortKey === header.key ? 'border-emerald-200/70 bg-emerald-700/70 text-white' : 'border-transparent text-emerald-200/65 hover:border-emerald-400/50 hover:text-white'}`}
                    >
                      {header.icon}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((stadium, index) => (
                <tr key={stadium.id} className={`border-t border-emerald-900/70 text-emerald-50 ${index % 2 === 0 ? 'bg-emerald-950/12' : 'bg-black/10'}`}>
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <CountryFlag fifaCode={stadium.country_fifa_code} countryName={stadium.country_name ?? '-'} className="h-[18px] w-[27px] shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate font-barlow text-sm font-semibold uppercase tracking-[0.04em]">{stadium.name ?? '-'}</div>
                        <div className="truncate text-xs text-emerald-200/65">{[stadium.city_name, stadium.country_name].filter(Boolean).join(', ') || '-'}</div>
                      </div>
                    </div>
                  </td>
                  {headers.map((header) => <td key={header.key} className="px-1 py-2 text-center"><StatValue value={stadium[header.key]} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-emerald-900/70 sm:hidden">
          {filtered.map((stadium) => (
            <article key={stadium.id} className="space-y-3 px-3 py-3 text-emerald-50">
              <div className="flex min-w-0 items-center gap-3">
                <CountryFlag fifaCode={stadium.country_fifa_code} countryName={stadium.country_name ?? '-'} className="h-5 w-[30px] shrink-0" />
                <div className="min-w-0">
                  <h2 className="truncate font-barlow text-sm font-semibold uppercase">{stadium.name ?? '-'}</h2>
                  <p className="truncate text-xs text-emerald-200/65">{[stadium.city_name, stadium.country_name].filter(Boolean).join(', ') || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {headers.map((header) => (
                  <div key={header.key} className="flex min-w-0 flex-col items-center gap-1 rounded-md border border-emerald-800/60 bg-emerald-950/35 px-1 py-1.5" title={header.label}>
                    <span className="text-emerald-200/65">{header.icon}</span>
                    <span className="font-barlow text-sm font-semibold">{stadium[header.key]}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-emerald-100/65">Brak stadionów pasujących do wybranych filtrów.</div>
        ) : null}
      </div>
    </div>
  )
}
