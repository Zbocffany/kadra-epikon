import AdminPersonDetailsPage from '../../admin/people/[id]/page'
import type { DetailPageParams, DetailPageSearchParams } from '@/lib/types/admin'

export const revalidate = 3600

type PublicPersonDetailsPageProps = {
  params: DetailPageParams
  searchParams?: DetailPageSearchParams
}

export default function PublicPersonDetailsPage({
  params,
  searchParams,
}: PublicPersonDetailsPageProps) {
  return (
    <AdminPersonDetailsPage
      params={params}
      searchParams={searchParams ?? Promise.resolve({})}
      isPublic={true}
    />
  )
}
