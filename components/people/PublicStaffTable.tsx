'use client'

import { useMemo } from 'react'
import PublicPeopleSearchTable from '@/components/people/PublicPeopleSearchTable'
import { decodeCoachesPayload, decodeRefereesPayload, type StaffPayload } from '@/lib/people/publicStaffPayload'
import type { AdminPersonListItem } from '@/lib/db/people'

export default function PublicStaffTable({
  payload,
  variant,
  initialSearch,
}: {
  payload: StaffPayload
  variant: 'coaches' | 'referees'
  initialSearch?: string
}) {
  const people = useMemo(
    () => (variant === 'coaches' ? decodeCoachesPayload(payload) : decodeRefereesPayload(payload)),
    [payload, variant]
  )

  return (
    <PublicPeopleSearchTable
      // Widoki trenerów i sędziów czytają tylko pola z PublicCoachListItem / PublicRefereeListItem.
      people={people as unknown as AdminPersonListItem[]}
      basePath="/people"
      variant={variant}
      publicCoachMode={variant === 'coaches' ? 'poland' : undefined}
      publicRefereesView={variant === 'referees'}
      initialSearch={initialSearch}
    />
  )
}
