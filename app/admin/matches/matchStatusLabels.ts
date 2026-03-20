import type { MatchStatus } from '@/lib/db/matches'

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: 'Zaplanowany',
  FINISHED: 'Zakończony',
  ABANDONED: 'Przerwany',
  CANCELLED: 'Odwołany',
}

export const MATCH_STATUS_OPTIONS = (Object.keys(MATCH_STATUS_LABELS) as MatchStatus[]).map(
  (value) => ({ value, label: MATCH_STATUS_LABELS[value] })
)

export function getMatchStatusLabel(status: MatchStatus): string {
  return MATCH_STATUS_LABELS[status]
}
