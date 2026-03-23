import type { AdminMatchEvent, ResultType } from '@/lib/db/matches'

export interface MatchScore {
  homeGoals: number
  awayGoals: number
  homeShootoutScore: number
  awayShootoutScore: number
}

/**
 * Oblicza wynik meczu na podstawie zdarzeń.
 * - homeGoals/awayGoals: bramki w regulaminowym czasie + dogrywce
 * - homeShootoutScore/awayShootoutScore: wynik rzutów karnych
 */
export function calculateMatchScore(
  events: AdminMatchEvent[],
  homeTeamId: string,
  awayTeamId: string
): MatchScore {
  let homeGoals = 0
  let awayGoals = 0
  let homeShootoutScore = 0
  let awayShootoutScore = 0

  const GOAL_TYPES = new Set(['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'])
  const SHOOTOUT_SCORED_TYPES = new Set(['PENALTY_SHOOTOUT_SCORED'])

  for (const event of events) {
    // Bramki w regulaminowym/dogrywce
    if (GOAL_TYPES.has(event.event_type)) {
      // OWN_GOAL liczy się dla drużyny PRZECIWNEJ
      if (event.event_type === 'OWN_GOAL') {
        if (event.team_id === homeTeamId) {
          awayGoals += 1
        } else if (event.team_id === awayTeamId) {
          homeGoals += 1
        }
      } else {
        // GOAL i PENALTY_GOAL liczą się dla zespołu event.team_id
        if (event.team_id === homeTeamId) {
          homeGoals += 1
        } else if (event.team_id === awayTeamId) {
          awayGoals += 1
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

  return { homeGoals, awayGoals, homeShootoutScore, awayShootoutScore }
}

/**
 * Formatuje wynik meczu w formacie:
 * - Regulaminowy: "A:B (a:b)"
 * - Po dogrywce: "A:B (a:b) po dogr."
 * - Po karnych: "A:B (a:b) po karnych (A:B)"
 * 
 * Gdzie:
 * - A:B = wynik bramek w meczu
 * - (a:b) = wynik karnych pomeczowych
 * - (A:B) w końcówce = wynik karnych pomeczowych (duplikacja dla karnych)
 */
export function formatMatchScore(
  score: MatchScore,
  resultType: ResultType | null
): string {
  const { homeGoals, awayGoals, homeShootoutScore, awayShootoutScore } = score

  // Podstawowy wynik bramek
  let result = `${homeGoals}:${awayGoals} (${homeShootoutScore}:${awayShootoutScore})`

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
  const score = calculateMatchScore(events, homeTeamId, awayTeamId)

  // Jeśli nie ma żadnych bramek - nie wyświetlaj
  if (score.homeGoals === 0 && score.awayGoals === 0 && score.homeShootoutScore === 0 && score.awayShootoutScore === 0) {
    return null
  }

  return formatMatchScore(score, resultType)
}
