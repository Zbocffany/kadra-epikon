'use client'

import { useState } from 'react'
import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminClub } from '@/lib/db/clubs'
import CountryFlag from '@/components/CountryFlag'
import PlayerSilhouetteIcon from '@/components/icons/PlayerSilhouetteIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import { GoalIcon } from '@/components/icons'
import SortableStatHeader from '@/components/admin/SortableStatHeader'

export default function ClubsSearchTable({ clubs }: { clubs: AdminClub[] }) {
  type SortKey = 'player_count' | 'appearance_count' | 'goal_count'
  const [sortKey, setSortKey] = useState<SortKey>('appearance_count')

  const sorted = [...clubs].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))

  function statHeader(key: SortKey, icon: React.ReactNode, label: string) {
    return <SortableStatHeader active={sortKey === key} onClick={() => setSortKey(key)} icon={icon} label={label} />
  }

  const columns: AdminTableColumn<AdminClub>[] = [
    {
      key: 'index',
      label: '',
      render: (_, index) => index + 1,
      className: 'text-neutral-500 w-8 pr-2',
    },
    {
      key: 'name',
      label: '',
      headerRender: () => null,
      render: (club) => (
        <div className="flex items-center gap-2.5">
          <CountryFlag fifaCode={club.country_fifa_code} countryName={club.country_name ?? '—'} className="h-3.5 w-[21px] shrink-0" />
          <div className="relative inline-flex group/tooltip">
            <Link
              href={`/admin/clubs/${club.id}`}
              className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              {club.name}
            </Link>
            {club.city_name && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100">
                {club.city_name}
              </span>
            )}
          </div>
        </div>
      ),
      // min-w zapewnia stały układ kolumn stat niezależnie od długości nazwy (punkt odniesienia: widok wszystkich krajów w filtrze)
      // spójne z analogicznym ustawieniem w CountriesSearchTable i PeopleSearchTable
      className: 'font-medium pl-2 min-w-[360px]',
    },
    {
      key: 'player_count',
      label: 'Zawodnicy',
      headerRender: () => statHeader('player_count', <PlayerSilhouetteIcon className="h-5 w-5" />, 'Zawodnicy'),
      render: (club) => club.player_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{club.player_count}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'appearances',
      label: 'Występy',
      headerRender: () => statHeader('appearance_count', <PitchIcon className="h-5 w-5" />, 'Występy'),
      render: (club) => club.appearance_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{club.appearance_count}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'goals',
      label: 'Gole',
      headerRender: () => statHeader('goal_count', <GoalIcon className="h-5 w-5" />, 'Gole'),
      render: (club) => club.goal_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{club.goal_count}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
  ]

  return (
    <AdminSearchableTable
      data={sorted}
      columns={columns}
      searchPlaceholder="Wpisz nazwę klubu albo miasto..."
      showHeader={true}
      emptyMessage="Brak klubów w bazie danych."
      emptySearchMessage="Brak klubów pasujących do wyszukiwanej frazy."
      getPrimaryText={(club) => club.name}
      getSecondaryTexts={(club) => [club.city_name, club.country_name]}
      filterConfig={{
        label: '',
        allLabel: 'Wszystkie miasta',
        getValue: (club) => club.city_name,
      }}
      secondaryFilterConfig={{
        label: '',
        allLabel: 'Wszystkie kraje',
        getValue: (club) => club.country_name,
      }}
      filterWidthClass="md:w-56"
      secondaryFilterWidthClass="md:w-56"
    />
  )
}