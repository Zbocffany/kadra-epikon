import CountryFlag from '@/components/CountryFlag'
import type { CityCountryTimelineEntry } from '@/lib/db/cityCountryResolver'

type Props = {
  cityName: string | null | undefined
  timeline: CityCountryTimelineEntry[] | null | undefined
  /** Tailwind classes na każdą flagę. */
  flagClassName?: string
  /** Klasy na kontener (po nazwie miasta + flagi). */
  className?: string
  glossy?: boolean
  /** Fallback gdy timeline pusty — pojedyncza flaga "obecnego" kraju (np. dla miast bez okresów). */
  fallbackCurrentFifaCode?: string | null
  fallbackCurrentCountryName?: string | null
}

function formatYear(date: string | null): string | null {
  if (!date) return null
  const m = date.match(/^(\d{4})/)
  return m ? m[1] : null
}

/**
 * Buduje etykietę kraju zgodnie z pozycją na osi czasu:
 * - kraj skrajny od lewej (najstarszy znany) → tylko `do YYYY`
 * - kraj skrajny od prawej (otwarty koniec) → tylko `od YYYY`
 * - kraj środkowy → `Nazwa YYYY–YYYY`
 *
 * Wyświetlana w natywnym tooltipie komponentu CountryFlag (czarna ramka).
 */
function buildFlagTooltip(entry: CityCountryTimelineEntry, isFirst: boolean, isLast: boolean): string {
  const name = entry.country_name ?? entry.country_fifa_code ?? '—'
  const from = formatYear(entry.valid_from)
  const to = formatYear(entry.valid_to)

  if (isFirst && to) return `${name} do ${to}`
  if (isLast && from) return `${name} od ${from}`
  if (from && to) return `${name} ${from}–${to}`
  if (from) return `${name} od ${from}`
  if (to) return `${name} do ${to}`
  return name
}

/**
 * Renderuje nazwę miasta + chronologiczny pasek flag krajów, do których miasto należało.
 * Konwencja: "Miasto  🏳️ - 🏳️ - 🏳️" (od najstarszego do najnowszego).
 *
 * Dla osoby: timeline jest wyfiltrowany od daty urodzenia.
 * Dla klubu: od daty założenia (jeśli znana), w przeciwnym razie pełna historia miasta.
 *
 * Daty pojawiają się w istniejącym tooltipie CountryFlag — bez dodatkowych ramek.
 */
export default function CityCountryTimeline({
  cityName,
  timeline,
  flagClassName,
  className,
  glossy = true,
  fallbackCurrentFifaCode,
  fallbackCurrentCountryName,
}: Props) {
  const entries = timeline ?? []
  const hasEntries = entries.length > 0
  const hasFallback = Boolean(fallbackCurrentFifaCode || fallbackCurrentCountryName)

  if (!cityName && !hasEntries && !hasFallback) return null

  return (
    <span className={className ?? 'inline-flex items-center gap-1.5'}>
      {cityName ? <span>{cityName}</span> : null}
      {hasEntries ? (
        <span className="inline-flex items-center gap-1">
          {entries.map((entry, idx) => {
            const isFirst = idx === 0
            const isLast = idx === entries.length - 1
            const tooltip = buildFlagTooltip(entry, isFirst, isLast)
            return (
              <span key={`${entry.country_id}-${idx}`} className="inline-flex items-center gap-1">
                {idx > 0 ? <span className="text-xs text-neutral-400">-</span> : null}
                <CountryFlag
                  fifaCode={entry.country_fifa_code}
                  countryName={tooltip}
                  className={flagClassName}
                  glossy={glossy}
                />
              </span>
            )
          })}
        </span>
      ) : hasFallback ? (
        <CountryFlag
          fifaCode={fallbackCurrentFifaCode ?? null}
          countryName={fallbackCurrentCountryName ?? fallbackCurrentFifaCode ?? ''}
          className={flagClassName}
          glossy={glossy}
        />
      ) : null}
    </span>
  )
}
