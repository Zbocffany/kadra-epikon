import { getFlagAssetPath } from '@/lib/flags/fifaFlagMap'

type CountryFlagProps = {
  fifaCode: string | null | undefined
  countryName: string
  className?: string
  glossy?: boolean
}

const tooltipClassName =
  'pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/flag:opacity-100 group-focus-within/flag:opacity-100'

export default function CountryFlag({ fifaCode, countryName, className, glossy = true }: CountryFlagProps) {
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
        {glossy ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[2px] bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.24)_26%,rgba(255,255,255,0)_58%),linear-gradient(130deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_48%)]"
          />
        ) : null}
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
        className={`h-4 w-6 rounded-[2px] border border-neutral-700 object-cover ${glossy ? 'saturate-[1.15] brightness-[1.08] contrast-[1.06]' : ''} ${className ?? ''}`.trim()}
        loading="lazy"
      />
      {glossy ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[2px] bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.28)_24%,rgba(255,255,255,0)_56%),linear-gradient(125deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.06)_36%,rgba(255,255,255,0)_52%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),inset_0_-1px_1px_rgba(0,0,0,0.55)]"
        />
      ) : null}
      <span role="tooltip" className={tooltipClassName}>
        {countryName}
      </span>
    </span>
  )
}