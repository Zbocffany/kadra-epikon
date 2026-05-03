'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import MatchesListView from '@/components/matches/MatchesListView'
import type { AdminMatch, MatchYearStatsData } from '@/lib/db/matches'
import type { PublicMatchesApiResponse } from '@/app/api/public/matches/route'

type DecadeFilter = {
  startYear: number
  endYear: number
}

type PublicMatchesClientProps = {
  title: string
  basePath: string
  detailBasePath: string
  maxWidthClass: string
  matches: AdminMatch[]
  decadeFilters: DecadeFilter[]
  selectedPeriod: string
  yearStats?: MatchYearStatsData
}

export default function PublicMatchesClient({
  title,
  basePath,
  detailBasePath,
  maxWidthClass,
  matches: initialMatches,
  decadeFilters,
  selectedPeriod: initialPeriod,
  yearStats: initialYearStats,
}: PublicMatchesClientProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod)
  const [visibleMatches, setVisibleMatches] = useState(initialMatches)
  const [visibleYearStats, setVisibleYearStats] = useState<MatchYearStatsData | null>(initialYearStats ?? null)
  const [isLoading, setIsLoading] = useState(false)

  // Client-side decade cache — avoids re-fetching already-loaded decades
  const cache = useRef<Map<string, PublicMatchesApiResponse>>(new Map())

  // Seed cache with initial SSR data
  useEffect(() => {
    cache.current.set(initialPeriod, {
      matches: initialMatches,
      yearStats: initialYearStats ?? null,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const switchPeriod = useCallback(async (period: string) => {
    if (period === selectedPeriod) return

    // Instant switch if already cached
    const cached = cache.current.get(period)
    if (cached) {
      setSelectedPeriod(period)
      setVisibleMatches(cached.matches)
      setVisibleYearStats(cached.yearStats)
      const url = period === 'upcoming' ? `${basePath}?period=upcoming` : `${basePath}?period=${period}`
      window.history.pushState(null, '', url)
      return
    }

    // First load: fetch from API
    setIsLoading(true)
    try {
      const res = await fetch(`/api/public/matches?period=${encodeURIComponent(period)}`)
      if (!res.ok) throw new Error('fetch failed')
      const data: PublicMatchesApiResponse = await res.json()
      cache.current.set(period, data)
      setSelectedPeriod(period)
      setVisibleMatches(data.matches)
      setVisibleYearStats(data.yearStats)
      const url = period === 'upcoming' ? `${basePath}?period=upcoming` : `${basePath}?period=${period}`
      window.history.pushState(null, '', url)
    } catch {
      // Fallback: full navigation
      window.location.href =
        period === 'upcoming' ? `${basePath}?period=upcoming` : `${basePath}?period=${period}`
    } finally {
      setIsLoading(false)
    }
  }, [selectedPeriod, basePath])

  const currentListHref =
    selectedPeriod === 'upcoming'
      ? `${basePath}?period=upcoming`
      : `${basePath}?period=${selectedPeriod}`

  return (
    <div className={isLoading ? 'opacity-60 pointer-events-none transition-opacity' : undefined}>
      <MatchesListView
        title={title}
        totalMatches={visibleMatches.length}
        matches={visibleMatches}
        fetchError={null}
        detailBasePath={detailBasePath}
        maxWidthClass={maxWidthClass}
        publicUnifiedSection
        showEditorialStatus={false}
        displayMode={selectedPeriod === 'upcoming' ? 'upcoming' : 'history'}
        buildMatchHref={(match) => `${detailBasePath}/${match.id}?from=${encodeURIComponent(currentListHref)}`}
        yearStats={visibleYearStats ?? undefined}
        leftFilters={[
        {
          key: 'upcoming',
          label: 'Najbliższe',
          isActive: selectedPeriod === 'upcoming',
          onClick: () => switchPeriod('upcoming'),
        },
        ...decadeFilters.map((decade) => ({
          key: String(decade.startYear),
          label: `${decade.startYear}-${decade.endYear}`,
          isActive: selectedPeriod === String(decade.startYear),
          onClick: () => switchPeriod(String(decade.startYear)),
        })),
      ]}
    />
    </div>
  )
}
