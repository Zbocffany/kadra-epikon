'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import CountryFlag from '@/components/CountryFlag'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminPersonListItem, CoachCompetitionFilterKey, CoachStageFilterKey, CoachPolandFilterMatch } from '@/lib/db/people'
import { getPersonDisplayName } from '@/lib/db/people'
import { FilterRibbon, RibbonSection } from '@/components/filters/FilterRibbon'
import type { AdminCoachMatch, AdminCoachYearStats } from '@/lib/db/matches'
import PitchIcon from '@/components/icons/PitchIcon'
import ClockIcon from '@/components/icons/ClockIcon'
import { GoalIcon, AssistIcon, YellowCardIcon, RedCardIcon } from '@/components/icons'
import BenchIcon from '@/components/icons/BenchIcon'
import SortableStatHeader from '@/components/admin/SortableStatHeader'
import GlossyDisclosureCircle from '@/components/admin/GlossyDisclosureCircle'

export type PeopleCardVariant = 'players' | 'coaches' | 'referees'
type PublicPlayerMode = 'poland' | 'rivals'
type PublicCoachMode = 'poland' | 'rivals'
type CoachDisplayMode = 'tenure' | 'stats'
type VisibleCoachCompetitionFilter = Exclude<CoachCompetitionFilterKey, 'OTHER'>

type PublicPeopleViewState = {
  query?: string
  countryFilter?: string
  playerMode?: PublicPlayerMode
  coachMode?: PublicCoachMode
  coachDisplayMode?: CoachDisplayMode
  sortKey?: string
  coachSortKey?: string
  refereeSortKey?: string
  competitionFilters?: VisibleCoachCompetitionFilter[]
  stageFilters?: CoachStageFilterKey[]
  coachDateFrom?: string
  coachDateTo?: string
  isCoachRibbonExpanded?: boolean
  expandedPersonId?: string | null
  visibleCount?: number
  scrollY?: number
}
const VIEW_STATE_KEY = '__publicPeopleViewState'

type CoachComputedStats = {
  coach_match_count: number
  coach_wins: number
  coach_draws: number
  coach_losses: number
  coach_goals_scored: number
  coach_goals_conceded: number
  coach_points_per_match: number
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function getCompetitionDisplay(name: string): { label: string; fullName: string; isCompact: boolean } {
  const normalized = name.trim()
  if (normalized === 'Mistrzostwa Świata') return { label: 'MŚ', fullName: normalized, isCompact: false }
  if (normalized === 'Mistrzostwa Europy') return { label: 'ME', fullName: normalized, isCompact: false }
  if (normalized === 'Liga Narodów') return { label: 'LN', fullName: normalized, isCompact: false }
  if (normalized === 'Nieoficjalny') return { label: 'NO', fullName: normalized, isCompact: false }
  if (normalized === 'Towarzyski') return { label: normalized, fullName: normalized, isCompact: false }
  return { label: normalized, fullName: normalized, isCompact: false }
}

function getCompetitionLevelTooltip(competitionName: string, matchLevelName: string | null): string {
  if (!matchLevelName || competitionName === 'Towarzyski' || competitionName === 'Nieoficjalny') return competitionName
  return `${competitionName} - ${matchLevelName}`
}

function getTeamFifaCodeLabel(teamName: string, fifaCode: string | null): string {
  const normalizedCode = fifaCode?.trim().toUpperCase()
  if (normalizedCode) return normalizedCode
  const compactName = teamName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase()
  return compactName.slice(0, 3) || '---'
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
  let homeShootoutWin = false, awayShootoutWin = false
  if (shootout) {
    const m = shootout.match(/(\d+):(\d+)/)
    if (m) {
      const h = Number(m[1]), a = Number(m[2])
      homeShootoutWin = h > a
      awayShootoutWin = a > h
    }
  }
  const starClass = 'absolute -top-2.5 z-10 text-[18px] leading-none text-amber-400 select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
  return (
    <span className="inline-flex items-center gap-[0.5cm]">
      <CountryFlag fifaCode={match.home_team_fifa_code} countryName={match.home_team_name} glossy className={compact ? 'h-[15px] w-[23px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]' : 'h-[22px] w-[33px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]'} />
      <span className="group/score relative">
        {homeShootoutWin && <span className={`${starClass} -left-3`}>★</span>}
        {awayShootoutWin && <span className={`${starClass} -right-3`}>★</span>}
        <span className={`relative inline-flex items-center overflow-hidden rounded-md border bg-black ${compact ? 'px-1.5 py-[0.1rem] text-[0.72rem]' : 'px-2 py-0.5 text-xs'} font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)] ${badgeClass}`} style={{ fontSize: compact ? '0.8em' : '0.95em', fontWeight: 700 }}>
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]" />
          <span className="relative z-10">{label}</span>
        </span>
        {shootout && <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/score:opacity-100">Karne {shootout}</span>}
      </span>
      <CountryFlag fifaCode={match.away_team_fifa_code} countryName={match.away_team_name} glossy className={compact ? 'h-[15px] w-[23px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]' : 'h-[22px] w-[33px] ring-1 ring-neutral-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.7),0_4px_8px_rgba(0,0,0,0.45)]'} />
    </span>
  )
}

function getAgeDisplay(person: AdminPersonListItem): string | null {
  if (!person.birth_date) return null
  const birth = new Date(person.birth_date)
  const ref = person.death_date ? new Date(person.death_date) : new Date()
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return person.death_date ? null : `(${age} l.)`
}

function normalizeText(v: string) {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function formatMonthYear(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [year, month] = dateStr.split('-')
  if (!year || !month) return '—'
  return `${month}.${year}`
}

function getCoachTenureLabel(person: AdminPersonListItem): string {
  const from = formatMonthYear(person.coach_poland_first_match_date)
  const to = formatMonthYear(person.coach_poland_last_match_date)
  if (from === '—' && to === '—') return '—'
  if (from === to) return from
  return `${from} - ${to}`
}

function isPolandCoachFilterRow(row: CoachPolandFilterMatch): boolean {
  if ((row.coach_team_fifa_code ?? '').toUpperCase() === 'POL') return true
  if (row.coach_is_home === null) return false
  const coachedTeamName = row.coach_is_home ? row.home_team_name : row.away_team_name
  return coachedTeamName === 'Polska'
}

export default function PublicPeopleSearchTable({
  people,
  basePath = '/people',
  variant = 'players',
  publicPlayerMode,
  publicCoachMode,
  defaultCountryFilter,
}: {
  people: AdminPersonListItem[]
  basePath?: string
  variant?: PeopleCardVariant
  publicPlayerMode?: PublicPlayerMode
  publicCoachMode?: PublicCoachMode
  defaultCountryFilter?: string
}) {
  type PlayerSortKey = 'appearance_count' | 'goal_count' | 'assist_count' | 'yellow_card_count' | 'red_card_count' | 'minute_count' | 'bench_count'
  type CoachSortKey = 'coach_match_count' | 'coach_wins' | 'coach_draws' | 'coach_losses' | 'coach_goals_scored' | 'coach_goals_conceded' | 'coach_points_per_match'
  type RefereeSortKey = 'referee_match_count' | 'referee_wins' | 'referee_draws' | 'referee_losses' | 'referee_goals_scored' | 'referee_goals_conceded'

  const [sortKey, setSortKey] = useState<PlayerSortKey>('appearance_count')
  const [coachSortKey, setCoachSortKey] = useState<CoachSortKey>('coach_match_count')
  const [refereeSortKey, setRefereeSortKey] = useState<RefereeSortKey>('referee_match_count')
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState(defaultCountryFilter ?? '')
  const [playerMode, setPlayerMode] = useState<PublicPlayerMode>(publicPlayerMode ?? 'poland')
  const [coachMode, setCoachMode] = useState<PublicCoachMode>(publicCoachMode ?? 'poland')
  const [coachDisplayMode, setCoachDisplayMode] = useState<CoachDisplayMode>(
    variant === 'coaches' && publicCoachMode === 'poland' ? 'tenure' : 'stats'
  )
  const [competitionFilters, setCompetitionFilters] = useState<VisibleCoachCompetitionFilter[]>([])
  const [stageFilters, setStageFilters] = useState<CoachStageFilterKey[]>([])
  const [coachDateFrom, setCoachDateFrom] = useState('')
  const [coachDateTo, setCoachDateTo] = useState('')
  const [hasInitializedCoachDateRange, setHasInitializedCoachDateRange] = useState(false)
  const [isCoachRibbonExpanded, setIsCoachRibbonExpanded] = useState(true)
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const viewStateHydratedRef = useRef(false)
  const skipNextCoachModeResetRef = useRef(false)
  const [visibleCount, setVisibleCount] = useState(50)
  const isPublicPlayersView = variant === 'players' && Boolean(publicPlayerMode)
  const isPublicCoachesView = variant === 'coaches' && Boolean(publicCoachMode)
  const isPolandCoachView = isPublicCoachesView && coachMode === 'poland'
  const showCoachStats = !(isPolandCoachView && coachDisplayMode === 'tenure')
  const allCompetitionsActive = competitionFilters.length === 0
  const allStagesActive = stageFilters.length === 0
  const areStageFiltersUnavailable = competitionFilters.length > 0 && competitionFilters.every((key) => key === 'FRIENDLY' || key === 'NATIONS_LEAGUE')

  const initialPublicPlayerModeRef = useRef(publicPlayerMode)
  useEffect(() => {
    if (publicPlayerMode && publicPlayerMode !== initialPublicPlayerModeRef.current) {
      initialPublicPlayerModeRef.current = publicPlayerMode
      setPlayerMode(publicPlayerMode)
    }
  }, [publicPlayerMode])

  const initialPublicCoachModeRef = useRef(publicCoachMode)
  useEffect(() => {
    if (publicCoachMode && publicCoachMode !== initialPublicCoachModeRef.current) {
      initialPublicCoachModeRef.current = publicCoachMode
      setCoachMode(publicCoachMode)
      setCoachDisplayMode(publicCoachMode === 'poland' ? 'tenure' : 'stats')
    }
  }, [publicCoachMode])

  const writeModeToUrl = (mode: PublicCoachMode | PublicPlayerMode | null, kind: 'coach' | 'player') => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const param = kind === 'coach' ? 'coachMode' : 'playerMode'
    if (mode && mode !== 'poland') url.searchParams.set(param, mode)
    else url.searchParams.delete(param)
    const newUrl = url.pathname + (url.search ? url.search : '') + url.hash
    window.history.replaceState(window.history.state, '', newUrl)
  }

  const handleSetCoachMode = (next: PublicCoachMode) => {
    setCoachMode(next)
    setCoachDisplayMode(next === 'poland' ? 'tenure' : 'stats')
    writeModeToUrl(next, 'coach')
  }

  const handleSetPlayerMode = (next: PublicPlayerMode) => {
    setPlayerMode(next)
    writeModeToUrl(next, 'player')
  }

  // Hydrate full view state from history.state on mount and on browser Back/Forward.
  useEffect(() => {
    const storageKey = `${VIEW_STATE_KEY}:${typeof window !== 'undefined' ? window.location.pathname : ''}`
    const readSaved = (): PublicPeopleViewState | null => {
      // Prefer history.state (per-entry, survives Back/Forward), fallback to sessionStorage
      // (per-pathname, survives Next.js internal history rewrites that may drop our key).
      const fromHistory = (window.history.state as { [VIEW_STATE_KEY]?: PublicPeopleViewState } | null)?.[VIEW_STATE_KEY]
      if (fromHistory) return fromHistory
      try {
        const raw = window.sessionStorage.getItem(storageKey)
        if (!raw) return null
        return JSON.parse(raw) as PublicPeopleViewState
      } catch {
        return null
      }
    }
    const applyState = () => {
      const saved = readSaved()
      // URL search params are authoritative for the active mode (Polska/Rywale),
      // because the URL is reliably restored by the browser on Back/Forward.
      const params = new URLSearchParams(window.location.search)
      const urlCoachMode = params.get('coachMode') as PublicCoachMode | null
      const urlPlayerMode = params.get('playerMode') as PublicPlayerMode | null
      if (!saved && !urlCoachMode && !urlPlayerMode) {
        viewStateHydratedRef.current = true
        return
      }
      const merged: PublicPeopleViewState = { ...(saved ?? {}) }
      if (urlCoachMode === 'poland' || urlCoachMode === 'rivals') merged.coachMode = urlCoachMode
      if (urlPlayerMode === 'poland' || urlPlayerMode === 'rivals') merged.playerMode = urlPlayerMode
      if (merged.query !== undefined) setQuery(merged.query)
      if (merged.countryFilter !== undefined) setCountryFilter(merged.countryFilter)
      if (merged.playerMode !== undefined) setPlayerMode(merged.playerMode)
      if (merged.coachMode !== undefined) {
        skipNextCoachModeResetRef.current = true
        setCoachMode(merged.coachMode)
      }
      if (merged.coachDisplayMode !== undefined) setCoachDisplayMode(merged.coachDisplayMode)
      else if (merged.coachMode !== undefined) setCoachDisplayMode(merged.coachMode === 'poland' ? 'tenure' : 'stats')
      if (merged.sortKey !== undefined) setSortKey(merged.sortKey as PlayerSortKey)
      if (merged.coachSortKey !== undefined) setCoachSortKey(merged.coachSortKey as CoachSortKey)
      if (merged.refereeSortKey !== undefined) setRefereeSortKey(merged.refereeSortKey as RefereeSortKey)
      if (merged.competitionFilters !== undefined) setCompetitionFilters(merged.competitionFilters)
      if (merged.stageFilters !== undefined) setStageFilters(merged.stageFilters)
      if (merged.coachDateFrom !== undefined) setCoachDateFrom(merged.coachDateFrom)
      if (merged.coachDateTo !== undefined) setCoachDateTo(merged.coachDateTo)
      if (merged.isCoachRibbonExpanded !== undefined) setIsCoachRibbonExpanded(merged.isCoachRibbonExpanded)
      if (merged.expandedPersonId !== undefined) setExpandedPersonId(merged.expandedPersonId)
      if (merged.visibleCount !== undefined) setVisibleCount(merged.visibleCount)
      setHasInitializedCoachDateRange(true)
      viewStateHydratedRef.current = true
      if (typeof merged.scrollY === 'number') {
        const targetY = merged.scrollY
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo(0, targetY))
        })
      }
    }

    applyState()

    const handlePopState = () => {
      viewStateHydratedRef.current = false
      applyState()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!isPublicCoachesView) return
    if (skipNextCoachModeResetRef.current) {
      skipNextCoachModeResetRef.current = false
      return
    }
    setCompetitionFilters([])
    setStageFilters([])
    setCoachDateFrom('')
    setCoachDateTo('')
    setHasInitializedCoachDateRange(false)
  }, [isPublicCoachesView, coachMode])

  // Persist current view state to history.state on every change (debounced via microtask).
  useEffect(() => {
    if (!viewStateHydratedRef.current) return
    const next: PublicPeopleViewState = {
      query,
      countryFilter,
      playerMode,
      coachMode,
      coachDisplayMode,
      sortKey,
      coachSortKey,
      refereeSortKey,
      competitionFilters,
      stageFilters,
      coachDateFrom,
      coachDateTo,
      isCoachRibbonExpanded,
      expandedPersonId,
      visibleCount,
      scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
    }
    const merged = { ...(window.history.state ?? {}), [VIEW_STATE_KEY]: next }
    window.history.replaceState(merged, '')
    try {
      const storageKey = `${VIEW_STATE_KEY}:${window.location.pathname}`
      window.sessionStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // sessionStorage may be unavailable (private mode, quota) — ignore
    }
  }, [query, countryFilter, playerMode, coachMode, coachDisplayMode, sortKey, coachSortKey, refereeSortKey, competitionFilters, stageFilters, coachDateFrom, coachDateTo, isCoachRibbonExpanded, expandedPersonId, visibleCount])

  // Persist scroll position separately (does not trigger React re-renders).
  useEffect(() => {
    if (typeof window === 'undefined') return
    let scheduled = false
    const handleScroll = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        if (!viewStateHydratedRef.current) return
        const current = (window.history.state as { [VIEW_STATE_KEY]?: PublicPeopleViewState } | null)?.[VIEW_STATE_KEY] ?? {}
        const updated = { ...current, scrollY: window.scrollY }
        const merged = { ...(window.history.state ?? {}), [VIEW_STATE_KEY]: updated }
        window.history.replaceState(merged, '')
        try {
          const storageKey = `${VIEW_STATE_KEY}:${window.location.pathname}`
          window.sessionStorage.setItem(storageKey, JSON.stringify(updated))
        } catch {
          // ignore
        }
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const countryOptions = useMemo(() => {
    if (isPublicPlayersView || isPublicCoachesView) return []

    const countries = new Set<string>()
    for (const person of people) {
      if (variant === 'coaches') {
        person.coached_country_names.forEach(name => countries.add(name))
      } else {
        person.represented_country_names.forEach(name => countries.add(name))
      }
    }
    return [...countries].sort((a, b) => a.localeCompare(b, 'pl'))
  }, [people, variant, isPublicPlayersView, isPublicCoachesView])

  const basePeople = useMemo(() => {
    if (isPublicPlayersView) {
      if (playerMode === 'rivals') {
        return people.filter((person) => person.roles.includes('PLAYER') && Boolean(person.has_played_against_poland))
      }

      return people.filter((person) => person.roles.includes('PLAYER') && Boolean(person.has_represented_poland))
    }

    if (isPublicCoachesView) {
      if (coachMode === 'rivals') {
        return people.filter((person) => person.roles.includes('COACH') && Boolean(person.has_coached_against_poland))
      }

      return people.filter((person) => person.roles.includes('COACH') && Boolean(person.has_coached_poland))
    }

    return people
  }, [isPublicPlayersView, isPublicCoachesView, people, playerMode, coachMode])

  const coachDateBounds = useMemo(() => {
    if (!isPublicCoachesView) return { firstYear: '', lastYear: '' }

    let firstMatchDate: string | null = null
    let lastMatchDate: string | null = null

    for (const person of basePeople) {
      for (const row of person.coach_poland_filter_matches ?? []) {
        const isPolandRow = isPolandCoachFilterRow(row)
        if ((coachMode === 'poland' && !isPolandRow) || (coachMode === 'rivals' && isPolandRow)) continue
        if (!firstMatchDate || row.match_date < firstMatchDate) firstMatchDate = row.match_date
        if (!lastMatchDate || row.match_date > lastMatchDate) lastMatchDate = row.match_date
      }
    }

    return {
      firstYear: firstMatchDate ? firstMatchDate.slice(0, 4) : '',
      lastYear: lastMatchDate ? lastMatchDate.slice(0, 4) : '',
    }
  }, [basePeople, isPublicCoachesView, coachMode])

  useEffect(() => {
    if (!isPublicCoachesView || hasInitializedCoachDateRange) return

    setCoachDateFrom('')
    setCoachDateTo('')
    setHasInitializedCoachDateRange(true)
  }, [coachDateBounds, hasInitializedCoachDateRange, isPublicCoachesView])

  useEffect(() => {
    if (!areStageFiltersUnavailable || stageFilters.length === 0) return
    setStageFilters([])
  }, [areStageFiltersUnavailable, stageFilters])

  const filteredCoachStatsByPersonId = useMemo(() => {
    const map = new Map<string, CoachComputedStats>()
    if (!isPublicCoachesView || !showCoachStats) return map

    const activeCompetitionSet = new Set<VisibleCoachCompetitionFilter>(competitionFilters)
    const activeStageSet = new Set<CoachStageFilterKey>(stageFilters)

    for (const person of basePeople) {
      const rows = person.coach_poland_filter_matches ?? []
      const filteredRows = rows.filter((row) => {
        const isPolandRow = isPolandCoachFilterRow(row)
        if ((coachMode === 'poland' && !isPolandRow) || (coachMode === 'rivals' && isPolandRow)) return false
        const competitionAllowed = allCompetitionsActive
          ? true
          : (row.competition_key !== 'OTHER' && activeCompetitionSet.has(row.competition_key))
        const isPhaselesCompetition = row.competition_key === 'FRIENDLY' || row.competition_key === 'NATIONS_LEAGUE'
        // Phaseless competitions (FRIENDLY, LN) have no stage — exclude them when any stage filter is active
        const stageAllowed = allStagesActive
          ? true
          : (!isPhaselesCompetition && activeStageSet.has(row.stage_key))
        const dateAllowed = isCoachMatchWithinDateRange(row.match_date)
        return competitionAllowed && stageAllowed && dateAllowed
      })

      let wins = 0
      let draws = 0
      let losses = 0
      let goalsScored = 0
      let goalsConceded = 0
      for (const row of filteredRows) {
        goalsScored += row.goals_for
        goalsConceded += row.goals_against
        if (row.outcome === 'W') wins += 1
        else if (row.outcome === 'D') draws += 1
        else if (row.outcome === 'L') losses += 1
      }

      const matchCount = filteredRows.length
      const pointsPerMatch = matchCount > 0 ? Number((((wins * 3) + draws) / matchCount).toFixed(2)) : 0
      map.set(person.id, {
        coach_match_count: matchCount,
        coach_wins: wins,
        coach_draws: draws,
        coach_losses: losses,
        coach_goals_scored: goalsScored,
        coach_goals_conceded: goalsConceded,
        coach_points_per_match: pointsPerMatch,
      })
    }

    return map
  }, [basePeople, competitionFilters, stageFilters, coachDateFrom, coachDateTo, allCompetitionsActive, allStagesActive, isPublicCoachesView, showCoachStats, coachMode])

  const getDisplayedCoachStatValue = (person: AdminPersonListItem, key: CoachSortKey): number => {
    if (isPublicCoachesView && showCoachStats) {
      const stats = filteredCoachStatsByPersonId.get(person.id)
      if (!stats) return 0
      return stats[key]
    }
    return getCoachStatValue(person, key)
  }

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    let base = basePeople
    
    // Apply country filter
    if (!isPublicPlayersView && !isPublicCoachesView && countryFilter) {
      base = base.filter(p => {
        if (variant === 'coaches') {
          return p.coached_country_names.includes(countryFilter)
        } else {
          return p.represented_country_names.includes(countryFilter) || 
                 (p.represented_country_names.length === 0 && p.birth_country_name === countryFilter)
        }
      })
    }

    // Apply search query
    if (q) {
      base = base.filter((p) => 
        normalizeText(getPersonDisplayName(p) ?? '').includes(q) || 
        normalizeText(p.nickname ?? '').includes(q) ||
        normalizeText(p.birth_country_name ?? '').includes(q) ||
        p.represented_country_names.some(name => normalizeText(name).includes(q)) ||
        p.coached_country_names.some(name => normalizeText(name).includes(q))
      )
    }

    if (variant === 'coaches') {
      if (isPolandCoachView && coachDisplayMode === 'tenure') {
        return [...base].sort((a, b) => {
          const aDate = a.coach_poland_first_match_date ?? '9999-12-31'
          const bDate = b.coach_poland_first_match_date ?? '9999-12-31'
          if (aDate !== bDate) return bDate.localeCompare(aDate)
          const aEnd = a.coach_poland_last_match_date ?? '9999-12-31'
          const bEnd = b.coach_poland_last_match_date ?? '9999-12-31'
          if (aEnd !== bEnd) return bEnd.localeCompare(aEnd)
          return getPersonDisplayName(a).localeCompare(getPersonDisplayName(b), 'pl')
        })
      }
      return [...base].sort((a, b) => getDisplayedCoachStatValue(b, coachSortKey) - getDisplayedCoachStatValue(a, coachSortKey))
    }
    if (variant === 'referees') {
      return [...base].sort((a, b) => (b[refereeSortKey] as number) - (a[refereeSortKey] as number))
    }
    if (variant !== 'players') {
      return [...base].sort((a, b) => {
        const aMatches = variant === 'referees' ? a.referee_match_count : a.player_match_count
        const bMatches = variant === 'referees' ? b.referee_match_count : b.player_match_count
        return (b as any)[variant === 'referees' ? 'referee_match_count' : 'player_match_count'] - (a as any)[variant === 'referees' ? 'referee_match_count' : 'player_match_count']
      })
    }
    return [...base].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
  }, [basePeople, query, sortKey, coachSortKey, refereeSortKey, countryFilter, variant, isPublicPlayersView, isPublicCoachesView, coachDisplayMode, isPolandCoachView, filteredCoachStatsByPersonId])

  useEffect(() => {
    setVisibleCount(50)
  }, [query, countryFilter, sortKey, coachSortKey, refereeSortKey, variant, playerMode, coachMode, coachDisplayMode, competitionFilters, stageFilters, coachDateFrom, coachDateTo])

  function StatsBarsIcon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <rect x="4" y="12" width="3" height="8" rx="1" className="fill-current" />
        <rect x="10" y="8" width="3" height="12" rx="1" className="fill-current" />
        <rect x="16" y="4" width="3" height="16" rx="1" className="fill-current" />
      </svg>
    )
  }

  function ListIcon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <rect x="4" y="6" width="16" height="2" rx="1" className="fill-current" />
        <rect x="4" y="11" width="16" height="2" rx="1" className="fill-current" />
        <rect x="4" y="16" width="16" height="2" rx="1" className="fill-current" />
      </svg>
    )
  }

  function FilterIcon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M4 6h16l-6.2 7.2v4.6l-3.6 1.8v-6.4L4 6z" className="fill-current" />
      </svg>
    )
  }

  function toggleCompetitionFilter(key: VisibleCoachCompetitionFilter) {
    setCompetitionFilters((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key)
      }
      return [...current, key]
    })
  }

  function toggleStageFilter(key: CoachStageFilterKey) {
    setStageFilters((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key)
      }
      return [...current, key]
    })
  }

  function clearCoachDateFilters() {
    setCoachDateFrom('')
    setCoachDateTo('')
  }

  function resetCoachFilters() {
    setCompetitionFilters([])
    setStageFilters([])
    clearCoachDateFilters()
  }

  function setCoachCenturyRange(century: 'XX' | 'XXI') {
    if (century === 'XX') {
      setCoachDateFrom('1901')
      setCoachDateTo('2000')
      return
    }

    setCoachDateFrom('2001')
    setCoachDateTo('2100')
  }

  function isCoachMatchWithinDateRange(matchDate: string) {
    const matchYear = Number(matchDate.slice(0, 4))
    const fromYear = /^\d{4}$/.test(coachDateFrom) ? Number(coachDateFrom) : null
    const toYear = /^\d{4}$/.test(coachDateTo) ? Number(coachDateTo) : null

    if (fromYear !== null && matchYear < fromYear) return false
    if (toYear !== null && matchYear > toYear) return false
    return true
  }

  const isTwentiethCenturyActive = coachDateFrom === '1901' && coachDateTo === '2000'
  const isTwentyFirstCenturyActive = coachDateFrom === '2001' && coachDateTo === '2100'
  const activeCoachFilterCount = competitionFilters.length + stageFilters.length + (coachDateFrom ? 1 : 0) + (coachDateTo ? 1 : 0)

  const coachFilterControls = (
    <>
      <RibbonSection title="Rozgrywki" className="min-w-[8.2rem]">
        <div className="space-y-1">
          <div className="flex">
            <button
              type="button"
              onClick={() => setCompetitionFilters([])}
              aria-pressed={allCompetitionsActive}
              className={`inline-flex h-5 w-full items-center justify-center whitespace-nowrap rounded-md border px-1.5 !text-[10.1px] font-semibold leading-none transition-colors ${allCompetitionsActive
                ? 'border-emerald-950/85 bg-[linear-gradient(180deg,rgba(30,120,78,0.95)_0%,rgba(22,93,63,0.94)_52%,rgba(14,63,45,0.97)_100%)] text-emerald-50 shadow-[inset_0_3px_6px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(0,0,0,0.35),inset_0_-1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.35)]'
                : 'border-emerald-500/65 bg-[linear-gradient(180deg,rgba(90,190,130,0.9)_0%,rgba(45,148,93,0.85)_42%,rgba(22,88,58,0.92)_100%)] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.28)] hover:border-emerald-300/80 hover:brightness-105'
              }`}
            >
              Wszystkie
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {([
              ['WORLD_CUP', 'MŚ'],
              ['EURO', 'ME'],
              ['FRIENDLY', 'T'],
              ['NATIONS_LEAGUE', 'LN'],
            ] as Array<[VisibleCoachCompetitionFilter, string]>).map(([key, label]) => {
              const active = competitionFilters.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleCompetitionFilter(key)}
                  aria-pressed={active}
                  className={`inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md border px-1.5 !text-[10.1px] font-semibold leading-none transition-colors ${active
                    ? 'border-emerald-950/85 bg-[linear-gradient(180deg,rgba(30,120,78,0.95)_0%,rgba(22,93,63,0.94)_52%,rgba(14,63,45,0.97)_100%)] text-emerald-50 shadow-[inset_0_3px_6px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(0,0,0,0.35),inset_0_-1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.35)]'
                    : 'border-emerald-500/65 bg-[linear-gradient(180deg,rgba(90,190,130,0.9)_0%,rgba(45,148,93,0.85)_42%,rgba(22,88,58,0.92)_100%)] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.28)] hover:border-emerald-300/80 hover:brightness-105'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </RibbonSection>

      <RibbonSection title="Faza" className="min-w-[7.2rem]">
        <div className="space-y-1">
          <div className="flex">
            <button
              type="button"
              onClick={() => setStageFilters([])}
              aria-pressed={allStagesActive}
              disabled={areStageFiltersUnavailable}
              className={`inline-flex h-5 w-full items-center justify-center whitespace-nowrap rounded-md border px-1.5 !text-[10.1px] font-semibold leading-none transition-colors ${areStageFiltersUnavailable
                ? 'cursor-not-allowed border-emerald-900/70 bg-emerald-950/35 text-emerald-200/35 shadow-none'
                : allStagesActive
                  ? 'border-emerald-950/85 bg-[linear-gradient(180deg,rgba(30,120,78,0.95)_0%,rgba(22,93,63,0.94)_52%,rgba(14,63,45,0.97)_100%)] text-emerald-50 shadow-[inset_0_3px_6px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(0,0,0,0.35),inset_0_-1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.35)]'
                  : 'border-emerald-500/65 bg-[linear-gradient(180deg,rgba(90,190,130,0.9)_0%,rgba(45,148,93,0.85)_42%,rgba(22,88,58,0.92)_100%)] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.28)] hover:border-emerald-300/80 hover:brightness-105'
              }`}
            >
              Wszystkie
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {([
              ['TOURNAMENT', 'Turniej'],
              ['QUALIFIERS', 'El.'],
              ['PLAYOFFS', 'Baraże'],
            ] as Array<[CoachStageFilterKey, string]>).map(([key, label]) => {
              const active = stageFilters.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleStageFilter(key)}
                  aria-pressed={active}
                  disabled={areStageFiltersUnavailable}
                  className={`inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md border px-1.5 !text-[10.1px] font-semibold leading-none transition-colors ${areStageFiltersUnavailable
                    ? 'cursor-not-allowed border-emerald-900/70 bg-emerald-950/35 text-emerald-200/35 shadow-none'
                    : active
                      ? 'border-emerald-950/85 bg-[linear-gradient(180deg,rgba(30,120,78,0.95)_0%,rgba(22,93,63,0.94)_52%,rgba(14,63,45,0.97)_100%)] text-emerald-50 shadow-[inset_0_3px_6px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(0,0,0,0.35),inset_0_-1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.35)]'
                      : 'border-emerald-500/65 bg-[linear-gradient(180deg,rgba(90,190,130,0.9)_0%,rgba(45,148,93,0.85)_42%,rgba(22,88,58,0.92)_100%)] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.28)] hover:border-emerald-300/80 hover:brightness-105'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </RibbonSection>

      <RibbonSection title="Okres" className="min-w-[10.2rem]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setCoachDateFrom(coachDateBounds.firstYear)
              setCoachDateTo(coachDateBounds.lastYear)
            }}
            className="inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md border border-emerald-500/65 bg-[linear-gradient(180deg,rgba(89,190,131,0.9)_0%,rgba(48,150,97,0.86)_44%,rgba(23,91,60,0.92)_100%)] px-1.5 !text-[10.1px] font-semibold leading-none text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.28)] transition-colors hover:border-emerald-300/80 hover:brightness-105"
            aria-label="Cały okres"
          >
            Cały okres
          </button>
          <button
            type="button"
            onClick={() => setCoachCenturyRange('XX')}
            aria-pressed={isTwentiethCenturyActive}
            className={`inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md border px-1.5 !text-[10.1px] font-semibold leading-none transition-colors ${isTwentiethCenturyActive
              ? 'border-emerald-950/85 bg-[linear-gradient(180deg,rgba(30,120,78,0.95)_0%,rgba(22,93,63,0.94)_52%,rgba(14,63,45,0.97)_100%)] text-emerald-50 shadow-[inset_0_3px_6px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(0,0,0,0.35),inset_0_-1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.35)]'
              : 'border-emerald-500/65 bg-[linear-gradient(180deg,rgba(90,190,130,0.9)_0%,rgba(45,148,93,0.85)_42%,rgba(22,88,58,0.92)_100%)] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.28)] hover:border-emerald-300/80 hover:brightness-105'
            }`}
          >
            XX w.
          </button>
          <button
            type="button"
            onClick={() => setCoachCenturyRange('XXI')}
            aria-pressed={isTwentyFirstCenturyActive}
            className={`inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md border px-1.5 !text-[10.1px] font-semibold leading-none transition-colors ${isTwentyFirstCenturyActive
              ? 'border-emerald-950/85 bg-[linear-gradient(180deg,rgba(30,120,78,0.95)_0%,rgba(22,93,63,0.94)_52%,rgba(14,63,45,0.97)_100%)] text-emerald-50 shadow-[inset_0_3px_6px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(0,0,0,0.35),inset_0_-1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.35)]'
              : 'border-emerald-500/65 bg-[linear-gradient(180deg,rgba(90,190,130,0.9)_0%,rgba(45,148,93,0.85)_42%,rgba(22,88,58,0.92)_100%)] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.28)] hover:border-emerald-300/80 hover:brightness-105'
            }`}
          >
            XXI w.
          </button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-[9px] font-semibold text-emerald-100/70 whitespace-nowrap">Zakres lat</div>
          <input
            type="text"
            value={coachDateFrom}
            onChange={(event) => setCoachDateFrom(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            placeholder="Od"
            className="h-5 w-[3.25rem] rounded-md border border-emerald-700/75 bg-emerald-950/45 px-1.5 text-center !text-[10.1px] font-semibold leading-none text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_2px_rgba(0,0,0,0.28)] placeholder:text-emerald-200/55 focus:border-emerald-300/80 focus:outline-none"
            aria-label="Rok od"
          />
          <input
            type="text"
            value={coachDateTo}
            onChange={(event) => setCoachDateTo(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            placeholder="Do"
            className="h-5 w-[3.25rem] rounded-md border border-emerald-700/75 bg-emerald-950/45 px-1.5 text-center !text-[10.1px] font-semibold leading-none text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_2px_rgba(0,0,0,0.28)] placeholder:text-emerald-200/55 focus:border-emerald-300/80 focus:outline-none"
            aria-label="Rok do"
          />
          </div>
        </div>
      </RibbonSection>
    </>
  )

  const displayed = filtered.slice(0, visibleCount)

  function getFilteredMatchesForCoach(person: AdminPersonListItem): AdminCoachMatch[] {
    const rows = person.coach_poland_filter_matches ?? []
    const activeCompetitionSet = new Set<VisibleCoachCompetitionFilter>(competitionFilters)
    const activeStageSet = new Set<CoachStageFilterKey>(stageFilters)

    const filteredRows = rows.filter((row: CoachPolandFilterMatch) => {
      const isPolandRow = isPolandCoachFilterRow(row)
      if ((coachMode === 'poland' && !isPolandRow) || (coachMode === 'rivals' && isPolandRow)) return false
      const competitionAllowed = allCompetitionsActive
        ? true
        : (row.competition_key !== 'OTHER' && activeCompetitionSet.has(row.competition_key as VisibleCoachCompetitionFilter))
      const isPhaselesCompetition = row.competition_key === 'FRIENDLY' || row.competition_key === 'NATIONS_LEAGUE'
      const stageAllowed = allStagesActive
        ? true
        : (!isPhaselesCompetition && activeStageSet.has(row.stage_key))
      const dateAllowed = isCoachMatchWithinDateRange(row.match_date)
      return competitionAllowed && stageAllowed && dateAllowed
    })

    return filteredRows
      .sort((a: CoachPolandFilterMatch, b: CoachPolandFilterMatch) => a.match_date < b.match_date ? -1 : a.match_date > b.match_date ? 1 : 0)
      .map((row: CoachPolandFilterMatch): AdminCoachMatch => ({
        id: row.match_id,
        match_date: row.match_date,
        match_time: row.match_time,
        match_status: row.match_status as AdminCoachMatch['match_status'],
        result_type: row.result_type as AdminCoachMatch['result_type'],
        walkover_winner_team_id: row.walkover_winner_team_id,
        editorial_status: row.editorial_status as AdminCoachMatch['editorial_status'],
        competition_name: row.competition_name,
        match_level_name: row.match_level_name,
        home_team_name: row.home_team_name,
        away_team_name: row.away_team_name,
        home_team_fifa_code: row.home_team_fifa_code,
        away_team_fifa_code: row.away_team_fifa_code,
        final_score: row.final_score,
        shootout_score: row.shootout_score,
        coach_team_id: row.coach_team_id,
        coach_team_fifa_code: row.coach_team_fifa_code,
        coach_is_home: row.coach_is_home,
      }))
  }

  function computeYearStats(matches: AdminCoachMatch[]): Record<string, AdminCoachYearStats> {
    const result: Record<string, AdminCoachYearStats> = {}
    for (const match of matches) {
      const year = match.match_date.slice(0, 4)
      if (!result[year]) {
        result[year] = { match_count: 0, win_count: 0, draw_count: 0, loss_count: 0, goals_scored: 0, goals_conceded: 0, points_total: 0, points_per_match: 0 }
      }
      const s = result[year]
      s.match_count += 1
      if (match.final_score) {
        const [h, a] = match.final_score.split(':').map(Number)
        const coachGoals = match.coach_is_home ? h : a
        const oppGoals = match.coach_is_home ? a : h
        s.goals_scored += coachGoals ?? 0
        s.goals_conceded += oppGoals ?? 0
        const isPenalties = match.result_type === 'PENALTIES' || match.result_type === 'EXTRA_TIME_AND_PENALTIES'
        if (isPenalties) {
          s.draw_count += 1
        } else if ((coachGoals ?? 0) > (oppGoals ?? 0)) {
          s.win_count += 1
          s.points_total += 3
        } else if ((coachGoals ?? 0) < (oppGoals ?? 0)) {
          s.loss_count += 1
        } else {
          s.draw_count += 1
          s.points_total += 1
        }
      }
      s.points_per_match = s.match_count > 0 ? s.points_total / s.match_count : 0
    }
    return result
  }

  function renderStatBadge(value: number) {
    return value > 0
      ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value}</span>
      : <span className="text-sm text-neutral-600">–</span>
  }

  function renderCoachPointsPerMatchBadge(value: number) {
    return <span className="stat-badge inline-flex min-w-[3rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  }

  function getCoachStatValue(person: AdminPersonListItem, key: CoachSortKey): number {
    if (!isPublicCoachesView) {
      return person[key]
    }

    if (coachMode === 'poland') {
      if (key === 'coach_match_count') return person.coach_poland_match_count
      if (key === 'coach_wins') return person.coach_poland_wins
      if (key === 'coach_draws') return person.coach_poland_draws
      if (key === 'coach_losses') return person.coach_poland_losses
      if (key === 'coach_goals_scored') return person.coach_poland_goals_scored
      if (key === 'coach_goals_conceded') return person.coach_poland_goals_conceded
      return person.coach_poland_points_per_match
    }

    if (key === 'coach_match_count') return person.coach_against_poland_match_count
    if (key === 'coach_wins') return person.coach_against_poland_wins
    if (key === 'coach_draws') return person.coach_against_poland_draws
    if (key === 'coach_losses') return person.coach_against_poland_losses
    if (key === 'coach_goals_scored') return person.coach_against_poland_goals_scored
    if (key === 'coach_goals_conceded') return person.coach_against_poland_goals_conceded
    return person.coach_against_poland_points_per_match
  }

  return (
    <div className="space-y-3">
      {/* Search bar and filter — blends with green card */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {isPublicCoachesView && isPolandCoachView ? (
          <button
            type="button"
            onClick={() => setCoachDisplayMode((current) => (current === 'stats' ? 'tenure' : 'stats'))}
            title={coachDisplayMode === 'stats' ? 'Pokaż listę kadencji' : 'Pokaż widok statystyk'}
            aria-label={coachDisplayMode === 'stats' ? 'Pokaż listę kadencji' : 'Pokaż widok statystyk'}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${coachDisplayMode === 'stats'
              ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
              : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/80 hover:border-emerald-400/70 hover:text-emerald-50'
            }`}
          >
            {coachDisplayMode === 'stats' ? <ListIcon className="h-4 w-4" /> : <StatsBarsIcon className="h-4 w-4" />}
          </button>
        ) : null}

        {isPublicCoachesView && showCoachStats ? (
          <button
            type="button"
            onClick={() => setIsCoachRibbonExpanded((current) => !current)}
            title={isCoachRibbonExpanded ? 'Zwiń wstążkę filtrów' : 'Rozwiń wstążkę filtrów'}
            aria-label="Filtruj"
            aria-pressed={isCoachRibbonExpanded}
            className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${isCoachRibbonExpanded
              ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
              : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/80 hover:border-emerald-400/70 hover:text-emerald-50'
            }`}
          >
            <FilterIcon className="h-4 w-4" />
            {activeCoachFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-500 px-1 text-[10px] font-bold text-emerald-950">
                {activeCoachFilterCount}
              </span>
            ) : null}
          </button>
        ) : null}

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={variant === 'coaches' ? 'Wpisz imię lub nazwisko trenera...' : variant === 'referees' ? 'Wpisz imię lub nazwisko sędziego...' : 'Wpisz imię lub nazwisko gracza...'}
            className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-300/40 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        </div>
        {isPublicPlayersView ? (
          <div className="grid w-full grid-cols-2 gap-2 sm:w-72">
            <button
              type="button"
              onClick={() => handleSetPlayerMode('poland')}
              aria-pressed={playerMode === 'poland'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${playerMode === 'poland'
                ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
              }`}
            >
              Polska
            </button>
            <button
              type="button"
              onClick={() => handleSetPlayerMode('rivals')}
              aria-pressed={playerMode === 'rivals'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${playerMode === 'rivals'
                ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
              }`}
            >
              Rywale
            </button>
          </div>
        ) : isPublicCoachesView ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <div className="grid w-full grid-cols-2 gap-2 sm:w-72">
            <button
              type="button"
              onClick={() => handleSetCoachMode('poland')}
              aria-pressed={coachMode === 'poland'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${coachMode === 'poland'
                ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
              }`}
            >
              Polska
            </button>
            <button
              type="button"
              onClick={() => handleSetCoachMode('rivals')}
              aria-pressed={coachMode === 'rivals'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${coachMode === 'rivals'
                ? 'border-emerald-300/80 bg-emerald-700/55 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]'
                : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200/70 hover:border-emerald-400/70 hover:text-emerald-50'
              }`}
            >
              Rywale
            </button>
            </div>
          </div>
        ) : (
          <div className="w-full sm:w-52">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50 focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
            >
              <option value="">Wszystkie kraje</option>
              {countryOptions.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isPublicCoachesView && showCoachStats ? (
        <FilterRibbon
          title="Filtry"
          expanded={isCoachRibbonExpanded}
          onToggle={() => setIsCoachRibbonExpanded((current) => !current)}
          activeCount={activeCoachFilterCount}
          onReset={resetCoachFilters}
        >
          {coachFilterControls}
        </FilterRibbon>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full border-collapse text-sm table-auto">
          <colgroup>
            <col className="w-8" />
            <col className="min-w-[440px]" />
            {variant === 'coaches' ? (
              showCoachStats ? (
                <>
                  <col className="w-[4.5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[5rem]" />
                </>
              ) : null
            ) : variant === 'referees' ? (
              <>
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
              </>
            ) : (
              <>
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
              </>
            )}
          </colgroup>
          <thead>
            <tr className="h-[52px] border-b border-neutral-800 bg-neutral-900 text-left">
              <th className="px-4 py-3 font-medium text-neutral-400" />
              <th className="px-4 py-3 font-medium text-neutral-400" />
              {variant === 'coaches' ? (
                showCoachStats ? (
                <>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_match_count'} onClick={() => setCoachSortKey('coach_match_count')} icon={<span className="text-xs font-bold">M</span>} label={coachMode === 'rivals' ? 'Mecze przeciwko Polsce' : 'Mecze'} />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_wins'} onClick={() => setCoachSortKey('coach_wins')} icon={<span className="text-xs font-bold">Z</span>} label="Zwycięstwa" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_draws'} onClick={() => setCoachSortKey('coach_draws')} icon={<span className="text-xs font-bold">R</span>} label="Remisy" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_losses'} onClick={() => setCoachSortKey('coach_losses')} icon={<span className="text-xs font-bold">P</span>} label="Porażki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_goals_scored'} onClick={() => setCoachSortKey('coach_goals_scored')} icon={<span className="text-xs font-bold">G+</span>} label="Bramki strzelone" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_goals_conceded'} onClick={() => setCoachSortKey('coach_goals_conceded')} icon={<span className="text-xs font-bold">G-</span>} label="Bramki stracone" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={coachSortKey === 'coach_points_per_match'} onClick={() => setCoachSortKey('coach_points_per_match')} icon={<span className="text-xs font-bold">ŚR.P.</span>} label="Średnia liczba punktów na mecz" />
                  </th>
                </>
                ) : null
              ) : variant === 'referees' ? (
                <>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_match_count'} onClick={() => setRefereeSortKey('referee_match_count')} icon={<span className="text-xs font-bold">M</span>} label="Mecze" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_wins'} onClick={() => setRefereeSortKey('referee_wins')} icon={<span className="text-xs font-bold">Z</span>} label="Zwycięstwa Polski" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_draws'} onClick={() => setRefereeSortKey('referee_draws')} icon={<span className="text-xs font-bold">R</span>} label="Remisy" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_losses'} onClick={() => setRefereeSortKey('referee_losses')} icon={<span className="text-xs font-bold">P</span>} label="Porażki Polski" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_goals_scored'} onClick={() => setRefereeSortKey('referee_goals_scored')} icon={<span className="text-xs font-bold">G+</span>} label="Bramki strzelone przez Polskę" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={refereeSortKey === 'referee_goals_conceded'} onClick={() => setRefereeSortKey('referee_goals_conceded')} icon={<span className="text-xs font-bold">G-</span>} label="Bramki stracone przez Polskę" />
                  </th>
                </>
              ) : (
                <>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'appearance_count'} onClick={() => setSortKey('appearance_count')} icon={<PitchIcon className="h-5 w-5" />} label="Występy" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'goal_count'} onClick={() => setSortKey('goal_count')} icon={<GoalIcon className="h-5 w-5" />} label="Bramki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'assist_count'} onClick={() => setSortKey('assist_count')} icon={<AssistIcon className="h-5 w-5" />} label="Asysty" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'yellow_card_count'} onClick={() => setSortKey('yellow_card_count')} icon={<YellowCardIcon className="h-5 w-5" />} label="Żółte kartki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'red_card_count'} onClick={() => setSortKey('red_card_count')} icon={<RedCardIcon className="h-5 w-5" />} label="Czerwone kartki" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'bench_count'} onClick={() => setSortKey('bench_count')} icon={<BenchIcon className="h-5 w-5" />} label="Ławka rezerwowych" />
                  </th>
                  <th className="px-1 py-3 text-center font-medium text-neutral-400">
                    <SortableStatHeader active={sortKey === 'minute_count'} onClick={() => setSortKey('minute_count')} icon={<ClockIcon className="h-5 w-5" />} label="Minuty" />
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td
                  colSpan={variant === 'coaches' ? (showCoachStats ? 9 : 2) : variant === 'referees' ? 8 : 9}
                  className="px-4 py-8 text-center text-sm text-neutral-500"
                >
                  Brak wynikow.
                </td>
              </tr>
            ) : (
              displayed.map((person, i) => {
                const canExpandCoachRow = isPublicCoachesView && showCoachStats
                const isExpanded = canExpandCoachRow && expandedPersonId === person.id
                const colSpanCount = variant === 'coaches' ? (showCoachStats ? 9 : 2) : variant === 'referees' ? 8 : 9
                return (
                <Fragment key={person.id}>
                <tr
                  className={`table-data-row border-b border-neutral-800 last:border-b-0 bg-neutral-950 transition-colors hover:bg-neutral-900/60${canExpandCoachRow ? ' cursor-pointer select-none' : ''}`}
                  onClick={canExpandCoachRow ? () => setExpandedPersonId((prev) => prev === person.id ? null : person.id) : undefined}
                >
                  <td className="pl-4 pr-1 py-3 text-neutral-500 text-sm">{i + 1}</td>
                  <td className="pl-1 pr-4 py-3">
                    {isPolandCoachView && coachDisplayMode === 'tenure' ? (
                      <div className="grid w-full grid-cols-[minmax(0,1fr)_11.5rem_minmax(0,1fr)] items-center gap-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <SmartPrefetchLink
                            href={`${basePath}/${person.id}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {getPersonDisplayName(person)}
                            {person.death_date && (
                              <span className="font-black text-neutral-500">&#x2020;</span>
                            )}
                            {getAgeDisplay(person) && (
                              <span className="text-neutral-500 font-normal">{getAgeDisplay(person)}</span>
                            )}
                          </SmartPrefetchLink>
                          {person.birth_country_name ? (
                            <CountryFlag
                              fifaCode={person.birth_country_fifa_code ?? null}
                              countryName={person.birth_country_name}
                              className="h-3.5 w-[21px] shrink-0"
                            />
                          ) : null}
                        </div>

                        <div className="flex justify-center">
                          <span className="stat-badge inline-flex w-[11.5rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-2 py-0.5 text-center shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.96rem] leading-none font-semibold text-neutral-200 light:text-neutral-900">
                            {getCoachTenureLabel(person)}
                          </span>
                        </div>

                        <div className="flex justify-end">
                          <span
                            title="Mecze | Z-R-P | Gole"
                            className="stat-badge inline-flex w-[16.5rem] shrink-0 items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-2 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.88rem] font-semibold tabular-nums text-neutral-200 light:text-neutral-900"
                          >
                            <span className="w-[2.4rem] text-center">{person.coach_poland_match_count}</span>
                            <span className="w-4 text-center text-neutral-500 light:text-neutral-400">|</span>
                            <span className="w-[5.4rem] text-center">{person.coach_poland_wins}<span className="mx-[2px] font-normal text-neutral-500 light:text-neutral-400">-</span>{person.coach_poland_draws}<span className="mx-[2px] font-normal text-neutral-500 light:text-neutral-400">-</span>{person.coach_poland_losses}</span>
                            <span className="w-4 text-center text-neutral-500 light:text-neutral-400">|</span>
                            <span className="w-[5.4rem] text-center">{person.coach_poland_goals_scored}<span className="mx-[2px] font-normal text-neutral-500 light:text-neutral-400">-</span>{person.coach_poland_goals_conceded}</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full items-center gap-2.5">
                        <SmartPrefetchLink
                          href={`${basePath}/${person.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {getPersonDisplayName(person)}
                          {person.death_date && (
                            <span className="font-black text-neutral-500">&#x2020;</span>
                          )}
                          {getAgeDisplay(person) && (
                            <span className="text-neutral-500 font-normal">{getAgeDisplay(person)}</span>
                          )}
                        </SmartPrefetchLink>
                        {variant === 'coaches' ? (
                          isPublicCoachesView && coachMode === 'poland' ? (
                            person.birth_country_name ? (
                              <CountryFlag
                                fifaCode={person.birth_country_fifa_code ?? null}
                                countryName={person.birth_country_name}
                                className="h-3.5 w-[21px] shrink-0"
                              />
                            ) : null
                          ) : person.coached_country_names.length > 0 ? (
                            <div className="flex items-center gap-0.5">
                              {person.coached_country_names
                                .map((name, idx) => ({ name, fifaCode: person.coached_country_fifa_codes?.[idx] ?? null }))
                                .filter((country) => country.name !== 'Polska')
                                .map((country, idx) => (
                                  <CountryFlag
                                    key={`${country.name}-${idx}`}
                                    fifaCode={country.fifaCode}
                                    countryName={country.name}
                                    className="h-3.5 w-[21px] shrink-0"
                                  />
                                ))}
                            </div>
                          ) : null
                        ) : (
                          person.represented_country_fifa_codes.length > 0 ? (
                            <div className="flex items-center gap-0.5">
                              {person.represented_country_names.map((name, idx) => (
                                <CountryFlag
                                  key={`${name}-${idx}`}
                                  fifaCode={person.represented_country_fifa_codes[idx] ?? null}
                                  countryName={name}
                                  className="h-3.5 w-[21px] shrink-0"
                                />
                              ))}
                              {isPublicPlayersView && playerMode === 'poland' && person.birth_country_name && person.birth_country_name !== 'Polska' && (
                                <>
                                  <span className="mx-0.5 text-neutral-600 text-[10px]">·</span>
                                  <CountryFlag
                                    fifaCode={person.birth_country_fifa_code ?? null}
                                    countryName={person.birth_country_name}
                                    className="h-3.5 w-[21px] shrink-0 opacity-60"
                                  />
                                </>
                              )}
                            </div>
                          ) : null
                        )}
                      </div>
                    )}
                  </td>
                  {variant === 'coaches' ? (
                    showCoachStats ? (
                    <>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getDisplayedCoachStatValue(person, 'coach_match_count'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getDisplayedCoachStatValue(person, 'coach_wins'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getDisplayedCoachStatValue(person, 'coach_draws'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getDisplayedCoachStatValue(person, 'coach_losses'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getDisplayedCoachStatValue(person, 'coach_goals_scored'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(getDisplayedCoachStatValue(person, 'coach_goals_conceded'))}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderCoachPointsPerMatchBadge(getDisplayedCoachStatValue(person, 'coach_points_per_match'))}
                      </td>
                    </>
                    ) : null
                  ) : variant === 'referees' ? (
                    <>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_match_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_wins)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_draws)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_losses)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_goals_scored)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.referee_goals_conceded)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.appearance_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.goal_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.assist_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.yellow_card_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.red_card_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.bench_count)}
                      </td>
                      <td className="px-1 py-3 text-center">
                        {renderStatBadge(person.minute_count)}
                      </td>
                    </>
                  )}
                </tr>
                {isExpanded && (() => {
                  const filteredMatches = getFilteredMatchesForCoach(person)
                  if (filteredMatches.length === 0) {
                    return (
                      <tr>
                        <td colSpan={colSpanCount} className="px-4 py-8 text-center text-sm text-neutral-500">
                          Brak meczów pasujących do aktywnych filtrów.
                        </td>
                      </tr>
                    )
                  }

                  const matchesByYear = filteredMatches.reduce<Record<string, AdminCoachMatch[]>>((acc, match) => {
                    const year = match.match_date.slice(0, 4)
                    if (!acc[year]) acc[year] = []
                    acc[year].push(match)
                    return acc
                  }, {})
                  const years = Object.keys(matchesByYear).sort((a, b) => Number(b) - Number(a))

                  return (
                    <tr>
                      <td colSpan={colSpanCount} className="p-0">
                        <div className="space-y-0">
                          {years.map((year) => (
                            <details key={year} className="group/year bg-emerald-950/20 rounded-lg overflow-hidden">
                              <summary className="relative z-20 grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_1.25rem] items-center gap-3 border-t border-emerald-900/70 bg-emerald-950/38 px-3 py-2 marker:content-none pointer-events-auto rounded-t-lg">
                                <span className="relative inline-flex items-center overflow-hidden rounded-md border border-white/35 bg-slate-950/36 px-[11px] py-[5px] text-[13px] font-black text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_1px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.55),0_4px_8px_rgba(0,0,0,0.3)]">
                                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]" />
                                  <span className="relative z-10">{year}</span>
                                </span>
                                <div className="mr-2 min-w-0 flex items-center gap-2">
                                  <span className="ml-auto min-w-0 text-right text-[13px] font-black text-neutral-300">
                                    <span className="inline-flex items-center justify-end gap-0.5">
                                      <PitchIcon className="h-4 w-4 text-neutral-400" />
                                      <span className="inline-flex min-w-[2.6rem] items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200">
                                        {matchesByYear[year].length}
                                      </span>
                                    </span>
                                  </span>
                                </div>
                                <GlossyDisclosureCircle rotateClassName="group-open/year:rotate-180" className="justify-self-end" />
                              </summary>

                              <div className="relative z-0 overflow-clip rounded-b-lg">
                                <div className="overflow-x-auto pt-6 -mt-6">
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
                                      const showLevel = Boolean(
                                        match.match_level_name
                                        && match.competition_name !== 'Towarzyski'
                                        && match.competition_name !== 'Nieoficjalny'
                                      )
                                      const matchHref = `/matches/${match.id}`

                                      return (
                                        <tr
                                          key={match.id}
                                          className="border-t border-neutral-800 bg-neutral-950 transition-colors hover:bg-neutral-900/60"
                                        >
                                          <td className="whitespace-nowrap">
                                            <Link href={matchHref} className="block px-3 py-3" aria-label={`Otwórz mecz ${match.home_team_name} - ${match.away_team_name}`}>
                                              <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200">
                                                {formatDate(match.match_date)}
                                              </span>
                                            </Link>
                                          </td>
                                          <td className="whitespace-nowrap font-semibold text-neutral-100">
                                            <Link href={matchHref} className="block pl-1 pr-2 py-3">
                                              {getTeamFifaCodeLabel(match.home_team_name, match.home_team_fifa_code)} - {getTeamFifaCodeLabel(match.away_team_name, match.away_team_fifa_code)}
                                            </Link>
                                          </td>
                                          <td className="whitespace-nowrap text-left">
                                            <Link href={matchHref} className="block pl-0 pr-2 py-3">
                                              {renderScoreWithFlags(match, false)}
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
                                                {showLevel && (
                                                  <span className="text-[10px] text-neutral-500">{match.match_level_name}</span>
                                                )}
                                              </span>
                                            </Link>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })()}
                </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > visibleCount && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + 50)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            Pokaż kolejne {Math.min(50, filtered.length - visibleCount)}
          </button>
        </div>
      )}
    </div>
  )
}
