'use client'

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
  decadeFilters: DecadeFilter[]
  selectedPeriod: string
  yearStats?: MatchYearStatsData
}

export default function PublicMatchesClient({
  title,
  basePath,
  detailBasePath,
  maxWidthClass,
  matches,
  decadeFilters,
  selectedPeriod,
  yearStats,
}: PublicMatchesClientProps) {
  const currentListHref =
    selectedPeriod === 'upcoming'
      ? `${basePath}?period=upcoming`
      : `${basePath}?period=${selectedPeriod}`

  return (
    <MatchesListView
      title={title}
      totalMatches={matches.length}
      matches={matches}
      fetchError={null}
      detailBasePath={detailBasePath}
      maxWidthClass={maxWidthClass}
      publicUnifiedSection
      showEditorialStatus={false}
      displayMode={selectedPeriod === 'upcoming' ? 'upcoming' : 'history'}
      buildMatchHref={(match) => `${detailBasePath}/${match.id}?from=${encodeURIComponent(currentListHref)}`}
      yearStats={yearStats}
      leftFilters={[
        {
          key: 'upcoming',
          label: 'Najbliższe',
          isActive: selectedPeriod === 'upcoming',
          href: `${basePath}?period=upcoming`,
        },
        ...decadeFilters.map((decade) => ({
          key: String(decade.startYear),
          label: `${decade.startYear}-${decade.endYear}`,
          isActive: selectedPeriod === String(decade.startYear),
          href: `${basePath}?period=${decade.startYear}`,
        })),
      ]}
    />
  )
}
