import { describe, expect, it } from 'vitest'
import type { AdminMatchEvent } from '@/lib/db/matches'
import { calculateMatchScore, formatMatchScore } from './scoreCalculation'

const HOME_ID = 'home'
const AWAY_ID = 'away'

function event(
  eventType: AdminMatchEvent['event_type'],
  teamId: string,
  minute = 1,
): AdminMatchEvent {
  return {
    id: crypto.randomUUID(),
    minute,
    minute_extra: null,
    event_order: 1,
    event_type: eventType,
    team_id: teamId,
    primary_person_id: null,
    secondary_person_id: null,
    notes: null,
  }
}

describe('calculateMatchScore', () => {
  it('credits an own goal to event.team_id', () => {
    const score = calculateMatchScore([
      event('OWN_GOAL', HOME_ID, 20),
    ], HOME_ID, AWAY_ID)

    expect(score.homeGoals).toBe(1)
    expect(score.awayGoals).toBe(0)
  })

  it('counts regular and penalty goals, including extra time', () => {
    const score = calculateMatchScore([
      event('GOAL', HOME_ID, 12),
      event('PENALTY_GOAL', AWAY_ID, 70),
      event('GOAL', HOME_ID, 110),
    ], HOME_ID, AWAY_ID)

    expect(score).toMatchObject({
      homeGoals: 2,
      awayGoals: 1,
      homeGoalsHT: 1,
      awayGoalsHT: 0,
    })
  })

  it('keeps shootout goals outside the match score and goal balance', () => {
    const score = calculateMatchScore([
      event('GOAL', HOME_ID, 10),
      event('GOAL', AWAY_ID, 80),
      ...Array.from({ length: 5 }, () => event('PENALTY_SHOOTOUT_SCORED', HOME_ID, 121)),
      ...Array.from({ length: 4 }, () => event('PENALTY_SHOOTOUT_SCORED', AWAY_ID, 121)),
    ], HOME_ID, AWAY_ID)

    expect(score).toMatchObject({
      homeGoals: 1,
      awayGoals: 1,
      homeShootoutScore: 5,
      awayShootoutScore: 4,
    })
    expect(formatMatchScore(score, 'PENALTIES')).toBe('1:1 (1:0) po karnych (5:4)')
  })
})