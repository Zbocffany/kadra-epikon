'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import GlossyDisclosureCircle from '@/components/admin/GlossyDisclosureCircle'
import CountryFlag from '@/components/CountryFlag'
import PitchIcon from '@/components/icons/PitchIcon'
import type { AdminCoachMatch, AdminCoachYearStats } from '@/lib/db/matches'

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

function getTeamFifaCodeLabel(teamName: string, fifaCode: string | null): string {
  const normalizedCode = fifaCode?.trim().toUpperCase()
  if (normalizedCode) return normalizedCode

  const compactName = teamName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()

  return compactName.slice(0, 3) || '---'
}

function getYearCoachCountries(matches: AdminCoachMatch[]): Array<{ key: string; fifaCode: string | null; countryName: string }> {
  const seen = new Set<string>()
  const countries: Array<{ key: string; fifaCode: string | null; countryName: string }> = []

  for (const match of matches) {
    const countryName = match.coach_is_home === true
      ? match.home_team_name
      : match.coach_is_home === false
        ? match.away_team_name
        : null
    if (!countryName) continue

    const fifaCode = match.coach_team_fifa_code
    const key = `${fifaCode ?? '---'}|${countryName}`
    if (seen.has(key)) continue

    seen.add(key)
    countries.push({ key, fifaCode, countryName })
  }

  return countries
}

function getCoachMatchOutcome(match: AdminCoachMatch): 'WIN' | 'LOSS' | 'DRAW' | null {
  if (!match.final_score || match.coach_is_home === null) return null

  const scoreMatch = match.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!scoreMatch) return null

  const homeGoals = Number(scoreMatch[1])
  const awayGoals = Number(scoreMatch[2])
  const goalsFor = match.coach_is_home ? homeGoals : awayGoals
  const goalsAgainst = match.coach_is_home ? awayGoals : homeGoals

  if (goalsFor > goalsAgainst) return 'WIN'
  if (goalsFor < goalsAgainst) return 'LOSS'
  return 'DRAW'
}

function getScoreBadgeClass(match: AdminCoachMatch): string {
  const outcome = getCoachMatchOutcome(match)

  if (outcome === 'WIN') return 'border-emerald-500'
  if (outcome === 'LOSS') return 'border-red-500'
  if (outcome === 'DRAW') return 'border-neutral-500'

  return 'border-neutral-400'
}

function renderScoreWithFlags(match: AdminCoachMatch, compact = false) {
  const label = match.final_score
  if (!label) return null

  const badgeClass = `text-white ${getScoreBadgeClass(match)}`
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
        className={compact
          ? 'h-[15px] w-[23px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]'
          : 'h-[22px] w-[33px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]'}
      />
      <span className="group/score relative">
        {homeShootoutWin && <span className={`${starClass} -left-3`}>★</span>}
        {awayShootoutWin && <span className={`${starClass} -right-3`}>★</span>}
        <span
          className={`relative inline-flex items-center overflow-hidden rounded-md border bg-black ${compact ? 'px-1.5 py-[0.1rem] text-[0.72rem]' : 'px-2 py-0.5 text-xs'} font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)] ${badgeClass}`}
          style={{ fontSize: compact ? '0.8em' : '0.95em', fontWeight: 700 }}
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
        className={compact
          ? 'h-[15px] w-[23px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]'
          : 'h-[22px] w-[33px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]'}
      />
    </span>
  )
}

function GlossySummaryBadge({ children, highlighted = false }: { children: ReactNode; highlighted?: boolean }) {
  return (
    <span className={highlighted
      ? 'relative inline-flex items-center overflow-hidden rounded-md border border-white/35 bg-slate-950/36 px-[11px] py-[5px] text-[13px] font-black text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_1px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.55),0_4px_8px_rgba(0,0,0,0.3)]'
      : 'relative inline-flex items-center overflow-hidden rounded-md border border-neutral-500/80 bg-neutral-900 px-[11px] py-[5px] text-[13px] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)]'}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
      />
      <span className="relative z-10">{children}</span>
    </span>
  )
}

function YearStatsBadges({ stats, highlighted = false, matchesOnly = false }: { stats: AdminCoachYearStats; highlighted?: boolean; matchesOnly?: boolean }) {
  const matchesValue = stats.match_count
  const resultsValue = `${stats.win_count}-${stats.draw_count}-${stats.loss_count}`
  const goalsValue = `${stats.goals_scored}-${stats.goals_conceded}`
  const pointsAvgValue = stats.match_count > 0 ? stats.points_per_match.toFixed(2) : '-'

  const valueClassName = highlighted
    ? 'stat-badge inline-flex min-w-[2.5rem] items-center justify-center rounded border border-white/30 bg-slate-950/35 px-1.5 py-0.5 shadow-[0_3px_8px_rgba(0,0,0,0.3)] font-barlow text-[0.76rem] font-semibold text-slate-50'
    : 'stat-badge inline-flex min-w-[2.5rem] items-center justify-center rounded border border-neutral-600/60 bg-gradient-to-b from-neutral-700 to-neutral-900 px-1.5 py-0.5 font-barlow text-[0.76rem] font-semibold text-neutral-200'

  if (matchesOnly) {
    return (
      <span className="inline-flex items-center justify-end gap-0.5">
        <PitchIcon className={highlighted ? 'h-4 w-4 text-emerald-200/90' : 'h-4 w-4 text-neutral-400'} />
        <span className={valueClassName}>{matchesValue}</span>
      </span>
    )
  }

  return (
    <span className="inline-grid grid-cols-4 items-center justify-items-end gap-x-2 gap-y-1">
      <span className="inline-flex items-center justify-end gap-0.5">
        <PitchIcon className={highlighted ? 'h-4 w-4 text-emerald-200/90' : 'h-4 w-4 text-neutral-400'} />
        <span className={valueClassName}>{matchesValue}</span>
      </span>

      <span className={valueClassName}>{resultsValue}</span>
      <span className={valueClassName}>{goalsValue}</span>
      <span className={valueClassName}>{pointsAvgValue}</span>
    </span>
  )
}

type CoachMatchesByYearSectionProps = {
  matches: AdminCoachMatch[]
  yearStats: Record<string, AdminCoachYearStats>
  detailBasePath: string
  title?: string
  highlighted?: boolean
  showYearCoachFlags?: boolean
  emptyMessage?: string
  yearStatsMatchesOnly?: boolean
  defaultExpanded?: boolean
}

export default function CoachMatchesByYearSection({ matches, yearStats, detailBasePath, title = 'MECZE', highlighted = false, showYearCoachFlags = false, emptyMessage = 'Brak meczów prowadzonych przez tego trenera.', yearStatsMatchesOnly = false, defaultExpanded = true }: CoachMatchesByYearSectionProps) {
  const matchesByYear = matches.reduce<Record<string, AdminCoachMatch[]>>((acc, match) => {
    const year = match.match_date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(match)
    return acc
  }, {})
  const years = Object.keys(matchesByYear).sort((a, b) => Number(b) - Number(a))

  return (
    <div
      className={highlighted
        ? 'relative mt-6 overflow-hidden rounded-xl border border-emerald-900/70 bg-[linear-gradient(165deg,#2d7a52_0%,#1e603f_18%,#134b33_40%,#0f3f2b_60%,#0b3423_80%,#08281c_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.34),0_8px_18px_rgba(0,0,0,0.28)]'
        : 'mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6'}
    >
      {highlighted ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.05)_30%,rgba(0,0,0,0.16)_100%)]" />
      ) : null}
      <details open={defaultExpanded && matches.length > 0} className={highlighted ? 'relative z-10 overflow-hidden rounded-lg border border-emerald-900/80 group/det' : 'overflow-hidden rounded-lg border border-neutral-800 group/det'}>
        <summary className={highlighted ? 'flex cursor-pointer list-none items-center justify-between bg-emerald-950/45 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-emerald-100/80 marker:content-none' : 'flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-500 marker:content-none'}>
          <span>{title}</span>
          <GlossyDisclosureCircle rotateClassName="group-open/det:rotate-180" />
        </summary>

        <div className="divide-y divide-neutral-800">
          {years.length === 0 ? (
            <div className="px-4 py-5 text-sm text-neutral-500">{emptyMessage}</div>
          ) : (
            years.map((year) => (
              <details key={year} className={highlighted ? 'group/year bg-emerald-950/20' : 'group/year bg-neutral-950'}>
                <summary className={highlighted
                  ? 'relative z-20 grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_1.25rem] items-center gap-3 border-t border-emerald-900/70 bg-emerald-950/38 px-3 py-2 marker:content-none pointer-events-auto'
                  : 'relative z-20 grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_1.25rem] items-center gap-3 bg-neutral-900 px-3 py-2 marker:content-none pointer-events-auto'}>
                  <GlossySummaryBadge highlighted={highlighted}>{year}</GlossySummaryBadge>
                  <div className="mr-2 min-w-0 flex items-center gap-2">
                    {showYearCoachFlags ? (
                      <span className="inline-flex shrink-0 items-center gap-1">
                        {getYearCoachCountries(matchesByYear[year]).map((country) => (
                          <CountryFlag
                            key={country.key}
                            fifaCode={country.fifaCode}
                            countryName={country.countryName}
                            className={highlighted ? 'h-[15px] w-[23px]' : 'h-[15px] w-[23px]'}
                          />
                        ))}
                      </span>
                    ) : null}
                    <span className={highlighted ? 'ml-auto min-w-0 text-right text-[13px] font-black text-emerald-50/90' : 'ml-auto min-w-0 text-right text-[13px] font-black text-neutral-300'}>
                      <YearStatsBadges
                        highlighted={highlighted}
                        matchesOnly={yearStatsMatchesOnly}
                        stats={yearStats[year] ?? {
                          match_count: matchesByYear[year].length,
                          win_count: 0,
                          draw_count: 0,
                          loss_count: 0,
                          goals_scored: 0,
                          goals_conceded: 0,
                          points_total: 0,
                          points_per_match: 0,
                        }}
                      />
                    </span>
                  </div>
                  <GlossyDisclosureCircle rotateClassName="group-open/year:rotate-180" className="justify-self-end" />
                </summary>

                <div className="relative z-0 overflow-x-auto pt-6 -mt-6">
                  <table className="w-full border-collapse text-sm table-auto">
                    <colgroup>
                      <col className="w-[7.5rem]" />
                      <col className="w-[8rem]" />
                      <col className="w-[14rem]" />
                      <col className="w-[12rem]" />
                    </colgroup>
                    <tbody>
                      {matchesByYear[year].map((match) => {
                        const competition = getCompetitionDisplay(match.competition_name)
                        const compactMatchRow = highlighted
                        const showLevel = Boolean(
                          match.match_level_name
                          && match.competition_name !== 'Towarzyski'
                          && match.competition_name !== 'Nieoficjalny'
                        )
                        const matchHref = `${detailBasePath}/${match.id}`

                        return (
                          <tr
                            key={match.id}
                            className={highlighted
                              ? 'border-t border-emerald-900/65 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] transition-colors hover:bg-[linear-gradient(165deg,#2bb95c_0%,#17a74a_18%,#10933f_40%,#16a34a_58%,#128844_78%,#0d7338_100%)]'
                              : 'border-t border-neutral-800 bg-neutral-950 transition-colors hover:bg-neutral-900/60'}
                          >
                            <td className="whitespace-nowrap">
                              <Link href={matchHref} className="block px-3 py-3" aria-label={`Otwórz mecz ${match.home_team_name} - ${match.away_team_name}`}>
                                <span className={highlighted
                                  ? 'inline-flex items-center rounded-md border border-emerald-100/40 bg-slate-950/35 px-2 py-0.5 text-[10px] font-semibold text-emerald-50'
                                  : 'inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200'}>
                                  {formatDate(match.match_date)}
                                </span>
                              </Link>
                            </td>
                            <td className={highlighted ? 'whitespace-nowrap font-semibold text-emerald-50' : 'whitespace-nowrap font-semibold text-neutral-100'}>
                              <Link href={matchHref} className={highlighted ? 'block pl-1 pr-2 py-3 text-[10px] leading-none tracking-[0.02em]' : 'block pl-1 pr-2 py-3'}>
                                {getTeamFifaCodeLabel(match.home_team_name, match.home_team_fifa_code)} - {getTeamFifaCodeLabel(match.away_team_name, match.away_team_fifa_code)}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap text-left">
                              <Link href={matchHref} className="block pl-0 pr-2 py-3">
                                {renderScoreWithFlags(match, compactMatchRow)}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap">
                              <Link href={matchHref} className="block px-8 py-3">
                                <span
                                  title={getCompetitionLevelTooltip(match.competition_name, match.match_level_name)}
                                  className={highlighted
                                    ? 'inline-flex items-center gap-1 rounded-md border border-emerald-100/40 bg-slate-950/35 px-1.5 py-0.5 text-emerald-50'
                                    : 'inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-200'}
                                >
                                  <span className={`font-semibold ${highlighted ? 'text-[10px]' : competition.isCompact ? 'text-[10px]' : 'text-xs'}`}>
                                    {competition.label}
                                  </span>
                                  {showLevel ? (
                                    <>
                                      <span className={highlighted ? 'text-[10px] text-emerald-200/65' : 'text-[10px] text-neutral-500'}>/</span>
                                      <span className={highlighted ? 'text-[10px] font-semibold text-emerald-50' : 'text-xs font-semibold text-neutral-200'}>{match.match_level_name}</span>
                                    </>
                                  ) : null}
                                </span>
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            ))
          )}
        </div>
      </details>
    </div>
  )
}
