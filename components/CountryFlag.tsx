import { getFlagAssetPath } from '@/lib/flags/fifaFlagMap'

type CountryFlagProps = {
  fifaCode: string | null | undefined
  countryName: string
  className?: string
}

const tooltipClassName =
  'pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/flag:opacity-100 group-focus-within/flag:opacity-100'

export default function CountryFlag({ fifaCode, countryName, className }: CountryFlagProps) {
  const src = getFlagAssetPath(fifaCode)

  if (!src) {
    return (
      <span className="group/flag relative inline-flex items-center">
        <span
          className={`inline-flex h-4 w-6 items-center justify-center rounded-sm border border-neutral-700 bg-neutral-900 text-[10px] font-semibold uppercase text-neutral-500 ${className ?? ''}`.trim()}
          aria-label={`Brak flagi dla ${countryName}`}
        >
          —
        </span>
        <span role="tooltip" className={tooltipClassName}>
          {countryName}
        </span>
      </span>
    )
  }

  return (
    <span className="group/flag relative inline-flex items-center">
      <img
        src={src}
        alt={`Flaga ${countryName}`}
        className={`h-4 w-6 rounded-[2px] border border-neutral-700 object-cover ${className ?? ''}`.trim()}
        loading="lazy"
      />
      <span role="tooltip" className={tooltipClassName}>
        {countryName}
      </span>
    </span>
  )
}