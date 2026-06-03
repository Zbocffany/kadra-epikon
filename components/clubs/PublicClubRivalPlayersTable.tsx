'use client'

import { useMemo, useState } from 'react'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import PlayerSilhouetteIcon from '@/components/icons/PlayerSilhouetteIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import ClockIcon from '@/components/icons/ClockIcon'
import { GoalIcon } from '@/components/icons'
import CountryFlag from '@/components/CountryFlag'
import type { AdminClubRivalPlayerStat } from '@/lib/db/clubs'

type SortKey = 'person_name' | 'appearance_count' | 'goal_count' | 'minute_count'

export default function PublicClubRivalPlayersTable({
  players,
}: {
  players: AdminClubRivalPlayerStat[]
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
      if (b.minute_count !== a.minute_count) return b.minute_count - a.minute_count
      return a.person_name.localeCompare(b.person_name, 'pl')
    })
  }, [players, sortKey])

  function sortHeader(key: SortKey, icon: React.ReactNode, label: string) {
    const active = sortKey === key
    return (
      <button
        type="button"
        onClick={() => setSortKey(key)}
        className={`inline-flex items-center gap-0.5 transition-opacity ${
          active ? 'text-emerald-50 opacity-100' : 'text-emerald-100/85 opacity-70 hover:opacity-100'
        }`}
        aria-label={label}
        title={label}
      >
        {icon}
        <span className="text-[8px] leading-none">▼</span>
      </button>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-emerald-900/70 bg-emerald-950/20">
      <div className="relative z-0 overflow-x-auto">
        <table className="min-w-full table-fixed text-sm">
          <colgroup>
            <col className="w-auto" />
            <col className="w-[5.5rem]" />
            <col className="w-[4rem]" />
            <col className="w-[4rem]" />
            <col className="w-[4.5rem]" />
          </colgroup>
          <thead className="relative z-20 bg-emerald-950/45 text-emerald-100/80">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                {sortHeader('person_name', <PlayerSilhouetteIcon className="h-3.5 w-3.5" />, 'Piłkarze')}
              </th>
              <th className="px-1 py-2 text-center font-medium" aria-label="Reprezentowane kraje" />
              <th className="px-1 py-2 text-center font-medium">
                {sortHeader('appearance_count', <PitchIcon className="h-3.5 w-3.5" />, 'Występy')}
              </th>
              <th className="px-1 py-2 text-center font-medium">
                {sortHeader('goal_count', <GoalIcon className="h-3.5 w-3.5" />, 'Gole')}
              </th>
              <th className="px-1 py-2 text-center font-medium">
                {sortHeader('minute_count', <ClockIcon className="h-3.5 w-3.5" />, 'Minuty')}
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
              <td className="px-1 py-3">
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {player.represented_countries.map((c) => (
                    <CountryFlag
                      key={c.country_id}
                      fifaCode={c.fifa_code}
                      countryName={c.name}
                      className="h-4 w-6 ring-1 ring-neutral-500/60"
                    />
                  ))}
                </div>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex h-7 min-w-[2rem] items-center justify-center rounded border border-emerald-100/40 bg-slate-950/35 px-1.5 py-0.5 font-barlow text-[0.99rem] font-semibold text-emerald-50">{player.appearance_count}</span>
              </td>
              <td className="px-1 py-3 text-center">
                <span className="stat-badge inline-flex h-7 min-w-[2rem] items-center justify-center rounded border border-emerald-100/40 bg-slate-950/35 px-1.5 py-0.5 font-barlow text-[0.99rem] font-semibold text-emerald-50">{player.goal_count}</span>
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
