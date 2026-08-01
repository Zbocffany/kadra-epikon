/**
 * Etykieta miasta z sufiksem kodu FIFA aktualnego kraju.
 *
 * Używane w dropdownach admina (formularze klubów, stadionów, osób, meczów),
 * gdzie po samej nazwie miasta trudno rozróżnić Kraków (POL) od np. Kraków w
 * innym kraju albo miejscowości o tej samej nazwie w różnych państwach.
 *
 * Format: `"Kraków (POL)"`. Gdy fifa_code jest brakujący (nowy kraj bez kodu,
 * miasto bez przypisania) — zwracamy samą nazwę. Nazwa jest przycinana.
 */
export function formatCityWithFifa(
  cityName: string | null | undefined,
  fifaCode: string | null | undefined,
): string {
  const name = (cityName ?? '').trim()
  if (!name) return '—'

  const code = (fifaCode ?? '').trim().toUpperCase()
  if (!code) return name

  return `${name} (${code})`
}
