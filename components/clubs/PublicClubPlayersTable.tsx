'use client'

import { useMemo, useState } from 'react'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import SortableStatHeader from '@/components/admin/SortableStatHeader'
import PlayerSilhouetteIcon from '@/components/icons/PlayerSilhouetteIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import ClockIcon from '@/components/icons/ClockIcon'
import { GoalIcon, AssistIcon } from '@/components/icons'
import type { AdminClubPlayerStat } from '@/lib/db/clubs'

type SortKey = 'person_name' | 'appearance_count' | 'goal_count' | 'assist_count' | 'minute_count'

export default function PublicClubPlayersTable({
  players,
}: {
  players: AdminClubPlayerStat[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>('appearance_count')

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (sortKey === 'person_name') {
        return a.person_name.localeCompare(b.person_name, 'pl')
      }

      const delta = (b[sortKey] as number) - (a[sortKey] as number)
      if (delta !== 0) return delta
      if (b.appearance_count !== a.appearance_count) return b.appearance_count - a.appearance_count
      if (b.goal_count !== a.goal_count) return b.goal_count - a.goal_count
      if (b.assist_count !== a.assist_count) return b.assist_count - a.assist_count
      if (b.minute_count !== a.minute_count) return b.minute_count - a.minute_count
      return a.person_name.localeCompare(b.person_name, 'pl')
    })
  }, [players, sortKey])

  function statHeader(key: SortKey, icon: React.ReactNode, label: string) {
    return <SortableStatHeader active={sortKey === key} onClick={() => setSortKey(key)} icon={icon} label={label} />
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40">
      <div className="relative z-0 overflow-x-auto pt-6 -mt-6">
        <table className="min-w-full table-fixed text-sm">
          <colgroup>
            <col className="w-auto" />
            <col className="w-[3.5rem]" />
            <col className="w-[3.5rem]" />
            <col className="w-[3.5rem]" />
            <col className="w-[4.25rem]" />
          </colgroup>
          <thead className="relative z-20 bg-neutral-900/80 text-neutral-400">
            <tr>
            <th className="px-3 py-3 text-left font-medium">
              <div className="flex justify-start">
                {statHeader('person_name', <PlayerSilhouetteIcon className="h-4 w-4" />, 'Piłkarz')}
              </div>
            </th>
            <th className="px-1 py-3 text-center font-medium">
              {statHeader('appearance_count', <PitchIcon className="h-4 w-4" />, 'Występy')}
            </th>
            <th className="px-1 py-3 text-center font-medium">
              {statHeader('goal_count', <GoalIcon className="h-4 w-4" />, 'Gole')}
            </th>
            <th className="px-1 py-3 text-center font-medium">
              {statHeader('assist_count', <AssistIcon className="h-4 w-4" />, 'Asysty')}
            </th>
            <th className="px-1 py-3 text-center font-medium">
              {statHeader('minute_count', <ClockIcon className="h-4 w-4" />, 'Minuty')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-neutral-900/40 text-neutral-200">
          {sortedPlayers.map((player) => (
            <tr key={player.person_id}>
              <td className="px-3 py-3">
                <SmartPrefetchLink
                  href={`/people/${player.person_id}`}
                  className="inline-flex max-w-full truncate rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[0.825rem] font-semibold text-neutral-200 hover:bg-neutral-800"
                >
                  <span className="truncate">{player.person_name}</span>
                </SmartPrefetchLink>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.99rem] font-semibold text-neutral-200 light:text-neutral-900">{player.appearance_count}</span>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.99rem] font-semibold text-neutral-200 light:text-neutral-900">{player.goal_count}</span>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.99rem] font-semibold text-neutral-200 light:text-neutral-900">{player.assist_count}</span>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.99rem] font-semibold text-neutral-200 light:text-neutral-900">{player.minute_count}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
