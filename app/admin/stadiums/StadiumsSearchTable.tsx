'use client'

import { useState } from 'react'
import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminStadiumListItem } from '@/lib/db/stadiums'
import CountryFlag from '@/components/CountryFlag'
import SortableStatHeader from '@/components/admin/SortableStatHeader'
import PitchIcon from '@/components/icons/PitchIcon'
import WinIcon from '@/components/icons/WinIcon'
import DrawIcon from '@/components/icons/DrawIcon'
import LossIcon from '@/components/icons/LossIcon'
import { GoalIcon, OwnGoalIcon } from '@/components/icons'

export default function StadiumsSearchTable({ stadiums }: { stadiums: AdminStadiumListItem[] }) {
  type SortKey = 'matches' | 'wins' | 'draws' | 'losses' | 'goals_for' | 'goals_against'
  const [sortKey, setSortKey] = useState<SortKey>('matches')

  const sorted = [...stadiums].sort((a, b) => {
    if (a.matches === 0 && b.matches === 0) return (a.name ?? '').localeCompare(b.name ?? '', 'pl')
    if (a.matches === 0) return 1
    if (b.matches === 0) return -1
    return (b[sortKey] as number) - (a[sortKey] as number)
  })

  function statHeader(key: SortKey, icon: React.ReactNode, label: string) {
    return <SortableStatHeader active={sortKey === key} onClick={() => setSortKey(key)} icon={icon} label={label} />
  }

  const columns: AdminTableColumn<AdminStadiumListItem>[] = [
    {
      key: 'index',
      label: '',
      render: (_, index) => index + 1,
      className: 'text-neutral-500 w-8 pr-2',
    },
    {
      key: 'name',
      label: 'Stadion',
      headerRender: () => null,
      render: (stadium) => (
        <div className="flex items-center gap-2.5">
          <CountryFlag fifaCode={stadium.country_fifa_code} countryName={stadium.country_name ?? '-'} className="h-3.5 w-[21px] shrink-0" />
          <div className="group/stadium relative inline-flex">
            <Link
              href={`/admin/stadiums/${stadium.id}`}
              className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              {stadium.name ?? '-'}
            </Link>
            {stadium.city_name && (
              <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/stadium:opacity-100">
                {stadium.city_name}
              </div>
            )}
          </div>
        </div>
      ),
      className: 'font-medium pl-2 min-w-[440px]',
    },
    {
      key: 'matches',
      label: 'Mecze',
      headerRender: () => statHeader('matches', <PitchIcon className="h-5 w-5" />, 'Mecze na tym stadionie'),
      render: (s) => s.matches > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{s.matches}</span> : <span className="text-sm text-neutral-600">-</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'wins',
      label: 'Zwycięstwa',
      headerRender: () => statHeader('wins', <WinIcon className="h-5 w-5" />, 'Zwycięstwa Polski'),
      render: (s) => s.wins > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{s.wins}</span> : <span className="text-sm text-neutral-600">-</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'draws',
      label: 'Remisy',
      headerRender: () => statHeader('draws', <DrawIcon className="h-5 w-5" />, 'Remisy'),
      render: (s) => s.draws > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{s.draws}</span> : <span className="text-sm text-neutral-600">-</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'losses',
      label: 'Porażki',
      headerRender: () => statHeader('losses', <LossIcon className="h-5 w-5" />, 'Porażki Polski'),
      render: (s) => s.losses > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{s.losses}</span> : <span className="text-sm text-neutral-600">-</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'goals_for',
      label: 'Gole strzelone',
      headerRender: () => statHeader('goals_for', <GoalIcon className="h-5 w-5" />, 'Gole strzelone przez Polskę'),
      render: (s) => s.goals_for > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{s.goals_for}</span> : <span className="text-sm text-neutral-600">-</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'goals_against',
      label: 'Gole stracone',
      headerRender: () => statHeader('goals_against', <OwnGoalIcon className="h-5 w-5" />, 'Gole stracone przez Polskę'),
      render: (s) => s.goals_against > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{s.goals_against}</span> : <span className="text-sm text-neutral-600">-</span>,
      className: 'text-center px-1!',
    },
  ]

  return (
    <AdminSearchableTable
      data={sorted}
      columns={columns}
      searchPlaceholder="Wpisz nazwę stadionu, miasto albo kraj..."
      showHeader={true}
      emptyMessage="Brak stadionów w bazie danych."
      emptySearchMessage="Brak stadionów pasujących do wyszukiwanej frazy."
      getPrimaryText={(stadium) => stadium.name}
      getSecondaryTexts={(stadium) => [stadium.city_name, stadium.country_name]}
      filterConfig={{
        label: '',
        allLabel: 'Wszystkie kraje',
        getValue: (stadium) => stadium.country_name,
      }}
      filterWidthClass="md:w-56"
    />
  )
}