import MatchesListView from '@/components/matches/MatchesListView'
import { getAdminMatches, type AdminMatch } from '@/lib/db/matches'
import type { RawSearchParams } from '@/lib/pagination'

type PublicMatchesPageProps = {
  searchParams: RawSearchParams
  basePath: string
  detailBasePath: string
  title?: string
}

export default async function PublicMatchesPage({
  searchParams,
  detailBasePath,
  title = 'Mecze reprezentacji',
}: PublicMatchesPageProps) {
  let matches: AdminMatch[] = []
  let fetchError: string | null = null

  try {
    matches = await getAdminMatches()
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <MatchesListView
      title={title}
      totalMatches={matches.length}
      matches={matches}
      fetchError={fetchError}
      detailBasePath={detailBasePath}
      showEditorialStatus={false}
    />
  )
}