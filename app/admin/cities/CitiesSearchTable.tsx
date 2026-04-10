'use client'

import { useState } from 'react'
import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminCityListItem } from '@/lib/db/cities'
import CountryFlag from '@/components/CountryFlag'
import PlayerSilhouetteIcon from '@/components/icons/PlayerSilhouetteIcon'
import PitchIcon from '@/components/icons/PitchIcon'
import { GoalIcon } from '@/components/icons'
import SortableStatHeader from '@/components/admin/SortableStatHeader'

export default function CitiesSearchTable({ cities }: { cities: AdminCityListItem[] }) {
  type SortKey = 'player_count' | 'appearance_count' | 'goal_count'
  const [sortKey, setSortKey] = useState<SortKey>('appearance_count')

  const sorted = [...cities].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))

  function statHeader(key: SortKey, icon: React.ReactNode, label: string) {
    return <SortableStatHeader active={sortKey === key} onClick={() => setSortKey(key)} icon={icon} label={label} />
  }

  const columns: AdminTableColumn<AdminCityListItem>[] = [
    {
      key: 'index',
      label: '',
      render: (_, index) => index + 1,
      className: 'text-neutral-500 w-8 pr-2',
    },
    {
      key: 'city_name',
      label: '',
      headerRender: () => null,
      render: (city) => (
        <div className="flex items-center gap-2.5">
          <CountryFlag fifaCode={city.country_fifa_code} countryName={city.country_name ?? '—'} className="h-3.5 w-[21px] shrink-0" />
          <Link
            href={`/admin/cities/${city.id}`}
            className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            {city.city_name ?? '—'}
          </Link>
        </div>
      ),
      // min-w zapewnia stały układ kolumn stat niezależnie od długości nazwy — spójne z CountriesSearchTable, PeopleSearchTable, ClubsSearchTable
      className: 'font-medium pl-2 min-w-[440px]',
    },
    {
      key: 'player_count',
      label: 'Zawodnicy',
      headerRender: () => statHeader('player_count', <PlayerSilhouetteIcon className="h-5 w-5" />, 'Zawodnicy'),
      render: (city) => city.player_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{city.player_count}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'appearances',
      label: 'Występy',
      headerRender: () => statHeader('appearance_count', <PitchIcon className="h-5 w-5" />, 'Występy'),
      render: (city) => city.appearance_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{city.appearance_count}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'goals',
      label: 'Gole',
      headerRender: () => statHeader('goal_count', <GoalIcon className="h-5 w-5" />, 'Gole'),
      render: (city) => city.goal_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{city.goal_count}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
  ]

  return (
    <AdminSearchableTable
      data={sorted}
      columns={columns}
      searchPlaceholder="Wpisz nazwę miasta albo kraju..."
      showHeader={true}
      emptyMessage="Brak miast w bazie danych."
      emptySearchMessage="Brak miast pasujących do wyszukiwanej frazy."
      getPrimaryText={(city) => city.city_name}
      getSecondaryTexts={(city) => [city.country_name]}
      filterConfig={{
        label: '',
        allLabel: 'Wszystkie kraje',
        getValue: (city) => city.country_name,
      }}
      filterWidthClass="md:w-56"
    />
  )
}
