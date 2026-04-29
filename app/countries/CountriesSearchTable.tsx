'use client'

import { useMemo, useState } from 'react'
import SortableStatHeader from '@/components/admin/SortableStatHeader'
import CountryFlag from '@/components/CountryFlag'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import type { PublicCountry } from '@/lib/db/countries'

type SortKey = 'matches' | 'wins' | 'draws' | 'losses' | 'goals_for' | 'goals_against'

const STAT_COLS: { key: SortKey; label: string; tooltip: string }[] = [
  { key: 'matches',      label: 'M',     tooltip: 'Mecze z Polską' },
  { key: 'wins',         label: 'Z',     tooltip: 'Zwycięstwa Polski' },
  { key: 'draws',        label: 'R',     tooltip: 'Remisy' },
  { key: 'losses',       label: 'P',     tooltip: 'Porażki Polski' },
  { key: 'goals_for',    label: 'G+',    tooltip: 'Gole strzelone przez Polskę' },
  { key: 'goals_against',label: 'G-',    tooltip: 'Gole stracone przez Polskę' },
]

function StatBadge({ value }: { value: number }) {
  return value > 0 ? (
    <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">
      {value}
    </span>
  ) : (
    <span className="text-sm text-neutral-600">–</span>
  )
}

function normalizeText(v: string) {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export default function CountriesSearchTable({
  countries,
  poland,
}: {
  countries: PublicCountry[]
  poland: PublicCountry | null
}) {
  const [sortKey, setSortKey] = useState<SortKey>('matches')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    const base = q
      ? countries.filter((c) => normalizeText(c.name).includes(q) || normalizeText(c.fifa_code ?? '').includes(q))
      : countries
    return [...base].sort((a, b) => {
      if (a.matches === 0 && b.matches === 0) return a.name.localeCompare(b.name, 'pl')
      if (a.matches === 0) return 1
      if (b.matches === 0) return -1
      return (b[sortKey] as number) - (a[sortKey] as number)
    })
  }, [countries, query, sortKey])

  return (
    <div className="space-y-3">
      {/* Search bar — blends with green card */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wpisz nazwę kraju..."
          className="w-full max-w-sm rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-300/40 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        />
      </div>

      {/* Shared table — Poland block + countries list, one colgroup */}
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full border-collapse text-sm table-auto">
          <colgroup><col className="w-8" /><col className="min-w-[440px]" />{STAT_COLS.map((c) => <col key={c.key} className="w-[4.5rem]" />)}</colgroup>

          {/* Poland header + row */}
          {poland ? (
            <>
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-400" />
                  <th className="px-4 py-3 font-medium text-neutral-400" />
                  {STAT_COLS.map((c) => (
                    <th key={c.key} className="px-1 py-3 text-center font-medium text-neutral-400">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-emerald-900/70 bg-[linear-gradient(180deg,#1d5c3c_0%,#184c32_18%,#113825_52%,#0a2418_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.45),0_6px_14px_rgba(0,0,0,0.18)]">
                  <td className="px-4 py-3 text-neutral-500" />
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <CountryFlag fifaCode={poland.fifa_code} countryName={poland.name} className="h-3.5 w-[21px] shrink-0" />
                      <SmartPrefetchLink
                        href={`/countries/${poland.id}`}
                        className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        {poland.name}
                      </SmartPrefetchLink>
                    </div>
                  </td>
                  {STAT_COLS.map((c) => (
                    <td key={c.key} className="px-1 py-3 text-center">
                      <StatBadge value={poland[c.key]} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </>
          ) : null}

          {/* Countries header + rows */}
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
              <th className="px-4 py-3 font-medium text-neutral-400" />
              <th className="px-4 py-3 font-medium text-neutral-400" />
              {STAT_COLS.map((c) => (
                <th key={c.key} className="px-1 py-3 text-center font-medium text-neutral-400">
                  <SortableStatHeader
                    active={sortKey === c.key}
                    onClick={() => setSortKey(c.key)}
                    icon={<span className="text-xs font-bold">{c.label}</span>}
                    label={c.tooltip}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2 + STAT_COLS.length} className="px-4 py-8 text-center text-sm text-neutral-500">
                  {query ? 'Brak krajów pasujących do wyszukiwanej frazy.' : 'Brak krajów.'}
                </td>
              </tr>
            ) : (
              filtered.map((country, i) => (
                <tr key={country.id} className="table-data-row border-b border-neutral-800 last:border-b-0 bg-neutral-950 transition-colors hover:bg-neutral-900/60">
                  <td className="px-4 py-3 text-neutral-500 text-sm">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <CountryFlag fifaCode={country.fifa_code} countryName={country.name} className="h-3.5 w-[21px] shrink-0" />
                      <SmartPrefetchLink
                        href={`/countries/${country.id}`}
                        className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        {country.name}
                      </SmartPrefetchLink>
                    </div>
                  </td>
                  {STAT_COLS.map((c) => (
                    <td key={c.key} className="px-1 py-3 text-center">
                      <StatBadge value={country[c.key]} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
