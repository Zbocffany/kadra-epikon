'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import type { AdminClub } from '@/lib/db/clubs'
import CountryFlagWithHistory from '@/components/CountryFlagWithHistory'
import SortableStatHeader from '@/components/admin/SortableStatHeader'
import PlayerSilhouetteIcon from '@/components/icons/PlayerSilhouetteIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import { GoalIcon } from '@/components/icons'

export type ClubsListMode = 'all' | 'poland' | 'rivals'

type PolandSortKey = 'appearance_count' | 'goal_count' | 'player_count'
type RivalSortKey = 'rival_appearance_count' | 'rival_goal_count' | 'rival_player_count'
type SortKey = PolandSortKey | RivalSortKey

const POLAND_STAT_COLS: { key: PolandSortKey; icon: React.ReactNode; tooltip: string }[] = [
  { key: 'player_count',     icon: <PlayerSilhouetteIcon className="h-5 w-5" />, tooltip: 'Liczba graczy reprezentacji Polski grających dla klubu' },
  { key: 'appearance_count', icon: <PitchIcon className="h-5 w-5" />,             tooltip: 'Liczba występów dla reprezentacji Polski podczas gry w klubie' },
  { key: 'goal_count',       icon: <GoalIcon className="h-5 w-5" />,              tooltip: 'Liczba goli dla reprezentacji Polski podczas gry w klubie' },
]

const RIVAL_STAT_COLS: { key: RivalSortKey; icon: React.ReactNode; tooltip: string }[] = [
  { key: 'rival_player_count',     icon: <PlayerSilhouetteIcon className="h-5 w-5" />, tooltip: 'Liczba graczy klubu, którzy zagrali przeciw Polsce' },
  { key: 'rival_appearance_count', icon: <PitchIcon className="h-5 w-5" />,             tooltip: 'Liczba występów przeciw Polsce zawodników klubu' },
  { key: 'rival_goal_count',       icon: <GoalIcon className="h-5 w-5" />,              tooltip: 'Liczba goli strzelonych Polsce przez zawodników klubu' },
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

function FoundedYearBadge({ year }: { year: string | null }) {
  if (!year) return <span className="text-sm text-neutral-600">–</span>
  return (
    <span className="stat-badge inline-flex items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-2 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900 whitespace-nowrap">
      Rok założenia: {year}
    </span>
  )
}

function normalizeText(v: string) {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function isClubsListMode(v: string | null): v is ClubsListMode {
  return v === 'all' || v === 'poland' || v === 'rivals'
}

export default function PublicClubsSearchTable({
  clubs,
  initialMode = 'poland',
}: {
  clubs: AdminClub[]
  initialMode?: ClubsListMode
}) {
  const [mode, setMode] = useState<ClubsListMode>(initialMode)
  const [sortKey, setSortKey] = useState<SortKey>('appearance_count')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)
  const hydratedRef = useRef(false)

  // Hydracja trybu z URL (?clubMode=) + obsługa Back/Forward.
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlMode = params.get('clubMode')
    if (isClubsListMode(urlMode) && urlMode !== mode) {
      setMode(urlMode)
      if (urlMode === 'rivals') setSortKey('rival_appearance_count')
      else setSortKey('appearance_count')
    }
    const onPop = () => {
      const p = new URLSearchParams(window.location.search)
      const m = p.get('clubMode')
      const next: ClubsListMode = isClubsListMode(m) ? m : initialMode
      setMode(next)
      setSortKey(next === 'rivals' ? 'rival_appearance_count' : 'appearance_count')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSetMode = (next: ClubsListMode) => {
    setMode(next)
    setVisibleCount(50)
    if (next === 'rivals') setSortKey('rival_appearance_count')
    else setSortKey('appearance_count')
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (next === 'poland') params.delete('clubMode')
    else params.set('clubMode', next)
    const qs = params.toString()
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    window.history.pushState({}, '', url)
  }

  const filtered = useMemo(() => {
    const q = normalizeText(query)

    let base: AdminClub[]
    if (mode === 'poland') {
      base = clubs.filter((c) => c.appearance_count >= 1)
    } else if (mode === 'rivals') {
      base = clubs.filter((c) => c.rival_appearance_count >= 1)
    } else {
      base = clubs
    }

    if (q) {
      base = base.filter(
        (c) => normalizeText(c.name).includes(q) || normalizeText(c.country_name ?? '').includes(q)
      )
    }

    if (mode === 'all') {
      return [...base].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    }

    const activeKey = sortKey
    return [...base].sort((a, b) => {
      const av = (a as unknown as Record<string, number>)[activeKey] ?? 0
      const bv = (b as unknown as Record<string, number>)[activeKey] ?? 0
      if (av === 0 && bv === 0) return a.name.localeCompare(b.name, 'pl')
      if (av === 0) return 1
      if (bv === 0) return -1
      return bv - av
    })
  }, [clubs, query, sortKey, mode])

  useEffect(() => {
    setVisibleCount(50)
  }, [query, sortKey, mode])

  const displayed = filtered.slice(0, visibleCount)

  const statCols = mode === 'rivals' ? RIVAL_STAT_COLS : mode === 'poland' ? POLAND_STAT_COLS : []
  const showStatCols = statCols.length > 0
  const showFoundedYear = mode === 'all'

  const emptyMessage = (() => {
    if (query) return 'Brak klubów pasujących do wyszukiwanej frazy.'
    if (mode === 'rivals') return 'Brak klubów z zawodnikami, którzy grali przeciw Polsce.'
    if (mode === 'poland') return 'Brak klubów z zawodnikami reprezentacji Polski.'
    return 'Brak klubów.'
  })()

  return (
    <div className="space-y-3">
      {/* Search + mode toggle */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Wpisz nazwę klubu..."
            className="w-full max-w-sm rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-300/40 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[24rem]">
          {(['all', 'poland', 'rivals'] as const).map((m) => {
            const label = m === 'all' ? 'Wszystkie' : m === 'poland' ? 'Polska' : 'Rywale'
            const active = mode === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleSetMode(m)}
                aria-pressed={active}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                    : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabela klubów */}
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full border-collapse text-sm table-auto">
          <colgroup>
            <col className="w-8" />
            <col className="min-w-[440px]" />
            {showStatCols && statCols.map((c) => <col key={c.key} className="w-[4.5rem]" />)}
            {showFoundedYear && <col className="w-52" />}
          </colgroup>

          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
              <th className="px-4 py-3 font-medium text-neutral-400" />
              <th className="px-4 py-3 font-medium text-neutral-400" />
              {showStatCols &&
                statCols.map((c) => (
                  <th key={c.key} className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader
                      active={sortKey === c.key}
                      onClick={() => setSortKey(c.key)}
                      icon={c.icon}
                      label={c.tooltip}
                    />
                  </th>
                ))}
              {showFoundedYear && <th className="px-4 py-3 font-medium text-neutral-400" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2 + statCols.length} className="px-4 py-8 text-center text-sm text-neutral-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayed.map((club, i) => (
                <tr key={club.id} className="table-data-row border-b border-neutral-800 last:border-b-0 bg-neutral-950 transition-colors hover:bg-neutral-900/60">
                  <td className="px-4 py-3 text-neutral-500 text-sm">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <CountryFlagWithHistory
                        historicalFifaCode={club.country_fifa_code}
                        historicalCountryName={club.country_name ?? '—'}
                        currentFifaCode={club.country_current_fifa_code}
                        currentCountryName={club.country_current_name}
                        className="h-3.5 w-[21px] shrink-0"
                      />
                      <SmartPrefetchLink
                        href={`/clubs/${club.id}`}
                        className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        {club.name}
                      </SmartPrefetchLink>
                    </div>
                  </td>
                  {showStatCols &&
                    statCols.map((c) => (
                      <td key={c.key} className="px-1 py-3 text-center">
                        <StatBadge value={(club as unknown as Record<string, number>)[c.key] ?? 0} />
                      </td>
                    ))}
                  {showFoundedYear && (
                    <td className="px-4 py-3 text-right">
                      <FoundedYearBadge year={club.founded_year} />
                    </td>
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
