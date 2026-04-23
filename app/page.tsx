import PublicMatchesPage from '@/components/matches/PublicMatchesPage'
import type { RawSearchParams } from '@/lib/pagination'

export const revalidate = 3600

type SearchParams = Promise<RawSearchParams>

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams

  return (
    <PublicMatchesPage
      searchParams={resolvedSearchParams}
      basePath="/"
      detailBasePath="/matches"
    />
  )
}