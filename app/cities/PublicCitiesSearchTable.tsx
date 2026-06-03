'use client'

import { useEffect, useMemo, useState } from 'react'
import SortableStatHeader from '@/components/admin/SortableStatHeader'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import CountryFlag from '@/components/CountryFlag'
import type { PublicCityListItem } from '@/lib/db/citiesPublic'

type SortKey = 'person_count' | 'club_count' | 'match_count' | 'name'

const STAT_COLS: { key: Exclude<SortKey, 'name'>; label: string; tooltip: string }[] = [
  { key: 'person_count', label: 'Osoby', tooltip: 'Liczba osób z tego miasta' },
  { key: 'club_count', label: 'Kluby', tooltip: 'Liczba klubów z tego miasta' },
  { key: 'match_count', label: 'Mecze', tooltip: 'Liczba meczów rozegranych w tym mieście' },
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

export default function PublicCitiesSearchTable({ cities }: { cities: PublicCityListItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('person_count')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)

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
      if (sortKey === 'name') {
        return a.city_name.localeCompare(b.city_name, 'pl')
      }

      const av = a[sortKey] as number
      const bv = b[sortKey] as number

      if (av === 0 && bv === 0) return a.city_name.localeCompare(b.city_name, 'pl')
      if (av === 0) return 1
      if (bv === 0) return -1
      if (av !== bv) return bv - av

      return a.city_name.localeCompare(b.city_name, 'pl')
    })
  }, [cities, query, sortKey])

  useEffect(() => {
    setVisibleCount(50)
  }, [query, sortKey])

  const displayed = filtered.slice(0, visibleCount)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wpisz nazwę miasta lub kraju..."
          className="w-full max-w-sm rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-300/40 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full border-collapse text-sm table-auto">
          <colgroup>
            <col className="w-8" />
            <col className="min-w-[440px]" />
            {STAT_COLS.map((c) => (
              <col key={c.key} className="w-[6rem]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
              <th className="px-4 py-3 font-medium text-neutral-400" />
              <th className="px-4 py-3 font-medium text-neutral-400">
                <SortableStatHeader
                  active={sortKey === 'name'}
                  onClick={() => setSortKey('name')}
                  icon={<span className="text-xs font-bold">Miasto</span>}
                  label="Sortuj po nazwie miasta"
                />
              </th>
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
                  {query ? 'Brak miast pasujących do wyszukiwanej frazy.' : 'Brak miast.'}
                </td>
              </tr>
            ) : (
              displayed.map((c, i) => (
                <tr
                  key={c.id}
                  className="table-data-row border-b border-neutral-800 last:border-b-0 bg-neutral-950 transition-colors hover:bg-neutral-900/60"
                >
                  <td className="px-4 py-3 text-neutral-500 text-sm">{i + 1}</td>
                  <td className="px-4 py-3">
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
                  <td className="px-1 py-3 text-center">
                    <StatBadge value={c.person_count} />
                  </td>
                  <td className="px-1 py-3 text-center">
                    <StatBadge value={c.club_count} />
                  </td>
                  <td className="px-1 py-3 text-center">
                    <StatBadge value={c.match_count} />
                  </td>
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
