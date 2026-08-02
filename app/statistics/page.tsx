import WorldStatisticsMap from '@/components/statistics/WorldStatisticsMap'
import { getPublicPolandCountryStatistics } from '@/lib/db/statistics'

export default async function PublicStatisticsPage() {
  const statistics = await getPublicPolandCountryStatistics()

  return (
    <div className="public-theme min-h-screen bg-[linear-gradient(180deg,#edf8f1_0%,#f8fbf9_55%,#eef5f0_100%)] px-0 py-8 dark:bg-[linear-gradient(180deg,#07130d_0%,#0a1710_55%,#07110c_100%)] sm:px-6 sm:py-10">
      <main className="mx-auto max-w-[86rem]">
        <header className="mb-6 px-4 sm:px-0">
          <p className="font-barlow text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">Statystyki reprezentacji Polski</p>
          <h1 className="mt-1 font-barlow text-3xl font-semibold text-neutral-950 dark:text-neutral-50">Mecze według rywala</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Kolor pokazuje liczbę zweryfikowanych meczów. Statystyki poprzedników są przypisane ich piłkarskim sukcesorom.
          </p>
        </header>

        <WorldStatisticsMap statistics={statistics} />
      </main>
    </div>
  )
}