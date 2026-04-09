'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import GlossyDisclosureCircle from '@/components/admin/GlossyDisclosureCircle'
import CountryFlag from '@/components/CountryFlag'
import type { AdminMatch, EditorialStatus, MatchYearStatsData } from '@/lib/db/matches'

function EditorialStatusBadge({ status }: { status: EditorialStatus }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-neutral-800 text-neutral-400 ring-neutral-600',
    PARTIAL: 'bg-amber-900/50 text-amber-300 ring-amber-700',
    COMPLETE: 'bg-blue-900/50 text-blue-300 ring-blue-700',
    VERIFIED: 'bg-emerald-900/50 text-emerald-300 ring-emerald-700',
  }
  const cls = styles[status] ?? 'bg-neutral-800 text-neutral-400 ring-neutral-600'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  )
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function getCompetitionDisplay(name: string): { label: string; fullName: string; isCompact: boolean } {
  const normalized = name.trim()

  if (normalized === 'Mistrzostwa Świata') {
    return { label: 'MŚ', fullName: normalized, isCompact: false }
  }
  if (normalized === 'Mistrzostwa Europy') {
    return { label: 'ME', fullName: normalized, isCompact: false }
  }
  if (normalized === 'Liga Narodów') {
    return { label: 'LN', fullName: normalized, isCompact: false }
  }
  if (normalized === 'Nieoficjalny') {
    return { label: 'NO', fullName: normalized, isCompact: false }
  }
  if (normalized === 'Towarzyski') {
    return { label: normalized, fullName: normalized, isCompact: false }
  }

  return { label: normalized, fullName: normalized, isCompact: false }
}

function getCompetitionLevelTooltip(competitionName: string, matchLevelName: string | null): string {
  if (!matchLevelName || competitionName === 'Towarzyski' || competitionName === 'Nieoficjalny') {
    return competitionName
  }

  return `${competitionName} - ${matchLevelName}`
}

function getScheduledCountdownLabel(match: AdminMatch): string | null {
  if (match.match_status !== 'SCHEDULED') return null

  const matchDate = new Date(match.match_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  matchDate.setHours(0, 0, 0, 0)

  const diffMs = matchDate.getTime() - today.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Dzisiaj'
  if (days > 0) return `Dni do: ${days}`
  return null
}

function getPolandMatchOutcome(match: AdminMatch): 'WIN' | 'LOSS' | 'DRAW' | null {
  if (!match.final_score) return null

  const scoreMatch = match.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!scoreMatch) return null

  const homeGoals = Number(scoreMatch[1])
  const awayGoals = Number(scoreMatch[2])

  const homeName = (match.home_team_name ?? '').trim().toLowerCase()
  const awayName = (match.away_team_name ?? '').trim().toLowerCase()
  const isPolandHome = homeName.startsWith('polska')
  const isPolandAway = awayName.startsWith('polska')

  if (!isPolandHome && !isPolandAway) return null
  if (homeGoals === awayGoals) return 'DRAW'

  if (isPolandHome) {
    return homeGoals > awayGoals ? 'WIN' : 'LOSS'
  }

  return awayGoals > homeGoals ? 'WIN' : 'LOSS'
}

function getScoreBadgeClass(match: AdminMatch): string {
  const outcome = getPolandMatchOutcome(match)

  if (outcome === 'WIN') return 'border-emerald-500'
  if (outcome === 'LOSS') return 'border-red-500'
  if (outcome === 'DRAW') return 'border-neutral-500'

  return 'border-neutral-400'
}

function renderScoreWithFlags(match: AdminMatch) {
  const label = match.final_score ?? getScheduledCountdownLabel(match)
  if (!label) return null

  const badgeClass = match.final_score
    ? `text-white ${getScoreBadgeClass(match)}`
    : 'border-blue-500 text-blue-400'

  const shootout = match.shootout_score
  let homeShootoutWin = false
  let awayShootoutWin = false
  if (shootout) {
    const m = shootout.match(/(\d+):(\d+)/)
    if (m) {
      const h = Number(m[1])
      const a = Number(m[2])
      homeShootoutWin = h > a
      awayShootoutWin = a > h
    }
  }

  const starClass = 'absolute -top-2.5 z-10 text-[18px] leading-none text-amber-400 select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'

  return (
    <span className="inline-flex items-center gap-[0.5cm]">
      <CountryFlag
        fifaCode={match.home_team_fifa_code}
        countryName={match.home_team_name}
        glossy
        className="h-[22px] w-[33px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]"
      />
      <span className="group/score relative">
        {homeShootoutWin && <span className={`${starClass} -left-3`}>★</span>}
        {awayShootoutWin && <span className={`${starClass} -right-3`}>★</span>}
        <span
          className={`relative inline-flex items-center overflow-hidden rounded-md border bg-black px-2 py-0.5 text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)] ${badgeClass}`}
          style={{ fontSize: '0.95em', fontWeight: 700 }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
          />
          <span className="relative z-10">{label}</span>
        </span>
        {shootout && (
          <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/score:opacity-100">
            Karne {shootout}
          </span>
        )}
      </span>
      <CountryFlag
        fifaCode={match.away_team_fifa_code}
        countryName={match.away_team_name}
        glossy
        className="h-[22px] w-[33px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]"
      />
    </span>
  )
}

function GlossySummaryBadge({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-flex items-center overflow-hidden rounded-md border border-neutral-500/80 bg-neutral-900 px-[11px] py-[5px] text-[13px] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
      />
      <span className="relative z-10">{children}</span>
    </span>
  )
}

type YearPolandResultStats = {
  totalMatches: number
  wins: number
  draws: number
  losses: number
  goalsScored: number
  goalsConceded: number
}

function getPolandGoals(match: AdminMatch): { scored: number; conceded: number } | null {
  if (!match.final_score) return null
  const scoreMatch = match.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!scoreMatch) return null
  const homeGoals = Number(scoreMatch[1])
  const awayGoals = Number(scoreMatch[2])
  const homeName = (match.home_team_name ?? '').trim().toLowerCase()
  const awayName = (match.away_team_name ?? '').trim().toLowerCase()
  const isPolandHome = homeName.startsWith('polska')
  const isPolandAway = awayName.startsWith('polska')
  if (!isPolandHome && !isPolandAway) return null
  return isPolandHome
    ? { scored: homeGoals, conceded: awayGoals }
    : { scored: awayGoals, conceded: homeGoals }
}

function getYearPolandResultStats(yearMatches: AdminMatch[]): YearPolandResultStats {
  let wins = 0
  let draws = 0
  let losses = 0
  let goalsScored = 0
  let goalsConceded = 0

  for (const match of yearMatches) {
    const outcome = getPolandMatchOutcome(match)
    if (outcome === 'WIN') wins += 1
    if (outcome === 'DRAW') draws += 1
    if (outcome === 'LOSS') losses += 1
    const goals = getPolandGoals(match)
    if (goals) {
      goalsScored += goals.scored
      goalsConceded += goals.conceded
    }
  }

  return {
    totalMatches: yearMatches.length,
    wins,
    draws,
    losses,
    goalsScored,
    goalsConceded,
  }
}

function GlossyYearStatsBadge({ stats }: { stats: YearPolandResultStats }) {
  return (
    <span className="relative inline-flex h-[28px] items-center gap-[7px] overflow-hidden rounded-md border border-neutral-500/80 bg-neutral-900 dark:bg-neutral-900 px-[9px] py-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
      />
      <span className="relative z-10 text-[13px] font-black text-white" title="Liczba meczów">{stats.totalMatches}</span>
      <span className="relative z-10 text-[13px] font-black text-white" title="Zwycięstwa-Remisy-Porażki">{stats.wins}-{stats.draws}-{stats.losses}</span>
      <span className="relative z-10 text-[13px] font-black text-neutral-400">({stats.goalsScored}-{stats.goalsConceded})</span>
    </span>
  )
}

type MatchesListViewProps = {
  title?: string
  totalMatches: number
  matches: AdminMatch[]
  fetchError: string | null
  detailBasePath: string
  showEditorialStatus?: boolean
  headerActions?: ReactNode
  displayMode?: 'all' | 'upcoming' | 'history'
  leftFilters?: Array<{ key: string; label: string; href: string; isActive: boolean }>
  yearStats?: MatchYearStatsData
}

export default function MatchesListView({
  title = 'Mecze',
  totalMatches,
  matches,
  fetchError,
  detailBasePath,
  showEditorialStatus = true,
  headerActions,
  displayMode = 'all',
  leftFilters = [],
  yearStats,
}: MatchesListViewProps) {
  const upcomingMatches = [...matches]
    .filter((match) => match.match_status === 'SCHEDULED')
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
  const completedAndOtherMatches = matches.filter((match) => match.match_status !== 'SCHEDULED')
  const matchesByYear = completedAndOtherMatches.reduce<Record<string, AdminMatch[]>>((acc, match) => {
    const year = match.match_date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(match)
    return acc
  }, {})
  const years = Object.keys(matchesByYear).sort((a, b) => Number(b) - Number(a))
  const showUpcomingSection = displayMode !== 'history'
  const showHistorySection = displayMode !== 'upcoming'

  type ActivePanel = 'coaches' | 'appearances' | 'goals' | null
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  function togglePanel(panel: 'coaches' | 'appearances' | 'goals') {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {leftFilters.length > 0 ? (
            <aside className="lg:w-52 lg:shrink-0">
              <div className="flex flex-wrap gap-[11px] lg:flex-col">
                {leftFilters.map((filter) => (
                  <Link
                    key={filter.key}
                    href={filter.href}
                    className="inline-flex"
                    aria-current={filter.isActive ? 'page' : undefined}
                  >
                    <span className={`relative inline-flex items-center overflow-hidden rounded-md border px-[11px] py-[5px] text-[13px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)] ${filter.isActive ? 'border-red-500 bg-red-950 text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.4)]' : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-white'}`}>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
                        />
                        <span className="relative z-10">{filter.label}</span>
                      </span>
                    </Link>
                  ))}
              </div>
            </aside>
          ) : null}

          <div className="min-w-0 flex-1 space-y-6">
            {!fetchError && showUpcomingSection ? (
          <details className="mb-6 group overflow-visible rounded-xl border border-neutral-800 bg-neutral-950">
            <summary className="relative z-20 flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-4 py-2.5 marker:content-none pointer-events-auto">
              <GlossySummaryBadge>Najbliższe mecze</GlossySummaryBadge>
              <span className="inline-flex items-center gap-3">
                <span className="text-xs text-neutral-400">Mecze: {upcomingMatches.length}</span>
                <GlossyDisclosureCircle rotateClassName="group-open:rotate-180" />
              </span>
            </summary>

            <div className="border-t border-neutral-800 bg-neutral-950">
              {upcomingMatches.length === 0 ? (
                <p className="rounded-md px-2 py-2 text-sm text-neutral-500">Brak nadchodzących meczów.</p>
              ) : (
                <div className="relative z-0 overflow-x-auto pt-6 -mt-6">
                  <table className="w-full border-collapse text-sm table-auto">
                    <colgroup>
                      <col className="w-[7.5rem]" />
                      <col className="w-[20rem]" />
                      <col className="w-[14rem]" />
                      <col className="w-[12rem]" />
                      {showEditorialStatus ? <col className="w-[8rem]" /> : null}
                    </colgroup>
                    <tbody>
                      {upcomingMatches.map((match) => {
                        const competition = getCompetitionDisplay(match.competition_name)
                        const showLevel = Boolean(
                          match.match_level_name
                          && match.competition_name !== 'Towarzyski'
                          && match.competition_name !== 'Nieoficjalny'
                        )
                        const matchHref = `${detailBasePath}/${match.id}`

                        return (
                          <tr key={match.id} className="border-t border-neutral-800 bg-neutral-950 transition-colors hover:bg-neutral-900/60">
                            <td className="whitespace-nowrap">
                              <Link href={matchHref} className="block px-3 py-3" aria-label={`Otwórz mecz ${match.home_team_name} - ${match.away_team_name}`}>
                                <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200">
                                  {formatDate(match.match_date)}
                                </span>
                              </Link>
                            </td>
                            <td className="whitespace-nowrap font-semibold text-neutral-100">
                              <Link href={matchHref} className="block pl-1 pr-2 py-3">
                                {match.home_team_name} – {match.away_team_name}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap text-left">
                              <Link href={matchHref} className="block pl-0 pr-2 py-3">
                                {renderScoreWithFlags(match)}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap">
                              <Link href={matchHref} className="block px-8 py-3">
                                <span
                                  title={getCompetitionLevelTooltip(match.competition_name, match.match_level_name)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200"
                                >
                                  <span className={`font-semibold ${competition.isCompact ? 'text-[10px]' : 'text-xs'}`}>
                                    {competition.label}
                                  </span>
                                  {showLevel ? (
                                    <>
                                      <span className="text-[10px] text-neutral-500">/</span>
                                      <span className="text-xs font-semibold text-neutral-200">{match.match_level_name}</span>
                                    </>
                                  ) : null}
                                </span>
                              </Link>
                            </td>
                            {showEditorialStatus ? (
                              <td className="text-right whitespace-nowrap">
                                <Link href={matchHref} className="flex justify-end px-2 py-3">
                                  <span className="inline-flex"><EditorialStatusBadge status={match.editorial_status} /></span>
                                </Link>
                              </td>
                            ) : null}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
            ) : null}

            {fetchError && (
              <div className="rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
                <strong className="font-semibold">Błąd pobierania danych:</strong>{' '}
                {fetchError}
              </div>
            )}

            {!fetchError && matches.length === 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-6 py-16 text-center text-neutral-500">
                Brak meczów w bazie danych.
              </div>
            )}

            {matches.length > 0 && showHistorySection ? (
              <div className="overflow-visible rounded-xl border border-neutral-800">
                {yearStats && (
                  <div className="flex gap-2 border-b border-neutral-800 bg-neutral-950 px-[18px] py-[9px]">
                    {(
                      [
                        { key: 'coaches', label: 'Trenerzy' },
                        { key: 'appearances', label: 'Występy' },
                        { key: 'goals', label: 'Gole' },
                      ] as const
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePanel(key)}
                        className={`relative inline-flex items-center overflow-hidden rounded-md border px-[10px] py-[5px] text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)] ${activePanel === key ? 'border-neutral-500 bg-neutral-700 text-white' : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'}`}
                      >
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
                        />
                        <span className="relative z-10">{label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="divide-y divide-neutral-800">
                  {years.length === 0 && (
                    <div className="px-4 py-5 text-sm text-neutral-500">Brak meczów poza zaplanowanymi na tej stronie.</div>
                  )}
                  {years.map((year) => (
                    <details key={year} className="group bg-neutral-950">
                      <summary className="relative z-20 grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-[14px] bg-neutral-900 px-[18px] py-[9px] marker:content-none pointer-events-auto">
                        <GlossySummaryBadge>{year}</GlossySummaryBadge>
                        <span className="min-w-0 truncate text-center text-[13px] font-black text-neutral-300">
                          {activePanel === 'coaches' && yearStats?.coaches[year]?.map((c, i) => (
                            <span key={c.personId}>{i > 0 ? ', ' : ''}{c.name} ({c.matchCount})</span>
                          ))}
                          {activePanel === 'appearances' && yearStats?.topAppearances[year]?.map((p, i) => (
                            <span key={p.personId}>{i > 0 ? ', ' : ''}{p.name} ({p.matchCount})</span>
                          ))}
                          {activePanel === 'goals' && yearStats?.topScorers[year]?.map((p, i) => (
                            <span key={p.personId}>{i > 0 ? ', ' : ''}{p.name} ({p.goalCount})</span>
                          ))}
                        </span>
                        <span className="inline-flex items-center justify-end gap-3">
                          <GlossyYearStatsBadge stats={getYearPolandResultStats(matchesByYear[year])} />
                          <GlossyDisclosureCircle rotateClassName="group-open:rotate-180" />
                        </span>
                      </summary>

                      <div className="relative z-0 overflow-x-auto pt-6 -mt-6">
                        <table className="w-full border-collapse text-sm table-auto">
                          <colgroup>
                            <col className="w-[7.5rem]" />
                            <col className="w-[20rem]" />
                            <col className="w-[14rem]" />
                            <col className="w-[12rem]" />
                            {showEditorialStatus ? <col className="w-[8rem]" /> : null}
                          </colgroup>
                          <tbody>
                            {matchesByYear[year].map((match) => {
                              const competition = getCompetitionDisplay(match.competition_name)
                              const showLevel = Boolean(
                                match.match_level_name
                                && match.competition_name !== 'Towarzyski'
                                && match.competition_name !== 'Nieoficjalny'
                              )
                              const matchHref = `${detailBasePath}/${match.id}`

                              return (
                                <tr key={match.id} className="border-t border-neutral-800 bg-neutral-950 transition-colors hover:bg-neutral-900/60">
                                  <td className="whitespace-nowrap">
                                    <Link href={matchHref} className="block px-3 py-3" aria-label={`Otwórz mecz ${match.home_team_name} - ${match.away_team_name}`}>
                                      <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200">
                                        {formatDate(match.match_date)}
                                      </span>
                                    </Link>
                                  </td>
                                  <td className="whitespace-nowrap font-semibold text-neutral-100">
                                    <Link href={matchHref} className="block pl-1 pr-2 py-3">
                                      {match.home_team_name} – {match.away_team_name}
                                    </Link>
                                  </td>
                                  <td className="whitespace-nowrap text-left">
                                    <Link href={matchHref} className="block pl-0 pr-2 py-3">
                                      {renderScoreWithFlags(match)}
                                    </Link>
                                  </td>
                                  <td className="whitespace-nowrap">
                                    <Link href={matchHref} className="block px-8 py-3">
                                      <span
                                        title={getCompetitionLevelTooltip(match.competition_name, match.match_level_name)}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200"
                                      >
                                        <span className={`font-semibold ${competition.isCompact ? 'text-[10px]' : 'text-xs'}`}>
                                          {competition.label}
                                        </span>
                                        {showLevel ? (
                                          <>
                                            <span className="text-[10px] text-neutral-500">/</span>
                                            <span className="text-xs font-semibold text-neutral-200">{match.match_level_name}</span>
                                          </>
                                        ) : null}
                                      </span>
                                    </Link>
                                  </td>
                                  {showEditorialStatus ? (
                                    <td className="text-right whitespace-nowrap">
                                      <Link href={matchHref} className="flex justify-end px-2 py-3">
                                        <span className="inline-flex"><EditorialStatusBadge status={match.editorial_status} /></span>
                                      </Link>
                                    </td>
                                  ) : null}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}