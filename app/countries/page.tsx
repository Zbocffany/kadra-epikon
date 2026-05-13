import type { PublicCountry } from '@/lib/db/countries'
import { getPublicCountries } from '@/lib/db/countries'
import CountriesSearchTable from './CountriesSearchTable'

export const dynamic = 'force-dynamic'

export default async function PublicCountriesPage() {
  let countries: PublicCountry[] = []
  let fetchError: string | null = null

  try {
    countries = await getPublicCountries()
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const poland = countries.find((country) => country.name.toLowerCase() === 'polska') ?? null
  const countriesWithoutPoland = countries.filter((country) => country.id !== poland?.id)

  const polandSummary: PublicCountry | null = poland
    ? {
        ...poland,
        matches: countriesWithoutPoland.reduce((sum, country) => sum + country.matches, 0),
        wins: countriesWithoutPoland.reduce((sum, country) => sum + country.wins, 0),
        draws: countriesWithoutPoland.reduce((sum, country) => sum + country.draws, 0),
        losses: countriesWithoutPoland.reduce((sum, country) => sum + country.losses, 0),
        goals_for: countriesWithoutPoland.reduce((sum, country) => sum + country.goals_for, 0),
        goals_against: countriesWithoutPoland.reduce((sum, country) => sum + country.goals_against, 0),
      }
    : null

  return (
    <div className="public-theme">
      <main className="min-h-screen px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-[74rem]">
          <section className="relative overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] sm:p-6">
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
            <div className="relative z-10">
              {fetchError ? (
                <div className="rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
                  <strong className="font-semibold">Błąd pobierania danych:</strong> {fetchError}
                </div>
              ) : (
                <CountriesSearchTable countries={countriesWithoutPoland} poland={polandSummary} />
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
