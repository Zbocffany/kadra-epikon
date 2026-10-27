'use client'

import { useEffect, useMemo, useState } from 'react'
import MatchesListView from '@/components/matches/MatchesListView'
import type { AdminMatch, MatchYearStatsData } from '@/lib/db/matches'

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
  initialPeriod?: string
  yearStats?: MatchYearStatsData
  globalPolandStats?: {
    totalMatches: number
    wins: number
    draws: number
    losses: number
    goalsScored: number
    goalsConceded: number
  }
}

function decadeStartForYear(year: number): number {
  return Math.floor((year - 1) / 10) * 10 + 1
}

function buildDecades(matches: AdminMatch[]): DecadeFilter[] {
  const years = matches.map((match) => Number(match.match_date.slice(0, 4))).filter(Number.isFinite)
  if (!years.length) return []
  const decades: DecadeFilter[] = []
  for (let start = decadeStartForYear(Math.max(...years)); start >= decadeStartForYear(Math.min(...years)); start -= 10) {
    decades.push({ startYear: start, endYear: start + 9 })
  }
  return decades
}

// Bez parametru (lub z nieznanym) otwiera się najnowsza dekada.
function normalizePeriod(period: string | null | undefined, decades: DecadeFilter[]): string {
  if (period === 'upcoming') return 'upcoming'
  if (period && decades.some((decade) => String(decade.startYear) === period)) return period
  return decades[0] ? String(decades[0].startYear) : 'upcoming'
}

export default function PublicMatchesClient({
  title,
  basePath,
  detailBasePath,
  maxWidthClass,
  matches,
  initialPeriod,
  yearStats,
  globalPolandStats,
}: PublicMatchesClientProps) {
  const decadeFilters = useMemo(() => buildDecades(matches), [matches])
  const [selectedPeriod, setSelectedPeriod] = useState(() => normalizePeriod(initialPeriod, decadeFilters))

  useEffect(() => {
    const onPopState = () => {
      setSelectedPeriod(normalizePeriod(new URLSearchParams(window.location.search).get('period'), decadeFilters))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [decadeFilters])

  function switchPeriod(period: string) {
    if (period === selectedPeriod) return
    setSelectedPeriod(period)
    window.history.pushState(null, '', `${basePath}?period=${period}`)
  }

  const visibleMatches = useMemo(() => {
    if (selectedPeriod === 'upcoming') return matches.filter((match) => match.match_status === 'SCHEDULED')
    const decade = decadeFilters.find((d) => String(d.startYear) === selectedPeriod)
    if (!decade) return []
    const from = `${decade.startYear}-01-01`
    const to = `${decade.endYear}-12-31`
    return matches.filter((match) => match.match_date >= from && match.match_date <= to)
  }, [matches, decadeFilters, selectedPeriod])

  const currentListHref = `${basePath}?period=${selectedPeriod}`

  return (
    <div>
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
        yearStats={yearStats}
        globalPolandStatsOverride={globalPolandStats}
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
