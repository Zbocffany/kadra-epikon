import { getAdminMatches } from '@/lib/db/matches'
import type { AdminMatch, EditorialStatus, MatchStatus } from '@/lib/db/matches'

// ─── Badge helpers ────────────────────────────────────────────────────────────

function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const styles: Record<string, string> = {
    SCHEDULED: 'bg-indigo-900/50 text-indigo-300 ring-indigo-700',
    FINISHED:  'bg-neutral-800   text-neutral-300 ring-neutral-700',
    ABANDONED: 'bg-orange-900/50 text-orange-300  ring-orange-700',
    CANCELLED: 'bg-red-900/50    text-red-300     ring-red-700',
  }
  const cls = styles[status] ?? 'bg-neutral-800 text-neutral-400 ring-neutral-700'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  )
}

function EditorialStatusBadge({ status }: { status: EditorialStatus }) {
  const styles: Record<string, string> = {
    DRAFT:    'bg-neutral-800    text-neutral-400  ring-neutral-600',
    PARTIAL:  'bg-amber-900/50   text-amber-300    ring-amber-700',
    COMPLETE: 'bg-blue-900/50    text-blue-300     ring-blue-700',
    VERIFIED: 'bg-emerald-900/50 text-emerald-300  ring-emerald-700',
  }
  const cls = styles[status] ?? 'bg-neutral-800 text-neutral-400 ring-neutral-600'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  )
}

function formatDate(dateStr: string) {
  // dateStr is a plain date from Postgres: 'YYYY-MM-DD'
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminMatchesPage() {
  let matches: AdminMatch[]
  let fetchError: string | null = null

  try {
    matches = await getAdminMatches()  
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
    matches = []
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Admin
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Mecze
            </h1>
          </div>
          <span className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
            tylko do odczytu
          </span>
        </div>

        {/* Error state */}
        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
            <strong className="font-semibold">Błąd pobierania danych:</strong>{' '}
            {fetchError}
          </div>
        )}

        {/* Empty state */}
        {!fetchError && matches.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-6 py-16 text-center text-neutral-500">
            Brak meczów w bazie danych.
          </div>
        )}

        {/* Table */}
        {matches.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-400">Data</th>
                  <th className="px-4 py-3 font-medium text-neutral-400">Gospodarz</th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-400">vs</th>
                  <th className="px-4 py-3 font-medium text-neutral-400">Gość</th>
                  <th className="px-4 py-3 font-medium text-neutral-400">Rozgrywki</th>
                  <th className="px-4 py-3 font-medium text-neutral-400">Status meczu</th>
                  <th className="px-4 py-3 font-medium text-neutral-400">Status redakcji</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match, i) => (
                  <tr
                    key={match.id}
                    className={`border-b border-neutral-800 transition-colors hover:bg-neutral-900/60 ${
                      i % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/30'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-neutral-300 whitespace-nowrap">
                      {formatDate(match.match_date)}
                      {match.match_time && (
                        <span className="ml-2 text-xs text-neutral-500">
                          {match.match_time.slice(0, 5)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-100 whitespace-nowrap">
                      {match.home_team_name}
                    </td>
                    <td className="px-4 py-3 text-center text-neutral-500">–</td>
                    <td className="px-4 py-3 font-semibold text-neutral-100 whitespace-nowrap">
                      {match.away_team_name}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">
                      {match.competition_name}
                    </td>
                    <td className="px-4 py-3">
                      <MatchStatusBadge status={match.match_status} />
                    </td>
                    <td className="px-4 py-3">
                      <EditorialStatusBadge status={match.editorial_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-neutral-800 bg-neutral-900/50 px-4 py-2 text-xs text-neutral-500">
              {matches.length} {matches.length === 1 ? 'mecz' : 'meczów'} · posortowane od najnowszych
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
