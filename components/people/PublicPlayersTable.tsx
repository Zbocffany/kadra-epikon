'use client'

import { useMemo } from 'react'
import PublicPeopleSearchTable from '@/components/people/PublicPeopleSearchTable'
import { decodePlayersPayload, type PlayersPayload } from '@/lib/players/publicPlayersPayload'
import type { AdminPersonListItem } from '@/lib/db/people'

export default function PublicPlayersTable({ payload, initialSearch }: { payload: PlayersPayload; initialSearch?: string }) {
  const people = useMemo(() => decodePlayersPayload(payload), [payload])

  return (
    <PublicPeopleSearchTable
      // Widok piłkarzy czyta tylko pola z PublicPlayerListItem; pełny typ zostaje dla trenerów i sędziów.
      people={people as unknown as AdminPersonListItem[]}
      basePath="/people"
      variant="players"
      publicPlayerMode="poland"
      initialSearch={initialSearch}
    />
  )
}
