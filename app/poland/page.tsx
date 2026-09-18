import Link from 'next/link'
import PolandVoivodeshipMap from '@/components/statistics/PolandVoivodeshipMap'
import {
  getPublicPolandPlayersBornAbroad,
  getPublicPolandPlayersUnknownVoivodeship,
  getPublicPolandVoivodeshipStatistics,
} from '@/lib/db/polandStats'

export const metadata = {
  title: 'Polska — reprezentanci według województwa',
}

function formatPersonName(firstName: string | null, lastName: string | null): string {
  const parts = [firstName, lastName].filter((part): part is string => Boolean(part && part.trim()))
  return parts.length > 0 ? parts.join(' ') : '(bez nazwiska)'
}

export default async function PolandPage() {
  const [voivodeshipStats, playersBornAbroad, playersUnknownVoivodeship] = await Promise.all([
    getPublicPolandVoivodeshipStatistics(),
    getPublicPolandPlayersBornAbroad(),
    getPublicPolandPlayersUnknownVoivodeship(),
  ])

  return (
    <div className="public-theme min-h-screen bg-[linear-gradient(180deg,#edf8f1_0%,#f8fbf9_55%,#eef5f0_100%)] px-0 py-8 dark:bg-[linear-gradient(180deg,#07130d_0%,#0a1710_55%,#07110c_100%)] sm:px-6 sm:py-10">
      <main className="mx-auto max-w-[86rem]">
        <header className="mb-6 px-4 sm:px-0">
          <p className="font-barlow text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
            Reprezentacja Polski
          </p>
          <h1 className="mt-1 font-barlow text-3xl font-semibold text-neutral-950 dark:text-neutral-50">
            Polska według województwa urodzenia
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Statystyki reprezentantów Polski przypisane do województwa urodzenia. Uwzględniamy
            wyłącznie osoby, które faktycznie weszły na boisko w zweryfikowanym meczu
            reprezentacji.
          </p>
        </header>

        <div className="px-4 sm:px-0">
          <PolandVoivodeshipMap
            statistics={voivodeshipStats}
            unknownPlayers={playersUnknownVoivodeship}
          />
        </div>

        <section className="mt-10 px-4 sm:px-0">
          <h2 className="font-barlow text-2xl font-semibold text-neutral-950 dark:text-neutral-100">
            Reprezentanci urodzeni poza granicami Polski
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            Zawodnicy, którzy zagrali w reprezentacji Polski, a miejsce urodzenia leży poza
            współczesnymi granicami kraju.
          </p>

          {playersBornAbroad.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
              Brak zawodników spełniających kryteria.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Zawodnik</th>
                    <th className="px-3 py-2 font-semibold">Kraj urodzenia</th>
                    <th className="px-3 py-2 font-semibold">Miasto urodzenia</th>
                    <th className="px-3 py-2 text-right font-semibold">Występy</th>
                    <th className="px-3 py-2 text-right font-semibold">Gole</th>
                  </tr>
                </thead>
                <tbody>
                  {playersBornAbroad.map((player) => (
                    <tr
                      key={player.personId}
                      className="border-t border-neutral-200 hover:bg-emerald-50/60 dark:border-neutral-800 dark:hover:bg-emerald-950/30"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/people/${player.personId}`}
                          className="font-medium text-emerald-800 hover:underline dark:text-emerald-300"
                        >
                          {formatPersonName(player.firstName, player.lastName)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-200">
                        {player.birthCountryId ? (
                          <Link
                            href={`/countries/${player.birthCountryId}`}
                            className="hover:text-emerald-800 hover:underline dark:hover:text-emerald-300"
                          >
                            {player.birthCountryName ?? player.birthCountryFifa ?? '—'}
                          </Link>
                        ) : (
                          <span>{player.birthCountryName ?? player.birthCountryFifa ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-200">
                        {player.birthCityName ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                        {player.appearanceCount.toLocaleString('pl-PL')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                        {player.goalCount.toLocaleString('pl-PL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
