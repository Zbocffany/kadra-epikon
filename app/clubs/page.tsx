import { getPublicClubs } from '@/lib/db/clubs'
import type { AdminClub } from '@/lib/db/clubs'
import AdminListLayout from '@/components/admin/AdminListLayout'
import ClubsSearchTable from '@/app/admin/clubs/ClubsSearchTable'

export const revalidate = 3600

export default async function PublicClubsPage() {
  let clubs: AdminClub[] = []
  let fetchError: string | null = null

  try {
    clubs = await getPublicClubs()
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  const pluralLabel = (() => {
    const count = clubs.length
    if (count === 1) return 'klub'
    if (count < 5) return 'kluby'
    return 'klubów'
  })()

  return (
    <div className="public-theme">
      <AdminListLayout
        title="Kluby"
        breadcrumb="Publiczne"
        maxWidthClass="max-w-[74rem]"
        recordCount={clubs.length}
        recordLabel={pluralLabel}
        fetchError={fetchError}
      >
        {!fetchError && <ClubsSearchTable clubs={clubs} basePath="/clubs" />}
      </AdminListLayout>
    </div>
  )
}
