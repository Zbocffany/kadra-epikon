'use client'

import { ReactNode } from 'react'

type FilterRibbonProps = {
  title?: string
  expanded: boolean
  onToggle: () => void
  activeCount?: number
  onReset?: () => void
  children: ReactNode
}

/**
 * Wstążka filtrów w stylu Excel/Word — rozwijana, podzielona na sekcje.
 * Sekcje przekazuje się jako children — każdą owiniętą w <RibbonSection />.
 * Kolorystyka utrzymana w zielonej palecie panelu publicznego.
 */
export function FilterRibbon({
  title = 'Filtry',
  expanded,
  onToggle,
  activeCount = 0,
  onReset,
  children,
}: FilterRibbonProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-2px_10px_rgba(0,0,0,0.18),0_4px_10px_rgba(0,0,0,0.18)]">
      {/* Pasek tytułu wstążki */}
      <div className="flex items-center justify-between gap-2 border-b border-emerald-800/70 bg-emerald-950/35 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? 'Zwiń wstążkę filtrów' : 'Rozwiń wstążkę filtrów'}
            className="inline-flex h-5 w-5 items-center justify-center rounded border border-emerald-500/55 bg-emerald-900/40 text-emerald-100 transition-colors hover:border-emerald-300/80 hover:text-emerald-50"
          >
            <svg
              viewBox="0 0 12 12"
              className={`h-2.5 w-2.5 transition-transform ${expanded ? 'rotate-180' : 'rotate-0'}`}
              aria-hidden="true"
            >
              <path d="M2 4.5l4 3 4-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="font-barlow text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
            {title}
          </span>
          {activeCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-500 px-1.5 text-[10px] font-bold text-emerald-950">
              {activeCount}
            </span>
          ) : null}
        </div>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            disabled={activeCount === 0}
            aria-label="Wyczyść filtry"
            title="Wyczyść filtry"
            className="stat-badge inline-flex h-5 items-center rounded border border-emerald-500/60 bg-[linear-gradient(180deg,rgba(89,190,131,0.9)_0%,rgba(48,150,97,0.86)_44%,rgba(23,91,60,0.92)_100%)] px-1.5 font-barlow text-[0.5rem] font-semibold text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.28)] transition-colors hover:border-emerald-300/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M2.5 3h11l-4.2 4.7v3.4l-2.6 1.4V7.7L2.5 3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 13L13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Treść wstążki - sekcje obok siebie */}
      {expanded ? (
        <div className="flex flex-wrap items-stretch gap-2 p-2">
          {children}
        </div>
      ) : null}
    </div>
  )
}

type RibbonSectionProps = {
  title: string
  children: ReactNode
  className?: string
}

/**
 * Pojedyncza sekcja wstążki (jak grupa narzędzi w Wordzie/Excelu).
 */
export function RibbonSection({ title, children, className = '' }: RibbonSectionProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 rounded-md border border-emerald-800/70 bg-emerald-950/25 px-2.5 py-2 ${className}`}>
      <div className="flex-1">
        {children}
      </div>
      <div className="text-center font-barlow text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-100/70">
        {title}
      </div>
    </div>
  )
}
