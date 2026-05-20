'use client'

import { useMemo, useState } from 'react'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import CountryFlag from '@/components/CountryFlag'
import type { PublicCityListItem } from '@/lib/db/citiesPublic'

type SortKey = 'person_count' | 'club_count' | 'match_count' | 'name'

function normalizeText(v: string) {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export default function PublicCitiesSearchTable({ cities }: { cities: PublicCityListItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('person_count')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(60)

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    const base = q
      ? cities.filter(
          (c) =>
            normalizeText(c.city_name).includes(q) ||
            normalizeText(c.current_country_name ?? '').includes(q)
        )
      : cities
    return [...base].sort((a, b) => {
      if (sortKey === 'name') return a.city_name.localeCompare(b.city_name, 'pl')
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      if (av !== bv) return bv - av
      return a.city_name.localeCompare(b.city_name, 'pl')
    })
  }, [cities, query, sortKey])

  const displayed = filtered.slice(0, visibleCount)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setVisibleCount(60)
          }}
          placeholder="Wpisz nazwę miasta lub kraju..."
          className="w-full max-w-sm rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-300/40 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        />
        <div className="ml-auto flex items-center gap-1 text-xs">
          {(['person_count', 'club_count', 'match_count', 'name'] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className={`rounded-md border px-2 py-1 font-semibold transition-colors ${
                sortKey === key
                  ? 'border-emerald-400 bg-emerald-700/40 text-emerald-50'
                  : 'border-emerald-800/60 bg-emerald-950/40 text-emerald-200/70 hover:bg-emerald-900/40'
              }`}
            >
              {key === 'person_count' && 'Osoby'}
              {key === 'club_count' && 'Kluby'}
              {key === 'match_count' && 'Mecze'}
              {key === 'name' && 'A-Z'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full border-collapse text-sm table-auto">
          <colgroup>
            <col className="w-8" />
            <col className="min-w-[280px]" />
            <col className="w-[5rem]" />
            <col className="w-[5rem]" />
            <col className="w-[5rem]" />
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-3 py-2 font-medium" />
              <th className="px-3 py-2 font-medium">Miasto</th>
              <th className="px-2 py-2 text-center font-medium">Osoby</th>
              <th className="px-2 py-2 text-center font-medium">Kluby</th>
              <th className="px-2 py-2 text-center font-medium">Mecze</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-500">
                  {query ? 'Brak miast pasujących do wyszukiwanej frazy.' : 'Brak miast.'}
                </td>
              </tr>
            ) : (
              displayed.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-800 last:border-b-0 bg-neutral-950 transition-colors hover:bg-neutral-900/60"
                >
                  <td className="px-3 py-2 text-xs text-neutral-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <CountryFlag
                        fifaCode={c.current_country_fifa_code}
                        countryName={c.current_country_name ?? '—'}
                        className="h-3.5 w-[21px] shrink-0"
                      />
                      <SmartPrefetchLink
                        href={`/cities/${c.id}`}
                        className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        {c.city_name}
                      </SmartPrefetchLink>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums text-neutral-300">
                    {c.person_count > 0 ? c.person_count : <span className="text-neutral-600">–</span>}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums text-neutral-300">
                    {c.club_count > 0 ? c.club_count : <span className="text-neutral-600">–</span>}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums text-neutral-300">
                    {c.match_count > 0 ? c.match_count : <span className="text-neutral-600">–</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {visibleCount < filtered.length && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + 60)}
            className="rounded-md border border-emerald-700/60 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/40"
          >
            Pokaż więcej ({filtered.length - visibleCount} pozostało)
          </button>
        </div>
      )}
    </div>
  )
}
