import { notFound } from 'next/navigation'
import CountryFlag from '@/components/CountryFlag'
import { getPublicCountries } from '@/lib/db/countries'
import type { DetailPageParams } from '@/lib/types/admin'

export const revalidate = 3600

type Params = DetailPageParams

function StatBadge({ value }: { value: number }) {
  return value > 0 ? (
    <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">
      {value}
    </span>
  ) : (
    <span className="text-sm text-neutral-600">–</span>
  )
}

export default async function PublicCountryDetailsPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  const countries = await getPublicCountries()
  const country = countries.find((item) => item.id === id)

  if (!country) {
    notFound()
  }

  return (
    <div className="public-theme">
      <main className="min-h-screen px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-[74rem]">
          <section className="relative overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] sm:p-6">
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
            <div className="relative z-10">
              <div className="mb-4 flex items-center gap-3">
                <CountryFlag fifaCode={country.fifa_code} countryName={country.name} className="h-5 w-[30px]" />
                <h1 className="text-2xl font-bold text-emerald-50">{country.name}</h1>
              </div>

              <div className="overflow-hidden rounded-xl border border-neutral-800">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
                      <th className="px-3 py-2 text-center font-medium text-neutral-400">M</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-400">Z</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-400">R</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-400">P</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-400">G+</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-400">G-</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-neutral-950">
                      <td className="px-3 py-3 text-center"><StatBadge value={country.matches} /></td>
                      <td className="px-3 py-3 text-center"><StatBadge value={country.wins} /></td>
                      <td className="px-3 py-3 text-center"><StatBadge value={country.draws} /></td>
                      <td className="px-3 py-3 text-center"><StatBadge value={country.losses} /></td>
                      <td className="px-3 py-3 text-center"><StatBadge value={country.goals_for} /></td>
                      <td className="px-3 py-3 text-center"><StatBadge value={country.goals_against} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
