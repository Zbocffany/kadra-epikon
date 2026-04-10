import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import PublicMatchesPage from '@/components/matches/PublicMatchesPage'
import type { RawSearchParams } from '@/lib/pagination'

export const revalidate = 3600

type SearchParams = Promise<RawSearchParams>

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams

  return (
    <div className="relative">
      <div className="fixed right-6 top-6 z-20 flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/login"
          className="rounded-lg border border-neutral-700/80 bg-neutral-900/80 px-4 py-2 text-sm text-neutral-200 backdrop-blur transition hover:border-neutral-500 hover:bg-neutral-900"
        >
          Zaloguj sie
        </Link>
      </div>

      <PublicMatchesPage
        searchParams={resolvedSearchParams}
        basePath="/"
        detailBasePath="/matches"
      />
    </div>
  )
}