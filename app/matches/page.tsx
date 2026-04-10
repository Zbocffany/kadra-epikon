import PublicMatchesContent from '@/components/matches/PublicMatchesPage'
import type { RawSearchParams } from '@/lib/pagination'

export const revalidate = 3600

type SearchParams = Promise<RawSearchParams>

export default async function PublicMatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams
  return (
    <PublicMatchesContent
      searchParams={resolvedSearchParams}
      basePath="/matches"
      detailBasePath="/matches"
    />
  )
}