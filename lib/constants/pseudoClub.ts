/**
 * Pseudo-club constants for handling missing or unknown player club data
 *
 * Schema Design:
 * - NULL = Player club data is UNKNOWN/MISSING (can't determine)
 * - Team linked to UNKNOWN_CLUB_ID = Player has NO CLUB (e.g., retired, between clubs, unattached)
 *
 * Both NULL and UNKNOWN team IDs are valid in tbl_Match_Participants.club_team_id
 */

// UUID of pseudo club record (must match seed 007)
export const UNKNOWN_CLUB_ID = '00000000-0000-0000-0000-000000000001'
export const UNKNOWN_CLUB_NAME = 'Brak klubu'

/**
 * Check if a club name is the pseudo "Brak klubu" value
 */
export function isUnknownClubName(clubName: string | null | undefined): boolean {
  return (clubName ?? '').trim().toLowerCase() === UNKNOWN_CLUB_NAME.toLowerCase()
}

/**
 * Helper to format player's club status for display
 */
export function formatPlayerClubStatus(
  clubTeamId: string | null | undefined,
  clubName?: string | null
): string {
  if (!clubTeamId) return 'Brak danych'
  if (isUnknownClubName(clubName)) return UNKNOWN_CLUB_NAME
  return clubName || '—'
}
