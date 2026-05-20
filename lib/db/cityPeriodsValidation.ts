/**
 * Walidacja chronologii okresów przynależności miasta do krajów
 * (tbl_City_Country_Periods). Wykrywa:
 *   - nakładające się okresy (miasto przypisane do dwóch krajów jednocześnie),
 *   - luki między okresami,
 *   - duplikaty kraju w sąsiednich okresach (kosmetyczne, jako warning),
 *   - brak otwartego okresu (brak `valid_to = NULL`) — czyli brak "aktualnego" kraju.
 *
 * Funkcja jest czysta — przyjmuje minimum potrzebnych pól i zwraca listę
 * znalezisk. Używana w admin UI ([id]/page.tsx) do wyświetlenia panelu ostrzeżeń.
 */

export type CityPeriodForValidation = {
  id: string
  country_id: string
  country_name: string | null
  valid_from: string | null
  valid_to: string | null
}

export type CityPeriodIssue = {
  level: 'error' | 'warning'
  message: string
}

const POS_INF = Number.POSITIVE_INFINITY
const NEG_INF = Number.NEGATIVE_INFINITY

function toTime(date: string | null, fallback: number): number {
  if (!date) return fallback
  const t = new Date(date).getTime()
  return Number.isFinite(t) ? t : fallback
}

function fmt(date: string | null, fallback: string): string {
  if (!date) return fallback
  return date.slice(0, 10)
}

export function validateCityCountryPeriods(
  periods: CityPeriodForValidation[]
): CityPeriodIssue[] {
  const issues: CityPeriodIssue[] = []
  if (!periods.length) return issues

  // Posortuj po valid_from rosnąco (NULL = -∞).
  const sorted = [...periods].sort((a, b) => {
    const af = toTime(a.valid_from, NEG_INF)
    const bf = toTime(b.valid_from, NEG_INF)
    if (af !== bf) return af - bf
    const at = toTime(a.valid_to, POS_INF)
    const bt = toTime(b.valid_to, POS_INF)
    return at - bt
  })

  // 1. valid_from > valid_to wewnątrz jednego okresu.
  for (const p of sorted) {
    const f = toTime(p.valid_from, NEG_INF)
    const t = toTime(p.valid_to, POS_INF)
    if (f > t) {
      issues.push({
        level: 'error',
        message: `Okres dla "${p.country_name ?? '?'}" ma datę "Od" (${fmt(
          p.valid_from,
          '?'
        )}) późniejszą niż "Do" (${fmt(p.valid_to, '?')}).`,
      })
    }
  }

  // 2. Wiele okresów z valid_to = NULL (więcej niż jeden "aktualny").
  const openPeriods = sorted.filter((p) => p.valid_to === null)
  if (openPeriods.length > 1) {
    const names = openPeriods.map((p) => p.country_name ?? '?').join(', ')
    issues.push({
      level: 'error',
      message: `Więcej niż jeden okres bez daty "Do" (otwarty, czyli aktualny): ${names}. Miasto może mieć tylko jeden aktualny kraj.`,
    })
  }

  // 3. Brak okresu otwartego = brak aktualnego kraju.
  if (openPeriods.length === 0) {
    issues.push({
      level: 'warning',
      message:
        'Brak okresu otwartego (z pustym "Do"). UI nie będzie potrafiło pokazać aktualnego kraju w nawiasie obok historycznego.',
    })
  }

  // 4. Nakładki i luki między kolejnymi okresami.
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const aTo = toTime(a.valid_to, POS_INF)
    const bFrom = toTime(b.valid_from, NEG_INF)

    if (bFrom < aTo) {
      issues.push({
        level: 'error',
        message: `Nakładające się okresy: "${a.country_name ?? '?'}" (do ${fmt(
          a.valid_to,
          '∞'
        )}) i "${b.country_name ?? '?'}" (od ${fmt(
          b.valid_from,
          '-∞'
        )}). Miasto nie może należeć jednocześnie do dwóch krajów.`,
      })
    } else if (bFrom > aTo + 24 * 60 * 60 * 1000) {
      // Luka większa niż 1 dzień. Dopuszczamy dokładny styk (do = od)
      // oraz styk "następny dzień".
      issues.push({
        level: 'warning',
        message: `Luka między okresami: "${a.country_name ?? '?'}" kończy się ${fmt(
          a.valid_to,
          '?'
        )}, a "${b.country_name ?? '?'}" zaczyna się ${fmt(
          b.valid_from,
          '?'
        )}. Osoby urodzone w tym przedziale nie b\u0119d\u0105 mia\u0142y historycznego kraju.`,
      })
    }

    // 5. Ten sam kraj w sąsiednich okresach (warning kosmetyczny).
    if (a.country_id === b.country_id && bFrom <= aTo + 24 * 60 * 60 * 1000) {
      issues.push({
        level: 'warning',
        message: `Dwa s\u0105siednie okresy odnosz\u0105 si\u0119 do tego samego kraju "${a.country_name ?? '?'}" \u2014 mo\u017cna je po\u0142\u0105czy\u0107 w jeden.`,
      })
    }
  }

  return issues
}
