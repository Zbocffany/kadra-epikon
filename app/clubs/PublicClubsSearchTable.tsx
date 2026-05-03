'use client'

import { useEffect, useMemo, useState } from 'react'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import type { AdminClub } from '@/lib/db/clubs'
import CountryFlag from '@/components/CountryFlag'
import SortableStatHeader from '@/components/admin/SortableStatHeader'
import PlayerSilhouetteIcon from '@/components/icons/PlayerSilhouetteIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import { GoalIcon } from '@/components/icons'

type SortKey = 'appearance_count' | 'goal_count' | 'player_count'

const STAT_COLS: { key: SortKey; icon: React.ReactNode; tooltip: string }[] = [
  { key: 'player_count',     icon: <PlayerSilhouetteIcon className="h-5 w-5" />, tooltip: 'Liczba graczy' },
  { key: 'appearance_count', icon: <PitchIcon className="h-5 w-5" />,             tooltip: 'Liczba występów' },
  { key: 'goal_count',       icon: <GoalIcon className="h-5 w-5" />,              tooltip: 'Liczba goli' },
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

export default function PublicClubsSearchTable({ clubs }: { clubs: AdminClub[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('appearance_count')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    const withAppearances = clubs.filter((c) => c.appearance_count >= 1)
    const base = q
      ? withAppearances.filter((c) => normalizeText(c.name).includes(q) || normalizeText(c.country_name ?? '').includes(q))
      : withAppearances
    return [...base].sort((a, b) => {
      if (a.appearance_count === 0 && b.appearance_count === 0) return a.name.localeCompare(b.name, 'pl')
      if (a.appearance_count === 0) return 1
      if (b.appearance_count === 0) return -1
      return (b[sortKey] as number) - (a[sortKey] as number)
    })
  }, [clubs, query, sortKey])

  useEffect(() => {
    setVisibleCount(50)
  }, [query, sortKey])

  const displayed = filtered.slice(0, visibleCount)

  return (
    <div className="space-y-3">
      {/* Search bar — blends with green card */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wpisz nazwę klubu..."
          className="w-full max-w-sm rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-300/40 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        />
      </div>

      {/* Clubs table */}
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full border-collapse text-sm table-auto">
          <colgroup><col className="w-8" /><col className="min-w-[440px]" />{STAT_COLS.map((c) => <col key={c.key} className="w-[4.5rem]" />)}</colgroup>

          {/* Header row */}
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
              <th className="px-4 py-3 font-medium text-neutral-400" />
              <th className="px-4 py-3 font-medium text-neutral-400" />
              {STAT_COLS.map((c) => (
                <th key={c.key} className="px-1 py-3 text-center font-medium text-neutral-400">
                  <SortableStatHeader
                    active={sortKey === c.key}
                    onClick={() => setSortKey(c.key)}
                    icon={c.icon}
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
                  {query ? 'Brak klubów pasujących do wyszukiwanej frazy.' : 'Brak klubów.'}
                </td>
              </tr>
            ) : (
              displayed.map((club, i) => (
                <tr key={club.id} className="table-data-row border-b border-neutral-800 last:border-b-0 bg-neutral-950 transition-colors hover:bg-neutral-900/60">
                  <td className="px-4 py-3 text-neutral-500 text-sm">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <CountryFlag fifaCode={club.country_fifa_code} countryName={club.country_name ?? '—'} className="h-3.5 w-[21px] shrink-0" />
                      <SmartPrefetchLink
                        href={`/clubs/${club.id}`}
                        className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        {club.name}
                      </SmartPrefetchLink>
                    </div>
                  </td>
                  {STAT_COLS.map((c) => (
                    <td key={c.key} className="px-1 py-3 text-center">
                      <StatBadge value={club[c.key]} />
                    </td>
                  ))}
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
