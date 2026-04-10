'use client'

import { useState } from 'react'
import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import CountryFlag from '@/components/CountryFlag'
import type { AdminCountry } from '@/lib/db/countries'
import SortableStatHeader from '@/components/admin/SortableStatHeader'
import PitchIcon from '@/components/icons/PitchIcon'
import WinIcon from '@/components/icons/WinIcon'
import DrawIcon from '@/components/icons/DrawIcon'
import LossIcon from '@/components/icons/LossIcon'
import { GoalIcon, OwnGoalIcon } from '@/components/icons'

export default function CountriesSearchTable({ countries }: { countries: AdminCountry[] }) {
  type SortKey = 'matches' | 'wins' | 'draws' | 'losses' | 'goals_for' | 'goals_against'
  const [sortKey, setSortKey] = useState<SortKey>('matches')

  const sorted = [...countries].sort((a, b) => {
    if (a.matches === 0 && b.matches === 0) return a.name.localeCompare(b.name)
    if (a.matches === 0) return 1
    if (b.matches === 0) return -1
    return (b[sortKey] as number) - (a[sortKey] as number)
  })

  function statHeader(key: SortKey, icon: React.ReactNode, label: string) {
    return <SortableStatHeader active={sortKey === key} onClick={() => setSortKey(key)} icon={icon} label={label} />
  }

  const columns: AdminTableColumn<AdminCountry>[] = [
    {
      key: 'index',
      label: '',
      render: (_, index) => index + 1,
      className: 'text-neutral-500 w-8 pr-2',
    },
    {
      key: 'name',
      label: 'Nazwa',
      render: (country) => (
        <div className="flex items-center gap-2.5">
          <CountryFlag fifaCode={country.fifa_code} countryName={country.name} className="h-3.5 w-[21px] shrink-0" />
          <Link
            href={`/admin/countries/${country.id}`}
            className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            {country.name}
          </Link>
        </div>
      ),
      // min-w zapewnia stały układ kolumn stat niezależnie od długości nazwy kraju (punkt odniesienia: widok "Wszystkie federacje")
      className: 'font-medium pl-2 min-w-[440px]',
    },
    {
      key: 'matches',
      label: 'Mecze',
      headerRender: () => statHeader('matches', <PitchIcon className="h-5 w-5" />, 'Mecze z Polską'),
      render: (c) => c.matches > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{c.matches}</span> : <span className="text-sm text-neutral-600">–</span>,
      // Kolumny statystyk: text-center px-1! — spójne z układem kolumn stat w PeopleSearchTable
      className: 'text-center px-1!',
    },
    {
      key: 'wins',
      label: 'Zwycięstwa',
      headerRender: () => statHeader('wins', <WinIcon className="h-5 w-5" />, 'Zwycięstwa Polski'),
      render: (c) => c.wins > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{c.wins}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'draws',
      label: 'Remisy',
      headerRender: () => statHeader('draws', <DrawIcon className="h-5 w-5" />, 'Remisy'),
      render: (c) => c.draws > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{c.draws}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'losses',
      label: 'Porażki',
      headerRender: () => statHeader('losses', <LossIcon className="h-5 w-5" />, 'Porażki Polski'),
      render: (c) => c.losses > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{c.losses}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'goals_for',
      label: 'Gole strzelone',
      headerRender: () => statHeader('goals_for', <GoalIcon className="h-5 w-5" />, 'Gole strzelone przez Polskę'),
      render: (c) => c.goals_for > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{c.goals_for}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
    {
      key: 'goals_against',
      label: 'Gole stracone',
      headerRender: () => statHeader('goals_against', <OwnGoalIcon className="h-5 w-5" />, 'Gole stracone przez Polskę'),
      render: (c) => c.goals_against > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{c.goals_against}</span> : <span className="text-sm text-neutral-600">–</span>,
      className: 'text-center px-1!',
    },
  ]

  return (
    <AdminSearchableTable
      data={sorted}
      columns={columns}
      searchPlaceholder="Wpisz nazwę kraju, kod FIFA albo federację..."
      showHeader={true}
      emptyMessage="Brak krajów."
      emptySearchMessage="Brak krajów pasujących do wyszukiwanej frazy."
      getPrimaryText={(country) => country.name}
      getSecondaryTexts={(country) => [country.fifa_code, country.federation_short_name]}
      filterConfig={{
        label: '',
        allLabel: 'Wszystkie federacje',
        getValue: (country) => country.federation_short_name,
      }}
      filterWidthClass="md:w-[220px]"
    />
  )
}
