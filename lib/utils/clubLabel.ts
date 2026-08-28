export function formatClubWithLocation(
  clubName: string | null | undefined,
  cityName: string | null | undefined,
  fifaCode: string | null | undefined,
): string {
  const name = (clubName ?? '').trim() || '—'
  const city = (cityName ?? '').trim()
  const code = (fifaCode ?? '').trim().toUpperCase()
  const location = [city, code].filter(Boolean).join(', ')

  return location ? `${name} (${location})` : name
}