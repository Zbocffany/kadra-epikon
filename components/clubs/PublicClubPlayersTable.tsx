'use client'

import { useMemo, useState } from 'react'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import PlayerSilhouetteIcon from '@/components/icons/PlayerSilhouetteIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import ClockIcon from '@/components/icons/ClockIcon'
import { GoalIcon, AssistIcon } from '@/components/icons'
import type { AdminClubPlayerStat } from '@/lib/db/clubs'

type SortKey = 'person_name' | 'appearance_count' | 'goal_count' | 'assist_count' | 'minute_count'

export default function PublicClubPlayersTable({
  players,
  summary,
}: {
  players: AdminClubPlayerStat[]
  summary: {
    appearance_count: number
    goal_count: number
    assist_count: number
    minute_count: number
  }
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

  function headerWithBadge(
    key: SortKey,
    icon: React.ReactNode,
    label: string,
    badgeContent: React.ReactNode
  ) {
    return (
      <div className="relative inline-flex min-h-7 items-center justify-center">
        <button
          type="button"
          onClick={() => setSortKey(key)}
          className={`absolute right-full mr-1.5 inline-flex items-center gap-0.5 transition-opacity ${
            sortKey === key
              ? 'text-emerald-50 opacity-100'
              : 'text-emerald-100/85 opacity-70 hover:opacity-100'
          }`}
          aria-label={label}
          title={label}
        >
          {icon}
          <span className="text-[8px] leading-none">▼</span>
        </button>
        <span className="inline-flex h-7 min-w-[3.1rem] items-center justify-center rounded-md border border-emerald-100/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.06)_22%,rgba(12,31,24,0.46)_100%)] px-1.5 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_3px_rgba(0,0,0,0.45),0_2px_5px_rgba(0,0,0,0.45)] font-barlow text-[0.99rem] font-semibold text-emerald-50">
          {badgeContent}
        </span>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-emerald-900/70 bg-emerald-950/20">
      <div className="relative z-0 overflow-x-auto pt-6 -mt-6">
        <table className="min-w-full table-fixed text-sm">
          <colgroup>
            <col className="w-auto" />
            <col className="w-[5rem]" />
            <col className="w-[5rem]" />
            <col className="w-[5rem]" />
            <col className="w-[5.5rem]" />
          </colgroup>
          <thead className="relative z-20 bg-emerald-950/45 text-emerald-100/80">
            <tr>
              <th className="px-3 py-3 text-left font-medium">
                <div className="flex min-h-7 items-center gap-1.5 justify-start">
                  <span className="text-emerald-100/85" title="Piłkarze">
                    <PlayerSilhouetteIcon className="h-3 w-3" />
                  </span>
                  <span className="inline-flex h-7 min-w-[3.1rem] items-center justify-center rounded-md border border-emerald-100/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.06)_22%,rgba(12,31,24,0.46)_100%)] px-1.5 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-2px_3px_rgba(0,0,0,0.45),0_2px_5px_rgba(0,0,0,0.45)] font-barlow text-[0.99rem] font-semibold text-emerald-50">
                    {players.length}
                  </span>
                </div>
              </th>
              <th className="px-1 py-3 text-center font-medium">
                {headerWithBadge('appearance_count', <PitchIcon className="h-3 w-3" />, 'Występy', summary.appearance_count)}
              </th>
              <th className="px-1 py-3 text-center font-medium">
                {headerWithBadge('goal_count', <GoalIcon className="h-3 w-3" />, 'Gole', summary.goal_count)}
              </th>
              <th className="px-1 py-3 text-center font-medium">
                {headerWithBadge('assist_count', <AssistIcon className="h-3 w-3" />, 'Asysty', summary.assist_count)}
              </th>
              <th className="px-1 py-3 text-center font-medium">
                {headerWithBadge('minute_count', <ClockIcon className="h-3 w-3" />, 'Minuty', summary.minute_count)}
              </th>
            </tr>
        </thead>
        <tbody className="bg-emerald-950/20 text-emerald-50">
          {sortedPlayers.map((player) => (
            <tr
              key={player.person_id}
              className="border-t border-emerald-900/70 bg-emerald-950/38 transition-colors hover:bg-emerald-900/45"
            >
              <td className="px-3 py-3">
                <SmartPrefetchLink
                  href={`/people/${player.person_id}`}
                  className="inline-flex max-w-full truncate rounded-md border border-emerald-100/40 bg-slate-950/35 px-2.5 py-1 text-[0.825rem] font-semibold text-emerald-50 hover:bg-slate-900/55"
                >
                  <span className="truncate">{player.person_name}</span>
                </SmartPrefetchLink>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex h-7 min-w-[2rem] items-center justify-center rounded border border-emerald-100/40 bg-slate-950/35 px-1.5 py-0.5 font-barlow text-[0.99rem] font-semibold text-emerald-50">{player.appearance_count}</span>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex h-7 min-w-[2rem] items-center justify-center rounded border border-emerald-100/40 bg-slate-950/35 px-1.5 py-0.5 font-barlow text-[0.99rem] font-semibold text-emerald-50">{player.goal_count}</span>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex h-7 min-w-[2rem] items-center justify-center rounded border border-emerald-100/40 bg-slate-950/35 px-1.5 py-0.5 font-barlow text-[0.99rem] font-semibold text-emerald-50">{player.assist_count}</span>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex h-7 min-w-[2rem] items-center justify-center rounded border border-emerald-100/40 bg-slate-950/35 px-1.5 py-0.5 font-barlow text-[0.99rem] font-semibold text-emerald-50">{player.minute_count}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
