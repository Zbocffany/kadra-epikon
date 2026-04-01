import MatchesListView from '@/components/matches/MatchesListView'
import { getAdminMatchesPage, type AdminMatch } from '@/lib/db/matches'
import { getPaginationMeta, parsePaginationParams, type RawSearchParams } from '@/lib/pagination'

type PublicMatchesPageProps = {
  searchParams: RawSearchParams
  basePath: string
  detailBasePath: string
  title?: string
}

export default async function PublicMatchesPage({
  searchParams,
  basePath,
  detailBasePath,
  title = 'Mecze reprezentacji',
}: PublicMatchesPageProps) {
  const { page, pageSize } = parsePaginationParams(searchParams)

  let matches: AdminMatch[] = []
  let totalMatches = 0
  let fetchError: string | null = null

  try {
    const fetchedMatches = await getAdminMatchesPage(page, pageSize)
    matches = fetchedMatches.items
    totalMatches = fetchedMatches.total
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <MatchesListView
      title={title}
      totalMatches={totalMatches}
      matches={matches}
      fetchError={fetchError}
      pagination={getPaginationMeta(totalMatches, page, pageSize)}
      searchParams={searchParams}
      basePath={basePath}
      detailBasePath={detailBasePath}
      showEditorialStatus={false}
    />
  )
}