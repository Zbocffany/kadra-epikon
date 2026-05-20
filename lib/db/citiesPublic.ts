import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPublicCacheKey } from '@/lib/db/publicCache'
import {
  loadCityCountryPeriodsMap,
  loadCountryInfoMap,
  resolveCityCountry,
  type ResolvedCityCountry,
} from '@/lib/db/cityCountryResolver'

// === Typy publicznego profilu miasta ====================================

export type PublicCityPersonRole = 'PLAYER' | 'COACH' | 'REFEREE'

export type PublicCityPerson = {
  id: string
  display_name: string
  birth_date: string | null
  death_date: string | null
  roles: PublicCityPersonRole[]
}

export type PublicCityClub = {
  id: string
  name: string
  founded_date: string | null
}

export type PublicCityMatchSummary = {
  id: string
  match_date: string | null
  home_team_name: string
  home_team_fifa_code: string | null
  away_team_name: string
  away_team_fifa_code: string | null
  stadium_name: string | null
}

export type PublicCityPeriodEntry = {
  id: string
  country_id: string
  country_name: string | null
  country_fifa_code: string | null
  valid_from: string | null
  valid_to: string | null
}

export type PublicCityProfile = {
  id: string
  city_name: string
  voivodeship: string | null
  current_country: ResolvedCityCountry
  periods: PublicCityPeriodEntry[]
  people: PublicCityPerson[]
  clubs: PublicCityClub[]
  matches: PublicCityMatchSummary[]
}

// === Implementacja ======================================================

function buildPersonDisplayName(p: {
  first_name: string | null
  last_name: string | null
  nickname: string | null
}): string {
  const first = p.first_name?.trim() ?? ''
  const last = p.last_name?.trim() ?? ''
  const nickname = p.nickname?.trim() ?? ''
  const full = `${first} ${last}`.trim()
  if (full && nickname) return `${full} "${nickname}"`
  if (full) return full
  if (nickname) return nickname
  return '—'
}

async function getAdminCityProfile(id: string): Promise<PublicCityProfile | null> {
  const supabase = createServiceRoleClient()

  // 1. Miasto.
  const { data: city, error: cityError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name, voivodeship')
    .eq('id', id)
    .maybeSingle()
  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)
  if (!city) return null

  // 2. Okresy miasto→kraj + kraje.
  const cityPeriodsMap = await loadCityCountryPeriodsMap(supabase, [id])
  const rawPeriods = cityPeriodsMap.get(id) ?? []
  const allCountryIds = [...new Set(rawPeriods.map((p) => p.country_id))]
  const countryInfoMap = await loadCountryInfoMap(supabase, allCountryIds)

  // Aktualny kraj (referenceDate = dziś).
  const today = new Date().toISOString().slice(0, 10)
  const current = resolveCityCountry(rawPeriods, today, countryInfoMap, null)

  // Periods z id-kami (do listy w UI).
  const { data: periodRows, error: periodRowsErr } = await supabase
    .from('tbl_City_Country_Periods')
    .select('id, country_id, valid_from, valid_to')
    .eq('city_id', id)
  if (periodRowsErr) throw new Error(`tbl_City_Country_Periods: ${periodRowsErr.message}`)

  const periodsSorted = [...(periodRows ?? [])].sort((a, b) => {
    // Najnowsze u góry: otwarte (valid_to = null) jako pierwsze, potem malejąco po valid_to.
    const aOpen = a.valid_to === null
    const bOpen = b.valid_to === null
    if (aOpen !== bOpen) return aOpen ? -1 : 1
    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : Number.NEGATIVE_INFINITY
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : Number.NEGATIVE_INFINITY
    if (aTo !== bTo) return bTo - aTo
    const aFrom = a.valid_from ? new Date(a.valid_from).getTime() : Number.NEGATIVE_INFINITY
    const bFrom = b.valid_from ? new Date(b.valid_from).getTime() : Number.NEGATIVE_INFINITY
    return bFrom - aFrom
  })

  const periods: PublicCityPeriodEntry[] = periodsSorted.map((p) => {
    const info = countryInfoMap.get(p.country_id) ?? null
    return {
      id: p.id,
      country_id: p.country_id,
      country_name: info?.name ?? null,
      country_fifa_code: info?.fifa_code ?? null,
      valid_from: p.valid_from,
      valid_to: p.valid_to,
    }
  })

  // 3. Osoby urodzone w mieście.
  const { data: peopleRows, error: peopleErr } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, death_date')
    .eq('birth_city_id', id)
  if (peopleErr) throw new Error(`tbl_People (birth_city): ${peopleErr.message}`)

  const peopleIds = (peopleRows ?? []).map((p) => p.id)

  // Role z tbl_Match_Participants (analogicznie do getRolesByPersonId).
  const rolesByPersonId = new Map<string, Set<PublicCityPersonRole>>()
  if (peopleIds.length) {
    const CHUNK = 100
    for (let i = 0; i < peopleIds.length; i += CHUNK) {
      const { data: roleRows, error: roleErr } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, role')
        .in('person_id', peopleIds.slice(i, i + CHUNK))
      if (roleErr) throw new Error(`tbl_Match_Participants (roles): ${roleErr.message}`)
      for (const r of (roleRows ?? []) as Array<{ person_id: string; role: string }>) {
        if (r.role !== 'PLAYER' && r.role !== 'COACH' && r.role !== 'REFEREE') continue
        const set = rolesByPersonId.get(r.person_id) ?? new Set<PublicCityPersonRole>()
        set.add(r.role)
        rolesByPersonId.set(r.person_id, set)
      }
    }
  }

  const ROLE_ORDER: Record<PublicCityPersonRole, number> = { PLAYER: 0, COACH: 1, REFEREE: 2 }

  const people: PublicCityPerson[] = (peopleRows ?? [])
    .map((p) => ({
      id: p.id,
      display_name: buildPersonDisplayName(p),
      birth_date: p.birth_date ?? null,
      death_date: p.death_date ?? null,
      roles: [...(rolesByPersonId.get(p.id) ?? new Set<PublicCityPersonRole>())].sort(
        (a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]
      ),
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'pl'))

  // 4. Kluby z miasta.
  const { data: clubRows, error: clubErr } = await supabase
    .from('tbl_Clubs')
    .select('id, name')
    .eq('club_city_id', id)
    .order('name', { ascending: true })
  if (clubErr) throw new Error(`tbl_Clubs (city): ${clubErr.message}`)

  const clubIds = (clubRows ?? []).map((c) => c.id)
  const foundedByClubId = new Map<string, string>()
  if (clubIds.length) {
    const { data: histRows, error: histErr } = await supabase
      .from('tbl_Club_History')
      .select('club_id, event_date')
      .eq('event_type', 'FOUNDED')
      .in('club_id', clubIds)
      .not('event_date', 'is', null)
    if (histErr) throw new Error(`tbl_Club_History (FOUNDED): ${histErr.message}`)
    for (const r of (histRows ?? []) as Array<{ club_id: string; event_date: string }>) {
      const prev = foundedByClubId.get(r.club_id)
      if (!prev || r.event_date < prev) foundedByClubId.set(r.club_id, r.event_date)
    }
  }

  const clubs: PublicCityClub[] = (clubRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    founded_date: foundedByClubId.get(c.id) ?? null,
  }))

  // 5. Mecze rozegrane w mieście (po match_city_id LUB przez stadion w mieście).
  const { data: cityStadiums, error: stadiumErr } = await supabase
    .from('tbl_Stadiums')
    .select('id, name')
    .eq('stadium_city_id', id)
  if (stadiumErr) throw new Error(`tbl_Stadiums (city): ${stadiumErr.message}`)

  const stadiumIds = (cityStadiums ?? []).map((s) => s.id)
  const stadiumNameById = new Map((cityStadiums ?? []).map((s) => [s.id, s.name]))

  type MatchRow = {
    id: string
    match_date: string | null
    home_team_id: string | null
    away_team_id: string | null
    match_city_id: string | null
    match_stadium_id: string | null
  }
  const matchRowMap = new Map<string, MatchRow>()

  // Zapytanie A: po match_city_id.
  const { data: matchesByCity, error: matchesCityErr } = await supabase
    .from('tbl_Matches')
    .select('id, match_date, home_team_id, away_team_id, match_city_id, match_stadium_id')
    .eq('match_city_id', id)
  if (matchesCityErr) throw new Error(`tbl_Matches (city): ${matchesCityErr.message}`)
  for (const m of (matchesByCity ?? []) as MatchRow[]) matchRowMap.set(m.id, m)

  // Zapytanie B: po match_stadium_id IN stadiums.
  if (stadiumIds.length) {
    const { data: matchesByStadium, error: matchesStadiumErr } = await supabase
      .from('tbl_Matches')
      .select('id, match_date, home_team_id, away_team_id, match_city_id, match_stadium_id')
      .in('match_stadium_id', stadiumIds)
    if (matchesStadiumErr) throw new Error(`tbl_Matches (stadium): ${matchesStadiumErr.message}`)
    for (const m of (matchesByStadium ?? []) as MatchRow[]) matchRowMap.set(m.id, m)
  }

  const matchRows = [...matchRowMap.values()]

  // Druzyny -> nazwa i FIFA code (via tbl_Teams + tbl_Countries / tbl_Clubs).
  const teamIds = [
    ...new Set(matchRows.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((x): x is string => Boolean(x))),
  ]

  type TeamRow = {
    id: string
    country_id: string | null
    club_id: string | null
  }
  const teamInfo = new Map<string, { name: string; fifa_code: string | null }>()
  if (teamIds.length) {
    const { data: teams, error: teamsErr } = await supabase
      .from('tbl_Teams')
      .select('id, country_id, club_id')
      .in('id', teamIds)
    if (teamsErr) throw new Error(`tbl_Teams: ${teamsErr.message}`)

    const teamRows = (teams ?? []) as TeamRow[]
    const teamCountryIds = [...new Set(teamRows.map((t) => t.country_id).filter((x): x is string => Boolean(x)))]
    const teamClubIds = [...new Set(teamRows.map((t) => t.club_id).filter((x): x is string => Boolean(x)))]

    const countryByIdMap = new Map<string, { name: string; fifa_code: string | null }>()
    if (teamCountryIds.length) {
      const { data: cs } = await supabase
        .from('tbl_Countries')
        .select('id, name, fifa_code')
        .in('id', teamCountryIds)
      for (const c of (cs ?? []) as Array<{ id: string; name: string; fifa_code: string | null }>) {
        countryByIdMap.set(c.id, { name: c.name, fifa_code: c.fifa_code })
      }
    }

    const clubByIdMap = new Map<string, string>()
    if (teamClubIds.length) {
      const { data: cls } = await supabase.from('tbl_Clubs').select('id, name').in('id', teamClubIds)
      for (const c of (cls ?? []) as Array<{ id: string; name: string }>) {
        clubByIdMap.set(c.id, c.name)
      }
    }

    for (const t of teamRows) {
      if (t.country_id) {
        const c = countryByIdMap.get(t.country_id)
        teamInfo.set(t.id, { name: c?.name ?? '?', fifa_code: c?.fifa_code ?? null })
      } else if (t.club_id) {
        teamInfo.set(t.id, { name: clubByIdMap.get(t.club_id) ?? '?', fifa_code: null })
      } else {
        teamInfo.set(t.id, { name: '?', fifa_code: null })
      }
    }
  }

  const matches: PublicCityMatchSummary[] = matchRows
    .map((m) => {
      const home = m.home_team_id ? teamInfo.get(m.home_team_id) ?? null : null
      const away = m.away_team_id ? teamInfo.get(m.away_team_id) ?? null : null
      return {
        id: m.id,
        match_date: m.match_date,
        home_team_name: home?.name ?? '?',
        home_team_fifa_code: home?.fifa_code ?? null,
        away_team_name: away?.name ?? '?',
        away_team_fifa_code: away?.fifa_code ?? null,
        stadium_name: m.match_stadium_id ? (stadiumNameById.get(m.match_stadium_id) ?? null) : null,
      }
    })
    .sort((a, b) => {
      // Najnowsze u góry.
      const ad = a.match_date ? new Date(a.match_date).getTime() : 0
      const bd = b.match_date ? new Date(b.match_date).getTime() : 0
      return bd - ad
    })

  return {
    id: city.id,
    city_name: city.city_name ?? '—',
    voivodeship: city.voivodeship ?? null,
    current_country: current,
    periods,
    people,
    clubs,
    matches,
  }
}

export async function getPublicCityProfile(id: string): Promise<PublicCityProfile | null> {
  const cacheKey = await getPublicCacheKey('public-city-profile', id)
  return unstable_cache(async () => getAdminCityProfile(id), cacheKey, {
    revalidate: 3600,
    tags: ['public-cities', `public-city:${id}`],
  })()
}

// === Lista publiczna miast ==============================================

export type PublicCityListItem = {
  id: string
  city_name: string
  current_country_name: string | null
  current_country_fifa_code: string | null
  person_count: number
  club_count: number
  match_count: number
}

async function getAdminPublicCityList(): Promise<PublicCityListItem[]> {
  const supabase = createServiceRoleClient()

  const { data: cities, error: citiesErr } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .order('city_name', { ascending: true })
  if (citiesErr) throw new Error(`tbl_Cities: ${citiesErr.message}`)
  if (!cities?.length) return []

  const cityIds = cities.map((c) => c.id)

  // Liczniki.
  const personCount = new Map<string, number>()
  const clubCount = new Map<string, number>()
  const matchCount = new Map<string, number>()

  const CHUNK = 250
  for (let i = 0; i < cityIds.length; i += CHUNK) {
    const chunk = cityIds.slice(i, i + CHUNK)

    const { data: persons } = await supabase
      .from('tbl_People')
      .select('birth_city_id')
      .in('birth_city_id', chunk)
    for (const r of (persons ?? []) as Array<{ birth_city_id: string }>) {
      personCount.set(r.birth_city_id, (personCount.get(r.birth_city_id) ?? 0) + 1)
    }

    const { data: clubs } = await supabase.from('tbl_Clubs').select('club_city_id').in('club_city_id', chunk)
    for (const r of (clubs ?? []) as Array<{ club_city_id: string }>) {
      clubCount.set(r.club_city_id, (clubCount.get(r.club_city_id) ?? 0) + 1)
    }

    const { data: m1 } = await supabase
      .from('tbl_Matches')
      .select('match_city_id')
      .in('match_city_id', chunk)
    for (const r of (m1 ?? []) as Array<{ match_city_id: string }>) {
      matchCount.set(r.match_city_id, (matchCount.get(r.match_city_id) ?? 0) + 1)
    }
  }

  // Mecze przez stadion (mapuj stadium → city).
  const { data: stadiums } = await supabase
    .from('tbl_Stadiums')
    .select('id, stadium_city_id')
    .not('stadium_city_id', 'is', null)
  const stadiumToCity = new Map<string, string>()
  for (const s of (stadiums ?? []) as Array<{ id: string; stadium_city_id: string }>) {
    stadiumToCity.set(s.id, s.stadium_city_id)
  }
  const stadiumIds = [...stadiumToCity.keys()]
  for (let i = 0; i < stadiumIds.length; i += CHUNK) {
    const chunk = stadiumIds.slice(i, i + CHUNK)
    const { data: m2 } = await supabase
      .from('tbl_Matches')
      .select('match_stadium_id, match_city_id')
      .in('match_stadium_id', chunk)
    for (const r of (m2 ?? []) as Array<{ match_stadium_id: string; match_city_id: string | null }>) {
      // Nie podwajaj jeśli match już ma match_city_id w tym samym mieście.
      if (r.match_city_id) continue
      const cid = stadiumToCity.get(r.match_stadium_id)
      if (cid) matchCount.set(cid, (matchCount.get(cid) ?? 0) + 1)
    }
  }

  // Aktualny kraj per miasto.
  const cityPeriodsMap = await loadCityCountryPeriodsMap(supabase, cityIds)
  const allCountryIds = new Set<string>()
  for (const list of cityPeriodsMap.values()) for (const p of list) allCountryIds.add(p.country_id)
  const countryInfoMap = await loadCountryInfoMap(supabase, [...allCountryIds])
  const today = new Date().toISOString().slice(0, 10)

  return cities
    .map((c) => {
      const periods = cityPeriodsMap.get(c.id) ?? []
      const resolved = resolveCityCountry(periods, today, countryInfoMap, null)
      return {
        id: c.id,
        city_name: c.city_name ?? '—',
        current_country_name: resolved.current_country_name,
        current_country_fifa_code: resolved.current_country_fifa_code,
        person_count: personCount.get(c.id) ?? 0,
        club_count: clubCount.get(c.id) ?? 0,
        match_count: matchCount.get(c.id) ?? 0,
      }
    })
    .filter((c) => c.person_count > 0 || c.club_count > 0 || c.match_count > 0)
}

export async function getPublicCityList(): Promise<PublicCityListItem[]> {
  const cacheKey = await getPublicCacheKey('public-cities-list')
  return unstable_cache(async () => getAdminPublicCityList(), cacheKey, {
    revalidate: 3600,
    tags: ['public-cities'],
  })()
}
