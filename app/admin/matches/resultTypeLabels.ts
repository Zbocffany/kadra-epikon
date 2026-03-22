import type { ResultType } from '@/lib/db/matches'

export const RESULT_TYPE_LABELS: Record<ResultType, string> = {
  REGULAR_TIME: 'Regulaminowy czas gry',
  EXTRA_TIME: 'Dogrywka',
  PENALTIES: 'Rzuty karne',
  EXTRA_TIME_AND_PENALTIES: 'Dogrywka i rzuty karne',
  GOLDEN_GOAL: 'Złoty gol',
  WALKOVER: 'Walkower',
}

export const RESULT_TYPE_OPTIONS = (Object.keys(RESULT_TYPE_LABELS) as ResultType[]).map(
  (value) => ({ value, label: RESULT_TYPE_LABELS[value] })
)

export function getResultTypeLabel(resultType: ResultType | null): string {
  if (!resultType) {
    return '—'
  }

  return RESULT_TYPE_LABELS[resultType]
}