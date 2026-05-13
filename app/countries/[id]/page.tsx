import { notFound } from 'next/navigation'
import CountryFlag from '@/components/CountryFlag'
import { getPublicCountries } from '@/lib/db/countries'
import type { PublicCountry } from '@/lib/db/countries'
import {
  getCachedPublicMatches,
  type AdminCoachMatch,
  type AdminCoachYearStats,
  type AdminMatch,
} from '@/lib/db/matches'
import CoachMatchesByYearSection from '@/components/matches/CoachMatchesByYearSection'
import type { DetailPageParams } from '@/lib/types/admin'

export const dynamic = 'force-dynamic'

type Params = DetailPageParams

function normalizeName(value: string | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isPolandTeam(teamName: string | null, fifaCode: string | null): boolean {
  const code = (fifaCode ?? '').trim().toUpperCase()
  if (code === 'POL') return true
  const name = normalizeName(teamName)
  return name.includes('polsk') || name.includes('poland')
}

function buildCountryYearStatsFromMatches(matches: AdminCoachMatch[]): Record<string, AdminCoachYearStats> {
  const result: Record<string, AdminCoachYearStats> = {}

  for (const match of matches) {
    if (match.result_type === 'WALKOVER') continue
    if (!match.final_score || match.coach_is_home === null) continue

    const scoreMatch = match.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
    if (!scoreMatch) continue

    const year = match.match_date.slice(0, 4)
    const homeGoals = Number(scoreMatch[1])
    const awayGoals = Number(scoreMatch[2])
    const goalsFor = match.coach_is_home ? homeGoals : awayGoals
    const goalsAgainst = match.coach_is_home ? awayGoals : homeGoals

    if (!result[year]) {
      result[year] = {
        match_count: 0,
        win_count: 0,
        draw_count: 0,
        loss_count: 0,
        goals_scored: 0,
        goals_conceded: 0,
        points_total: 0,
        points_per_match: 0,
      }
    }

    const stats = result[year]
    stats.match_count += 1
    stats.goals_scored += goalsFor
    stats.goals_conceded += goalsAgainst

    if (goalsFor > goalsAgainst) {
      stats.win_count += 1
      stats.points_total += 3
    } else if (goalsFor === goalsAgainst) {
      stats.draw_count += 1
      stats.points_total += 1
    } else {
      stats.loss_count += 1
    }
  }

  for (const year of Object.keys(result)) {
    const stats = result[year]
    stats.points_per_match = stats.match_count > 0
      ? Number((stats.points_total / stats.match_count).toFixed(2))
      : 0
  }

  return result
}

export default async function PublicCountryDetailsPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  const [countries, allPublicMatches] = await Promise.all([
    getPublicCountries(),
    getCachedPublicMatches(),
  ])
  const country = countries.find((item) => item.id === id)

  if (!country) {
    notFound()
  }

  const displayedCountry: PublicCountry = country.name.toLowerCase() === 'polska'
    ? {
        ...country,
        matches: countries
          .filter((item) => item.id !== country.id)
          .reduce((sum, item) => sum + item.matches, 0),
        wins: countries
          .filter((item) => item.id !== country.id)
          .reduce((sum, item) => sum + item.wins, 0),
        draws: countries
          .filter((item) => item.id !== country.id)
          .reduce((sum, item) => sum + item.draws, 0),
        losses: countries
          .filter((item) => item.id !== country.id)
          .reduce((sum, item) => sum + item.losses, 0),
        goals_for: countries
          .filter((item) => item.id !== country.id)
          .reduce((sum, item) => sum + item.goals_for, 0),
        goals_against: countries
          .filter((item) => item.id !== country.id)
          .reduce((sum, item) => sum + item.goals_against, 0),
      }
    : country

  const isPolandCountry = normalizeName(country.name) === 'polska'
  const countryFifaCode = (country.fifa_code ?? '').trim().toUpperCase()

  const countryMatches = allPublicMatches.filter((match: AdminMatch) => {
    if (match.editorial_status !== 'VERIFIED') return false

    const isPolandHome = isPolandTeam(match.home_team_name, match.home_team_fifa_code)
    const isPolandAway = isPolandTeam(match.away_team_name, match.away_team_fifa_code)
    if (!isPolandHome && !isPolandAway) return false

    if (isPolandCountry) return true

    const opponentFifa = (isPolandHome ? match.away_team_fifa_code : match.home_team_fifa_code)?.trim().toUpperCase() ?? ''
    if (countryFifaCode && opponentFifa) {
      return opponentFifa === countryFifaCode
    }

    const opponentName = isPolandHome ? match.away_team_name : match.home_team_name
    return normalizeName(opponentName) === normalizeName(country.name)
  })

  const countrySectionMatches: AdminCoachMatch[] = countryMatches.map((match) => ({
    ...match,
    coach_team_id: null,
    coach_team_fifa_code: 'POL',
    coach_is_home: isPolandTeam(match.home_team_name, match.home_team_fifa_code)
      ? true
      : isPolandTeam(match.away_team_name, match.away_team_fifa_code)
        ? false
        : null,
  }))

  const countryYearStats = buildCountryYearStatsFromMatches(countrySectionMatches)

  return (
    <div className="public-theme">
      <main className="min-h-screen px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <section className="relative overflow-hidden rounded-xl border border-emerald-900/70 bg-[linear-gradient(165deg,#2d7a52_0%,#1e603f_18%,#134b33_40%,#0f3f2b_60%,#0b3423_80%,#08281c_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.34),0_8px_18px_rgba(0,0,0,0.28)]">
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.05)_30%,rgba(0,0,0,0.16)_100%)]" />
            <div className="relative z-10">
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex flex-col items-start gap-2">
                  <h1 className="font-barlow text-[1.8rem] font-semibold leading-tight text-emerald-50">{displayedCountry.name}</h1>
                  <span
                    title={`Mecze: ${displayedCountry.matches} | Zwycięstwa: ${displayedCountry.wins} | Remisy: ${displayedCountry.draws} | Porażki: ${displayedCountry.losses} | Gole: ${displayedCountry.goals_for}-${displayedCountry.goals_against}`}
                    className="stat-badge inline-flex items-center gap-2 rounded-md border border-white/30 bg-slate-950/35 px-2.5 py-1 font-barlow text-[1.06rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]"
                  >
                    <span>{displayedCountry.matches}</span>
                    <span className="mx-2 text-emerald-200/50">|</span>
                    <span>{displayedCountry.wins}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{displayedCountry.draws}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{displayedCountry.losses}</span>
                    <span className="mx-2 text-emerald-200/50">|</span>
                    <span>{displayedCountry.goals_for}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{displayedCountry.goals_against}</span>
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <CountryFlag
                    fifaCode={displayedCountry.fifa_code}
                    countryName={displayedCountry.name}
                    glossy
                    className="h-[33px] w-[50px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]"
                  />
                  {displayedCountry.federation_short_name ? (
                    <span className="stat-badge inline-flex items-center rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.82rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]">
                      {displayedCountry.federation_short_name}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <CoachMatchesByYearSection
            matches={countrySectionMatches}
            yearStats={countryYearStats}
            detailBasePath="/matches"
            title="MECZE"
            highlighted
            defaultExpanded={false}
            emptyMessage="Brak meczów Polski przeciwko temu krajowi."
          />
        </div>
      </main>
    </div>
  )
}
