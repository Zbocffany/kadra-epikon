'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import MatchesListView from '@/components/matches/MatchesListView'
import type { AdminMatch, MatchYearStatsData } from '@/lib/db/matches'

type Decade = { startYear: number; endYear: number }

function decadeStartForYear(year: number): number {
  return Math.floor((year - 1) / 10) * 10 + 1
}

function buildDecades(matches: AdminMatch[]): Decade[] {
  const years = matches.map((match) => Number(match.match_date.slice(0, 4))).filter(Number.isFinite)
  if (!years.length) return []
  const decades: Decade[] = []
  for (let start = decadeStartForYear(Math.max(...years)); start >= decadeStartForYear(Math.min(...years)); start -= 10) {
    decades.push({ startYear: start, endYear: start + 9 })
  }
  return decades
}

function normalizePeriod(period: string | null | undefined, decades: Decade[]): string {
  if (period && decades.some((decade) => String(decade.startYear) === period)) return period
  return 'upcoming'
}

export default function AdminMatchesClient({
  matches,
  yearStats,
  initialPeriod,
  headerActions,
}: {
  matches: AdminMatch[]
  yearStats: MatchYearStatsData
  initialPeriod?: string
  headerActions?: ReactNode
}) {
  const decades = useMemo(() => buildDecades(matches), [matches])
  const [period, setPeriod] = useState(() => normalizePeriod(initialPeriod, decades))

  useEffect(() => {
    const onPopState = () => {
      setPeriod(normalizePeriod(new URLSearchParams(window.location.search).get('period'), decades))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [decades])

  function selectPeriod(next: string) {
    if (next === period) return
    setPeriod(next)
    window.history.pushState(null, '', `/admin/matches?period=${next}`)
  }

  const visibleMatches = useMemo(() => {
    if (period === 'upcoming') return matches.filter((match) => match.match_status === 'SCHEDULED')
    const decade = decades.find((d) => String(d.startYear) === period)
    if (!decade) return []
    const from = `${decade.startYear}-01-01`
    const to = `${decade.endYear}-12-31`
    return matches.filter((match) => match.match_date >= from && match.match_date <= to)
  }, [matches, decades, period])

  return (
    <MatchesListView
      title="Mecze"
      totalMatches={visibleMatches.length}
      matches={visibleMatches}
      fetchError={null}
      detailBasePath="/admin/matches"
      displayMode={period === 'upcoming' ? 'upcoming' : 'history'}
      yearStats={period === 'upcoming' ? undefined : yearStats}
      leftFilters={[
        {
          key: 'upcoming',
          label: 'Najbliższe',
          isActive: period === 'upcoming',
          onClick: () => selectPeriod('upcoming'),
        },
        ...decades.map((decade) => ({
          key: String(decade.startYear),
          label: `${decade.startYear}-${decade.endYear}`,
          isActive: period === String(decade.startYear),
          onClick: () => selectPeriod(String(decade.startYear)),
        })),
      ]}
      headerActions={headerActions}
    />
  )
}
