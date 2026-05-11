import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createCityInline } from '@/app/admin/cities/actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import { deletePerson, updatePerson } from '../actions'
import {
  getAdminPersonBirthCityOptions,
  getAdminPersonDetails,
  getPublicPersonDetails,
  getPersonDisplayName,
} from '@/lib/db/people'
import {
  getAdminMatchesForPlayer,
  getAdminMatchesForCoach,
  getAdminMatchesForReferee,
  getAdminPlayerYearStats,
  getAdminCoachYearStats,
  getAdminRefereeYearStats,
  getAdminPlayerMatchEventsByMatch,
  getPublicMatchesForPlayer,
  getPublicMatchesForCoach,
  getPublicMatchesForReferee,
  getPublicPlayerYearStats,
  getPublicCoachYearStats,
  getPublicRefereeYearStats,
  getPublicPlayerMatchEventsByMatch,
} from '@/lib/db/matches'
import type { AdminCoachMatch, AdminCoachYearStats, AdminRefereeMatch } from '@/lib/db/matches'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import {
  DetailsPageContainer,
  DetailsPageHeader,
  DetailsPageContent,
} from '@/components/admin/DetailsPageLayout'
import CountryFlag from '@/components/CountryFlag'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'
import PersonBirthplaceFields from '@/components/admin/PersonBirthplaceFields'
import PersonRepresentedCountriesFields from '@/components/admin/PersonRepresentedCountriesFields'
import PlayerMatchesByYearSection from '@/components/matches/PlayerMatchesByYearSection'
import CoachMatchesByYearSection from '@/components/matches/CoachMatchesByYearSection'

type Params = DetailPageParams
type SearchParams = DetailPageSearchParams

function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

function getAge(date: string | null): number | null {
  if (!date) return null

  const [yearRaw, monthRaw, dayRaw] = date.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - year
  const hasBirthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day)

  if (!hasBirthdayPassed) {
    age -= 1
  }

  return age >= 0 ? age : null
}

function buildCoachYearStatsFromMatches(matches: AdminCoachMatch[]): Record<string, AdminCoachYearStats> {
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

export default async function AdminPersonDetailsPage({
  params,
  searchParams,
  isPublic = false,
}: {
  params: Params
  searchParams: SearchParams
  isPublic?: boolean
}) {
  const { id } = await params
  const { mode, saved, error } = await searchParams
  const isEdit = !isPublic && mode === 'edit'

  const [person, cities, countries] = await Promise.all([
    isPublic ? getPublicPersonDetails(id) : getAdminPersonDetails(id),
    isEdit ? getAdminPersonBirthCityOptions() : Promise.resolve([]),
    isEdit ? getAdminCountriesOptions() : Promise.resolve([]),
  ])

  if (!person) {
    notFound()
  }

  let playerMatches: Awaited<ReturnType<typeof getAdminMatchesForPlayer>> = []
  let playerYearStats: Awaited<ReturnType<typeof getAdminPlayerYearStats>> = {}
  let playerEventsByMatch: Awaited<ReturnType<typeof getAdminPlayerMatchEventsByMatch>> = {}
  let coachMatches: Awaited<ReturnType<typeof getAdminMatchesForCoach>> = []
  let coachYearStats: Awaited<ReturnType<typeof getAdminCoachYearStats>> = {}
  let refereeMatches: Awaited<ReturnType<typeof getAdminMatchesForReferee>> = []
  let refereeYearStats: Awaited<ReturnType<typeof getAdminRefereeYearStats>> = {}
  let coachPolandMatches: Awaited<ReturnType<typeof getAdminMatchesForCoach>> = []
  let coachAgainstPolandMatches: Awaited<ReturnType<typeof getAdminMatchesForCoach>> = []
  let coachPolandYearStats: Record<string, AdminCoachYearStats> = {}
  let coachAgainstPolandYearStats: Record<string, AdminCoachYearStats> = {}
  let hasPolandNationalTeamAppearance = false

  if (person.roles.includes('PLAYER')) {
    ;[playerMatches, playerYearStats] = await Promise.all([
      isPublic ? getPublicMatchesForPlayer(person.id) : getAdminMatchesForPlayer(person.id),
      isPublic ? getPublicPlayerYearStats(person.id) : getAdminPlayerYearStats(person.id),
    ])
    playerEventsByMatch = await (
      isPublic ? getPublicPlayerMatchEventsByMatch(
        person.id,
        playerMatches.map((match) => match.id)
      ) : getAdminPlayerMatchEventsByMatch(
        person.id,
        playerMatches.map((match) => match.id)
      )
    )
    hasPolandNationalTeamAppearance = playerMatches.some(
      (match) => match.player_team_fifa_code === 'POL'
    )
  }

  if (person.roles.includes('COACH')) {
    ;[coachMatches, coachYearStats] = await Promise.all([
      isPublic ? getPublicMatchesForCoach(person.id) : getAdminMatchesForCoach(person.id),
      isPublic ? getPublicCoachYearStats(person.id) : getAdminCoachYearStats(person.id),
    ])

    coachPolandMatches = coachMatches.filter((match) => match.coach_team_fifa_code === 'POL')
    coachAgainstPolandMatches = coachMatches.filter((match) => match.coach_team_fifa_code !== 'POL')
    coachPolandYearStats = buildCoachYearStatsFromMatches(coachPolandMatches)
    coachAgainstPolandYearStats = buildCoachYearStatsFromMatches(coachAgainstPolandMatches)
  }

  if (person.roles.includes('REFEREE')) {
    ;[refereeMatches, refereeYearStats] = await Promise.all([
      isPublic ? getPublicMatchesForReferee(person.id) : getAdminMatchesForReferee(person.id),
      isPublic ? getPublicRefereeYearStats(person.id) : getAdminRefereeYearStats(person.id),
    ])
  }

  const displayName = getPersonDisplayName(person)
  const syncScope = `admin-people-edit-${person.id}`
  const birthDateFormatted = person.birth_date ? formatDate(person.birth_date) : '—'
  const isPublicPlayerPage = isPublic && person.roles.includes('PLAYER')
  const isPublicCoachPage = isPublic && person.roles.includes('COACH')
  const isPublicRefereePage = isPublic && person.roles.includes('REFEREE')
  const isPublicHighlightedPage = isPublicPlayerPage || isPublicCoachPage || isPublicRefereePage

  // Coach summary stats and Poland career year range
  const coachPolandMatchesNoWalkover = coachPolandMatches.filter((m) => m.result_type !== 'WALKOVER')
  const coachPolandStats = coachPolandMatchesNoWalkover.reduce(
    (acc, m) => {
      if (!m.final_score || m.coach_is_home === null) return acc
      const scoreMatch = m.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
      if (!scoreMatch) return acc
      const homeGoals = Number(scoreMatch[1])
      const awayGoals = Number(scoreMatch[2])
      const goalsFor = m.coach_is_home ? homeGoals : awayGoals
      const goalsAgainst = m.coach_is_home ? awayGoals : homeGoals
      acc.matches += 1
      acc.goalsFor += goalsFor
      acc.goalsAgainst += goalsAgainst
      if (goalsFor > goalsAgainst) acc.wins += 1
      else if (goalsFor === goalsAgainst) acc.draws += 1
      else acc.losses += 1
      return acc
    },
    { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }
  )
  const coachPolandYears = coachPolandMatchesNoWalkover.map((m) => Number(m.match_date.slice(0, 4))).sort((a, b) => a - b)
  const coachPolandYearFrom = coachPolandYears[0] ?? null
  const coachPolandYearTo = coachPolandYears[coachPolandYears.length - 1] ?? null
  const refereeMatchesNoWalkover = refereeMatches.filter(
    (match) => match.result_type !== 'WALKOVER' && match.poland_is_home !== null
  )
  const refereeStats = refereeMatchesNoWalkover.reduce(
    (acc, match) => {
      if (!match.final_score || match.poland_is_home === null) return acc
      const scoreMatch = match.final_score.match(/(\d+)\s*[:\-]\s*(\d+)/)
      if (!scoreMatch) return acc
      const homeGoals = Number(scoreMatch[1])
      const awayGoals = Number(scoreMatch[2])
      const goalsFor = match.poland_is_home ? homeGoals : awayGoals
      const goalsAgainst = match.poland_is_home ? awayGoals : homeGoals
      acc.matches += 1
      acc.goalsFor += goalsFor
      acc.goalsAgainst += goalsAgainst
      if (match.result_type === 'PENALTIES' || match.result_type === 'EXTRA_TIME_AND_PENALTIES') acc.draws += 1
      else if (goalsFor > goalsAgainst) acc.wins += 1
      else if (goalsFor === goalsAgainst) acc.draws += 1
      else acc.losses += 1
      return acc
    },
    { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }
  )
  const refereeYears = refereeMatchesNoWalkover.map((m) => Number(m.match_date.slice(0, 4))).sort((a, b) => a - b)
  const refereeYearFrom = refereeYears[0] ?? null
  const refereeYearTo = refereeYears[refereeYears.length - 1] ?? null
  const refereeSectionMatches: AdminCoachMatch[] = refereeMatches.map((match: AdminRefereeMatch) => ({
    ...match,
    coach_team_id: null,
    coach_team_fifa_code: 'POL',
    coach_is_home: match.poland_is_home,
  }))

  const visibleFlags: { fifaCode: string | null; countryName: string; key: string }[] = []
  const seenFlagKeys = new Set<string>()

  person.represented_country_names.forEach((name, i) => {
    const fifaCode = person.represented_country_fifa_codes[i] ?? null
    const key = `${fifaCode ?? '—'}|${name}`

    if (seenFlagKeys.has(key)) return
    seenFlagKeys.add(key)
    visibleFlags.push({ fifaCode, countryName: name, key: `rep-${key}` })
  })

  const fields = (
    <div
      className={isPublicHighlightedPage
        ? 'relative mt-6 overflow-hidden rounded-xl border border-emerald-900/70 bg-[linear-gradient(165deg,#2d7a52_0%,#1e603f_18%,#134b33_40%,#0f3f2b_60%,#0b3423_80%,#08281c_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.34),0_8px_18px_rgba(0,0,0,0.28)]'
        : 'mt-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4'}
    >
      {isPublicHighlightedPage ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.05)_30%,rgba(0,0,0,0.16)_100%)]" />
      ) : null}
      <div className={isPublicHighlightedPage ? 'relative z-10' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={isPublicHighlightedPage ? 'font-barlow text-2xl font-semibold text-emerald-50' : 'font-barlow text-2xl font-semibold text-neutral-100'}>{displayName}</p>
          {!isEdit && (
            <div className="mt-2 flex flex-col items-start gap-2">
              {person.birth_date && (
                <span className={isPublicHighlightedPage
                  ? 'stat-badge inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.9rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]'
                  : 'stat-badge inline-flex items-center gap-1.5 rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900'}>
                  {birthDateFormatted}
                  {getAge(person.birth_date) !== null && !person.death_date && (
                    <span className={isPublicHighlightedPage ? 'font-normal text-slate-300' : 'font-normal text-neutral-500 light:text-neutral-400'}>({getAge(person.birth_date)} l.)</span>
                  )}
                </span>
              )}
              {person.birth_city_name && (
                <span className={isPublicHighlightedPage
                  ? 'stat-badge inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.9rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]'
                  : 'stat-badge inline-flex items-center gap-1.5 rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900'}>
                  {person.birth_city_name}
                  {person.birth_country_fifa_code && (
                    <CountryFlag
                      fifaCode={person.birth_country_fifa_code}
                      countryName={person.birth_country_name ?? '—'}
                      className="h-[13.5px] w-[20px]"
                    />
                  )}
                </span>
              )}
            </div>
          )}
          {isEdit && (
            <div>
              <p className="mt-0.5 text-sm text-neutral-400">
                {birthDateFormatted}
                {person.birth_date && getAge(person.birth_date) !== null && (
                  <> <span className="font-semibold">({getAge(person.birth_date)} l.)</span></>
                )}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-400">
                <span>{person.birth_city_name ?? '—'}</span>
                <CountryFlag
                  fifaCode={person.birth_country_fifa_code}
                  countryName={person.birth_country_name ?? '—'}
                  className="h-[13.5px] w-[20px]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {visibleFlags.map((flag) => (
              <CountryFlag
                key={flag.key}
                fifaCode={flag.fifaCode}
                countryName={flag.countryName}
                className="h-[33px] w-[50px]"
              />
            ))}
          </div>
          {!isEdit && person.roles.includes('PLAYER') && (!isPublic || (isPublic && hasPolandNationalTeamAppearance)) && (
            <div className="group/stats relative">
              <span className={isPublicHighlightedPage
                ? 'stat-badge inline-flex min-w-[2.4rem] items-center justify-center rounded-md border border-white/35 bg-slate-950/38 px-2 py-1 font-barlow text-[1.08rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]'
                : 'stat-badge inline-flex min-w-[2.4rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-2 py-1 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[1.08rem] font-semibold text-neutral-200 light:text-neutral-900'}>
                {person.appearance_count}<span className={isPublicHighlightedPage ? 'mx-0.5 font-normal text-slate-300' : 'mx-0.5 font-normal text-neutral-500 light:text-neutral-400'}>/</span>{person.goal_count}
              </span>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/stats:opacity-100">
                <span className="font-normal text-neutral-400">Występy</span> {person.appearance_count} <span className="mx-1 text-neutral-600">/</span> <span className="font-normal text-neutral-400">Gole</span> {person.goal_count}
              </div>
            </div>
          )}
          {!isEdit && isPublicCoachPage && coachPolandStats.matches > 0 && (
            <span
              title={`Mecze: ${coachPolandStats.matches} | Zwycięstwa: ${coachPolandStats.wins} | Remisy: ${coachPolandStats.draws} | Porażki: ${coachPolandStats.losses} | Gole: ${coachPolandStats.goalsFor}-${coachPolandStats.goalsAgainst}`}
              className="stat-badge inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.88rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]">
              <span>{coachPolandStats.matches}</span>
              <span className="mx-2 text-emerald-200/50">|</span>
              <span>{coachPolandStats.wins}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{coachPolandStats.draws}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{coachPolandStats.losses}</span>
              <span className="mx-2 text-emerald-200/50">|</span>
              <span>{coachPolandStats.goalsFor}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{coachPolandStats.goalsAgainst}</span>
            </span>
          )}
          {!isEdit && isPublicCoachPage && coachPolandYearFrom && (
            <span className="stat-badge inline-flex items-center gap-0.5 rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.88rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]">
              {coachPolandYearFrom === coachPolandYearTo ? (
                coachPolandYearFrom
              ) : (
                <>{coachPolandYearFrom}<span className="mx-1 font-normal text-emerald-200/60">–</span>{coachPolandYearTo}</>
              )}
            </span>
          )}
          {!isEdit && isPublicRefereePage && refereeStats.matches > 0 && (
            <span
              title={`Mecze: ${refereeStats.matches} | Zwycięstwa: ${refereeStats.wins} | Remisy: ${refereeStats.draws} | Porażki: ${refereeStats.losses} | Gole: ${refereeStats.goalsFor}-${refereeStats.goalsAgainst}`}
              className="stat-badge inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.88rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]">
              <span>{refereeStats.matches}</span>
              <span className="mx-2 text-emerald-200/50">|</span>
              <span>{refereeStats.wins}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{refereeStats.draws}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{refereeStats.losses}</span>
              <span className="mx-2 text-emerald-200/50">|</span>
              <span>{refereeStats.goalsFor}<span className="mx-[2px] font-normal text-emerald-200/60">-</span>{refereeStats.goalsAgainst}</span>
            </span>
          )}
          {!isEdit && isPublicRefereePage && refereeYearFrom && (
            <span className="stat-badge inline-flex items-center gap-0.5 rounded-md border border-white/30 bg-slate-950/35 px-2 py-0.5 font-barlow text-[0.88rem] font-semibold text-slate-50 shadow-[0_3px_8px_rgba(0,0,0,0.3)]">
              {refereeYearFrom === refereeYearTo ? (
                refereeYearFrom
              ) : (
                <>{refereeYearFrom}<span className="mx-1 font-normal text-emerald-200/60">–</span>{refereeYearTo}</>
              )}
            </span>
          )}
        </div>
      </div>

      {isEdit ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="first_name" className="text-sm font-medium text-neutral-300">Imię</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              defaultValue={person.first_name ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="last_name" className="text-sm font-medium text-neutral-300">Nazwisko</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              defaultValue={person.last_name ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="nickname" className="text-sm font-medium text-neutral-300">Pseudonim</label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              defaultValue={person.nickname ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="birth_date" className="text-sm font-medium text-neutral-300">Data urodzenia</label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              defaultValue={person.birth_date ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="death_date" className="text-sm font-medium text-neutral-300">Data śmierci</label>
            <input
              id="death_date"
              name="death_date"
              type="date"
              defaultValue={person.death_date ?? ''}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="sm:col-span-2">
            <PersonBirthplaceFields
              cities={cities}
              countries={countries}
              createCityAction={createCityInline}
              createCountryAction={createCountryInline}
              showBirthDate={false}
              defaultBirthDate={person.birth_date}
              defaultDeathDate={person.death_date}
              defaultCityId={person.birth_city_id}
              defaultCountryId={person.birth_country_id}
              syncScope={syncScope}
            />
          </div>

          <div className="sm:col-span-2">
            <PersonRepresentedCountriesFields
              countries={countries}
              createCountryAction={createCountryInline}
              defaultCountryIds={person.represented_country_ids}
              defaultBirthCountryId={person.birth_country_id}
              syncScope={syncScope}
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={Boolean(person.is_active)}
              className="h-4 w-4"
            />
            <label htmlFor="is_active" className="text-sm text-neutral-300">Aktywna osoba</label>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )

  return (
    <DetailsPageContainer>
      <DetailsPageHeader
        title={displayName}
        backLabel="Powrót do listy ludzi"
        backHref={isPublic ? '/people' : '/admin/people'}
        showBackButton={!isPublicPlayerPage && !isPublicCoachPage && !isPublicRefereePage}
        editHref={`/admin/people/${person.id}?mode=edit`}
        deleteAction={deletePerson}
        deleteId={person.id}
        showActions={!isPublic}
      />

      <DetailsPageContent
        title={null}
        breadcrumb={null}
        containerClassName={isPublicHighlightedPage
          ? 'relative overflow-hidden rounded-xl border border-emerald-900/70 bg-[linear-gradient(165deg,#2d7a52_0%,#1e603f_18%,#134b33_40%,#0f3f2b_60%,#0b3423_80%,#08281c_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.34),0_8px_18px_rgba(0,0,0,0.28)]'
          : undefined}
        saved={saved}
        error={error}
        isEdit={isEdit}
        editContent={
          <form action={updatePerson} className="space-y-4">
            <input type="hidden" name="id" value={person.id} />
            {fields}
            <p className="text-xs text-neutral-500">Wymagane jest przynajmniej jedno pole: imię, nazwisko lub pseudonim.</p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={`/admin/people/${person.id}`}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
              >
                Anuluj
              </Link>
              <button
                type="submit"
                className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
              >
                Zapisz
              </button>
            </div>
          </form>
        }
        viewContent={
          <>
            {fields}
            {!isEdit && person.roles.includes('PLAYER') && (!isPublic || (isPublic && hasPolandNationalTeamAppearance)) && (
              <PlayerMatchesByYearSection
                matches={playerMatches}
                yearStats={playerYearStats}
                eventsByMatch={playerEventsByMatch}
                detailBasePath={isPublic ? '/matches' : '/admin/matches'}
                highlighted={isPublicPlayerPage}
              />
            )}
            {!isEdit && person.roles.includes('COACH') && (
              isPublicCoachPage && person.has_coached_poland && person.has_coached_against_poland ? (
                <>
                  <CoachMatchesByYearSection
                    matches={coachPolandMatches}
                    yearStats={coachPolandYearStats}
                    detailBasePath={isPublic ? '/matches' : '/admin/matches'}
                    title="MECZE POLSKI"
                    highlighted={isPublicCoachPage}
                    showYearCoachFlags
                  />
                  <CoachMatchesByYearSection
                    matches={coachAgainstPolandMatches}
                    yearStats={coachAgainstPolandYearStats}
                    detailBasePath={isPublic ? '/matches' : '/admin/matches'}
                    title="MECZE PRZECIWKO POLSCE"
                    highlighted={isPublicCoachPage}
                    showYearCoachFlags
                  />
                </>
              ) : (
                <CoachMatchesByYearSection
                  matches={coachMatches}
                  yearStats={coachYearStats}
                  detailBasePath={isPublic ? '/matches' : '/admin/matches'}
                  title={isPublicCoachPage && !person.has_coached_poland ? 'MECZE PRZECIWKO POLSCE' : 'MECZE'}
                  highlighted={isPublicCoachPage}
                  showYearCoachFlags
                />
              )
            )}
            {!isEdit && person.roles.includes('REFEREE') && (
              <CoachMatchesByYearSection
                matches={refereeSectionMatches}
                yearStats={refereeYearStats}
                detailBasePath={isPublic ? '/matches' : '/admin/matches'}
                title="MECZE"
                highlighted={isPublicRefereePage}
                emptyMessage="Brak meczów sędziowanych przez tę osobę."
                yearStatsMatchesOnly
              />
            )}
          </>
        }
      />
    </DetailsPageContainer>
  )
}
