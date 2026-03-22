import type { PlayerPosition } from '@/lib/db/matches'

export const POSITION_SORT_ORDER: Record<PlayerPosition, number> = {
  GOALKEEPER: 0,
  DEFENDER: 1,
  MIDFIELDER: 2,
  ATTACKER: 3,
}

export function getPositionSortOrder(position: PlayerPosition | '' | null | undefined): number {
  if (!position) return 99
  return POSITION_SORT_ORDER[position] ?? 99
}

export function compareByPlayerPosition<T>(
  a: T,
  b: T,
  getPosition: (row: T) => PlayerPosition | '' | null | undefined
): number {
  return getPositionSortOrder(getPosition(a)) - getPositionSortOrder(getPosition(b))
}
