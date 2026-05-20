import CountryFlag from '@/components/CountryFlag'

type Props = {
  historicalFifaCode: string | null | undefined
  historicalCountryName: string | null | undefined
  currentFifaCode: string | null | undefined
  currentCountryName: string | null | undefined
  /** Tailwind classes applied to the primary (historical) flag image. */
  className?: string
  /** Tailwind classes applied to the smaller "current" flag image. Default = h-3 w-[18px]. */
  currentFlagClassName?: string
  /** When true and both flags identical (same FIFA code), render only the primary flag. */
  collapseWhenSame?: boolean
  /** Show FIFA code label next to the primary flag. */
  showHistoricalCode?: boolean
  /** Show FIFA code label next to the current flag (only when different). */
  showCurrentCode?: boolean
  glossy?: boolean
}

/**
 * Renderuje flagę KRAJU HISTORYCZNEGO (np. POL) z opcjonalnym suffixem
 * "(flaga_obecna kod)" gdy obecny kraj różni się od historycznego.
 *
 * Konwencja: jeśli ktoś urodził się we Lwowie w 1930 → POL (UKR).
 * Jeśli w 2015 → tylko UKR (collapseWhenSame=true domyślnie).
 */
export default function CountryFlagWithHistory({
  historicalFifaCode,
  historicalCountryName,
  currentFifaCode,
  currentCountryName,
  className,
  currentFlagClassName,
  collapseWhenSame = true,
  showHistoricalCode = false,
  showCurrentCode = false,
  glossy = true,
}: Props) {
  const histName = historicalCountryName ?? historicalFifaCode ?? ''
  const currName = currentCountryName ?? currentFifaCode ?? ''
  const histCode = (historicalFifaCode ?? '').toUpperCase()
  const currCode = (currentFifaCode ?? '').toUpperCase()

  const hasHistorical = Boolean(historicalFifaCode || historicalCountryName)
  const hasCurrent = Boolean(currentFifaCode || currentCountryName)

  if (!hasHistorical && !hasCurrent) return null

  // Brak danych historycznych → pokaż tylko obecny.
  if (!hasHistorical) {
    return (
      <span className="inline-flex items-center gap-1">
        <CountryFlag fifaCode={currentFifaCode} countryName={currName} className={className} glossy={glossy} />
        {showCurrentCode && currCode ? <span className="text-xs font-semibold text-neutral-200">{currCode}</span> : null}
      </span>
    )
  }

  const isSame =
    collapseWhenSame &&
    hasCurrent &&
    histCode &&
    currCode &&
    histCode === currCode

  if (isSame || !hasCurrent) {
    return (
      <span className="inline-flex items-center gap-1">
        <CountryFlag fifaCode={historicalFifaCode} countryName={histName} className={className} glossy={glossy} />
        {showHistoricalCode && histCode ? <span className="text-xs font-semibold text-neutral-200">{histCode}</span> : null}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      title={`W chwili wydarzenia: ${histName}. Dziś: ${currName}.`}
    >
      <CountryFlag fifaCode={historicalFifaCode} countryName={histName} className={className} glossy={glossy} />
      {showHistoricalCode && histCode ? <span className="text-xs font-semibold text-neutral-200">{histCode}</span> : null}
      <span className="text-xs text-neutral-400">(</span>
      <CountryFlag
        fifaCode={currentFifaCode}
        countryName={currName}
        className={currentFlagClassName ?? 'h-3 w-[18px]'}
        glossy={glossy}
      />
      {showCurrentCode && currCode ? <span className="text-xs font-semibold text-neutral-300">{currCode}</span> : null}
      <span className="text-xs text-neutral-400">)</span>
    </span>
  )
}
