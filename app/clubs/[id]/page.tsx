import AdminClubDetailsPage from '../../admin/clubs/[id]/page'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

export const dynamic = 'force-dynamic'

type PublicClubDetailsPageProps = {
  params: DetailPageParams
  searchParams?: DetailPageSearchParams
}

export default function PublicClubDetailsPage({
  params,
  searchParams,
}: PublicClubDetailsPageProps) {
  return (
    <AdminClubDetailsPage
      params={params}
      searchParams={searchParams ?? Promise.resolve({})}
      isPublic={true}
    />
  )
}
