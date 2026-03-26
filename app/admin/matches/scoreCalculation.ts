import type { AdminMatchEvent, ResultType } from '@/lib/db/matches'

export interface MatchScore {
  homeGoals: number
  awayGoals: number
  homeGoalsHT: number
  awayGoalsHT: number
  homeShootoutScore: number
  awayShootoutScore: number
}

/**
 * Oblicza wynik meczu na podstawie zdarzeń.
 * - homeGoals/awayGoals: bramki w regulaminowym czasie + dogrywce
 * - homeGoalsHT/awayGoalsHT: bramki do przerwy (minute < 45)
 * - homeShootoutScore/awayShootoutScore: wynik rzutów karnych
 */
export function calculateMatchScore(
  events: AdminMatchEvent[],
  homeTeamId: string,
  awayTeamId: string
): MatchScore {
  let homeGoals = 0
  let awayGoals = 0
  let homeGoalsHT = 0
  let awayGoalsHT = 0
  let homeShootoutScore = 0
  let awayShootoutScore = 0

  const GOAL_TYPES = new Set(['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'])
  const SHOOTOUT_SCORED_TYPES = new Set(['PENALTY_SHOOTOUT_SCORED'])

  for (const event of events) {
    // Bramki w regulaminowym/dogrywce
    if (GOAL_TYPES.has(event.event_type)) {
      if (event.team_id === homeTeamId) {
        homeGoals += 1
        if (event.minute < 45) {
          homeGoalsHT += 1
        }
      } else if (event.team_id === awayTeamId) {
        awayGoals += 1
        if (event.minute < 45) {
          awayGoalsHT += 1
        }
      }
    }

    // Karne pomeczowe
    if (SHOOTOUT_SCORED_TYPES.has(event.event_type)) {
      if (event.team_id === homeTeamId) {
        homeShootoutScore += 1
      } else if (event.team_id === awayTeamId) {
        awayShootoutScore += 1
      }
    }
  }

  return { homeGoals, awayGoals, homeGoalsHT, awayGoalsHT, homeShootoutScore, awayShootoutScore }
}

/**
 * Formatuje wynik meczu w formacie:
 * - Regulaminowy: "A:B (a:b)" gdzie a:b to wynik do przerwy
 * - Po dogrywce: "A:B (a:b) po dogr." gdzie a:b to wynik do przerwy
 * - Po karnych: "A:B (a:b) po karnych (X:Y)" gdzie a:b to wynik do przerwy, X:Y to wynik karnych
 */
export function formatMatchScore(
  score: MatchScore,
  resultType: ResultType | null
): string {
  const { homeGoals, awayGoals, homeGoalsHT, awayGoalsHT, homeShootoutScore, awayShootoutScore } = score

  // Podstawowy wynik meczu
  let result = `${homeGoals}:${awayGoals}`

  // Wynik do przerwy w nawiasach (zawsze)
  result += ` (${homeGoalsHT}:${awayGoalsHT})`

  // Sufiks dla wyniku
  if (resultType === 'EXTRA_TIME') {
    result += ' po dogr.'
  } else if (resultType === 'PENALTIES' || resultType === 'EXTRA_TIME_AND_PENALTIES') {
    result += ` po karnych (${homeShootoutScore}:${awayShootoutScore})`
  }

  return result
}

/**
 * Formatuje wynik do wyświetlenia na stronie.
 * Zwraca null jeśli wynik nie może być wyznaczony.
 */
export function getDisplayScore(
  events: AdminMatchEvent[],
  resultType: ResultType | null,
  homeTeamId: string,
  awayTeamId: string
): string | null {
  if (events.length === 0) {
    return null
  }

  const score = calculateMatchScore(events, homeTeamId, awayTeamId)
  return formatMatchScore(score, resultType)
}
