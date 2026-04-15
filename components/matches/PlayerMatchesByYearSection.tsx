'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import GlossyDisclosureCircle from '@/components/admin/GlossyDisclosureCircle'
import CountryFlag from '@/components/CountryFlag'
import { Icon } from '@/components/icons'
import type { AppIconName } from '@/components/icons'
import PitchIcon from '@/components/icons/PitchIcon'
import StartingElevenIcon from '@/components/icons/StartingElevenIcon'
import SubOnPitchIcon from '@/components/icons/SubOnPitchIcon'
import SubOffPitchIcon from '@/components/icons/SubOffPitchIcon'
import BenchIcon from '@/components/icons/BenchIcon'
import { GoalIcon, AssistIcon } from '@/components/icons'
import type { AdminMatch, AdminPlayerMatchEventIcon, AdminPlayerYearStats } from '@/lib/db/matches'

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

function YearStatsBadges({ stats }: { stats: AdminPlayerYearStats }) {
  const items = [
    { icon: <PitchIcon className="h-4 w-4 text-neutral-400" />, label: 'Występy', value: stats.appearance_count },
    { icon: <GoalIcon className="h-4 w-4 text-neutral-400" />, label: 'Gole', value: stats.goal_count },
    { icon: <AssistIcon className="h-4 w-4 text-neutral-400" />, label: 'Asysty', value: stats.assist_count },
  ] as const

  return (
    <span className="inline-grid grid-cols-3 items-center justify-items-end gap-x-3 gap-y-1">
      {items.map(({ icon, label, value }) => (
        <span key={label} className="group/year-stat relative inline-flex w-[4.6rem] items-center justify-end gap-1">
          <span title={label}>{icon}</span>
          {value > 0 ? (
            <span className="stat-badge inline-flex w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.8rem] font-semibold text-neutral-200 light:text-neutral-900">{value}</span>
          ) : (
            <span className="inline-flex w-[2rem] items-center justify-center text-sm text-neutral-600">-</span>
          )}
          <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/year-stat:opacity-100">
            <span className="font-normal text-neutral-400">{label}</span>: {value}
          </span>
        </span>
      ))}
    </span>
  )
}

type PlayerMatchesByYearSectionProps = {
  matches: AdminMatch[]
  yearStats: Record<string, AdminPlayerYearStats>
  eventsByMatch: Record<string, AdminPlayerMatchEventIcon[]>
  detailBasePath: string
}

function renderPlayerEvents(events: AdminPlayerMatchEventIcon[] | undefined) {
  if (!events || events.length === 0) {
    return <span className="text-xs text-neutral-600">–</span>
  }

  function renderEventIcon(iconName: AppIconName) {
    if (iconName !== 'penaltyGoal') {
      return <Icon name={iconName} className="h-4 w-4 shrink-0" />
    }

    return (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <Icon name="goal" className="h-4 w-4 shrink-0" />
        <span className="absolute -bottom-0.5 -right-0.5 rounded-sm bg-neutral-900/95 px-[2px] text-[8px] font-black leading-none text-white ring-1 ring-neutral-500/70">
          k
        </span>
      </span>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5 text-neutral-300">
      {events.map(({ icon_name, minute, minute_left }, index) => (
        <span key={`${icon_name}-${minute ?? 'n'}-${index}`} className="inline-flex items-center gap-0.5">
          {minute && minute_left ? (
            <span className="text-[10px] font-semibold leading-none text-neutral-400">{minute}</span>
          ) : null}
          {renderEventIcon(icon_name as AppIconName)}
          {minute && !minute_left ? (
            <span className="text-[10px] font-semibold leading-none text-neutral-400">{minute}</span>
          ) : null}
        </span>
      ))}
    </span>
  )
}

export default function PlayerMatchesByYearSection({ matches, yearStats, eventsByMatch, detailBasePath }: PlayerMatchesByYearSectionProps) {
  const matchesByYear = matches.reduce<Record<string, AdminMatch[]>>((acc, match) => {
    const year = match.match_date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(match)
    return acc
  }, {})
  const years = Object.keys(matchesByYear).sort((a, b) => Number(b) - Number(a))

  return (
    <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <details open={matches.length > 0} className="overflow-hidden rounded-lg border border-neutral-800 group/det">
        <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-500 marker:content-none">
          <span>Mecze</span>
          <GlossyDisclosureCircle rotateClassName="group-open/det:rotate-180" />
        </summary>

        <div className="divide-y divide-neutral-800">
          {years.length === 0 ? (
            <div className="px-4 py-5 text-sm text-neutral-500">Brak meczów rozegranych przez tego piłkarza.</div>
          ) : (
            years.map((year) => (
              <details key={year} className="group bg-neutral-950">
                <summary className="relative z-20 grid cursor-pointer list-none grid-cols-[auto_1fr] items-center gap-[14px] bg-neutral-900 px-[18px] py-[9px] marker:content-none pointer-events-auto">
                  <GlossySummaryBadge>{year}</GlossySummaryBadge>
                  <span className="min-w-0 text-right text-[13px] font-black text-neutral-300">
                    <YearStatsBadges
                      stats={yearStats[year] ?? {
                        appearance_count: matchesByYear[year].length,
                        starting_appearance_count: 0,
                        sub_on_count: 0,
                        sub_off_count: 0,
                        bench_count: 0,
                        goal_count: 0,
                        assist_count: 0,
                      }}
                    />
                  </span>
                </summary>

                <div className="relative z-0 overflow-x-auto pt-6 -mt-6">
                  <table className="w-full border-collapse text-sm table-auto">
                    <colgroup>
                      <col className="w-[7.5rem]" />
                      <col className="w-[8rem]" />
                      <col className="w-[14rem]" />
                      <col className="w-[12rem]" />
                      <col className="w-[14rem]" />
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
                                {getTeamFifaCodeLabel(match.home_team_name, match.home_team_fifa_code)} – {getTeamFifaCodeLabel(match.away_team_name, match.away_team_fifa_code)}
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
                            <td className="whitespace-nowrap text-right">
                              <Link href={matchHref} className="block px-3 py-3">
                                {renderPlayerEvents(eventsByMatch[match.id])}
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
