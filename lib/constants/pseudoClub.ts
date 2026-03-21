/**
 * Pseudo-club constants for handling missing or unknown player club data
 *
 * Schema Design:
 * - NULL = Player has NO CLUB (e.g., retired, between clubs, unattached)
 * - UNKNOWN_CLUB_TEAM_ID = Player club data is UNKNOWN/MISSING (can't determine)
 *
 * Both NULL and UNKNOWN team IDs are valid in tbl_Match_Participants.club_team_id
 */

// UUIDs of the pseudo "Unknown Club" record (must match migration 025 & seed 007)
export const UNKNOWN_CLUB_ID = '00000000-0000-0000-0000-000000000001'
export const UNKNOWN_CLUB_TEAM_ID = '00000000-0000-0000-0000-000000000002'
export const UNKNOWN_CLUB_NAME = 'Brak danych'

/**
 * Check if a team_id belongs to the pseudo "Unknown Club"
 */
export function isUnknownClubTeam(teamId: string | null | undefined): boolean {
  return teamId === UNKNOWN_CLUB_TEAM_ID
}

/**
 * Helper to format player's club status for display
 */
export function formatPlayerClubStatus(
  clubTeamId: string | null | undefined,
  clubName?: string | null
): string {
  if (!clubTeamId) return 'Brak klubu'
  if (isUnknownClubTeam(clubTeamId)) return UNKNOWN_CLUB_NAME
  return clubName || '—'
}
