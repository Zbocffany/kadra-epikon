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
  allMatches: AdminMatch[]
  decadeFilters: DecadeFilter[]
  initialPeriod: string
  yearStats?: MatchYearStatsData
}

export default function PublicMatchesClient({
  title,
  basePath,
  detailBasePath,
  allMatches,
  decadeFilters,
  initialPeriod,
  yearStats,
}: PublicMatchesClientProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod)

  const upcomingMatches = useMemo(
    () => allMatches.filter((match) => match.match_status === 'SCHEDULED'),
    [allMatches]
  )
  const historyMatches = useMemo(
    () => allMatches.filter((match) => match.match_status !== 'SCHEDULED'),
    [allMatches]
  )

  const visibleMatches = useMemo(() => {
    if (selectedPeriod === 'upcoming') {
      return upcomingMatches
    }

    const selectedDecade = decadeFilters.find((decade) => String(decade.startYear) === selectedPeriod)
    if (!selectedDecade) {
      return historyMatches
    }

    const fromDate = `${selectedDecade.startYear}-01-01`
    const toDate = `${selectedDecade.endYear}-12-31`

    return historyMatches.filter((match) => match.match_date >= fromDate && match.match_date <= toDate)
  }, [selectedPeriod, upcomingMatches, historyMatches, decadeFilters])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const nextUrl =
      selectedPeriod === 'upcoming'
        ? `${basePath}?period=upcoming`
        : `${basePath}?period=${selectedPeriod}`

    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [basePath, selectedPeriod])

  return (
    <MatchesListView
      title={title}
      totalMatches={visibleMatches.length}
      matches={visibleMatches}
      fetchError={null}
      detailBasePath={detailBasePath}
      showEditorialStatus={false}
      displayMode={selectedPeriod === 'upcoming' ? 'upcoming' : 'history'}
      yearStats={yearStats}
      leftFilters={[
        {
          key: 'upcoming',
          label: 'Najbliższe',
          isActive: selectedPeriod === 'upcoming',
          onClick: () => setSelectedPeriod('upcoming'),
        },
        ...decadeFilters.map((decade) => ({
          key: String(decade.startYear),
          label: `${decade.startYear}-${decade.endYear}`,
          isActive: selectedPeriod === String(decade.startYear),
          onClick: () => setSelectedPeriod(String(decade.startYear)),
        })),
      ]}
    />
  )
}
