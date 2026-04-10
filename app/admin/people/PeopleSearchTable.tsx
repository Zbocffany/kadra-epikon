'use client'

import { useState } from 'react'
import Link from 'next/link'
import CountryFlag from '@/components/CountryFlag'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminPersonListItem, AdminPersonRole } from '@/lib/db/people'
import { getPersonDisplayName } from '@/lib/db/people'
import PitchIcon from '@/components/icons/PitchIcon'
import { GoalIcon, AssistIcon, YellowCardIcon, RedCardIcon } from '@/components/icons'
import BenchIcon from '@/components/icons/BenchIcon'
import SortableStatHeader from '@/components/admin/SortableStatHeader'

const ROLE_META: Record<AdminPersonRole, { initial: string; label: string; className: string }> = {
  PLAYER: {
    initial: 'P',
    label: 'Piłkarz',
    className: 'border-sky-500/70 bg-sky-500/15 text-sky-300',
  },
  COACH: {
    initial: 'T',
    label: 'Trener',
    className: 'border-amber-500/70 bg-amber-500/15 text-amber-300',
  },
  REFEREE: {
    initial: 'S',
    label: 'Sędzia',
    className: 'border-rose-500/70 bg-rose-500/15 text-rose-300',
  },
}

function getAgeDisplay(person: AdminPersonListItem): string | null {
  if (!person.birth_date) return null
  const birth = new Date(person.birth_date)
  const ref = person.death_date ? new Date(person.death_date) : new Date()
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return person.death_date ? null : `(${age} l.)`
}

function getActivityLabel(person: AdminPersonListItem): string {
  return person.is_active ? 'Aktywna' : 'Nieaktywna'
}

export default function PeopleSearchTable({ people }: { people: AdminPersonListItem[] }) {
  type SortKey = 'appearance_count' | 'goal_count' | 'assist_count' | 'yellow_card_count' | 'red_card_count' | 'bench_count'
  const [sortKey, setSortKey] = useState<SortKey>('appearance_count')

  const sorted = [...people].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))

  function statHeader(key: SortKey, icon: React.ReactNode, label: string) {
    return <SortableStatHeader active={sortKey === key} onClick={() => setSortKey(key)} icon={icon} label={label} />
  }

  const columns: AdminTableColumn<AdminPersonListItem>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, index) => index + 1,
      className: 'text-neutral-500 w-8 pr-2',
    },
    {
      key: 'person',
      label: 'Osoba',
      render: (person) => (
        <div className="flex items-center gap-2.5">
          {person.represented_country_fifa_codes.length > 0 ? (
            <div className="flex items-center gap-0.5">
              {person.represented_country_names.map((name, i) => (
                <CountryFlag
                  key={`${name}-${i}`}
                  fifaCode={person.represented_country_fifa_codes[i] ?? null}
                  countryName={name}
                  className="h-3.5 w-[21px] shrink-0"
                />
              ))}
            </div>
          ) : (
            <span className="inline-block h-3.5 w-[21px] shrink-0" />
          )}
          <Link
            href={`/admin/people/${person.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            {getPersonDisplayName(person)}
            {person.death_date && (
              <span className="font-black text-neutral-500">&#x2020;</span>
            )}
            {getAgeDisplay(person) && (
              <span className="text-neutral-500 font-normal">{getAgeDisplay(person)}</span>
            )}
          </Link>
        </div>
      ),
      // min-w zapewnia stały układ kolumn stat niezależnie od długości nazwy (punkt odniesienia: widok wszystkich krajów w filtrze)
      // spójne z analogicznym ustawieniem w CountriesSearchTable i ClubsSearchTable
      className: 'font-medium pl-2 min-w-[440px]',
    },
    {
      key: 'appearances',
      label: 'Występy',
      headerRender: () => statHeader('appearance_count', <PitchIcon className="h-5 w-5" />, 'Występy'),
      render: (person) => person.roles.includes('PLAYER')
        ? (person.appearance_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{person.appearance_count}</span> : <span className="text-sm text-neutral-600">–</span>)
        : null,
      className: 'text-center px-1!',
    },
    {
      key: 'goals',
      label: 'Bramki',
      headerRender: () => statHeader('goal_count', <GoalIcon className="h-5 w-5" />, 'Bramki'),
      render: (person) => person.roles.includes('PLAYER')
        ? (person.goal_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{person.goal_count}</span> : <span className="text-sm text-neutral-600">–</span>)
        : null,
      className: 'text-center px-1!',
    },
    {
      key: 'assists',
      label: 'Asysty',
      headerRender: () => statHeader('assist_count', <AssistIcon className="h-5 w-5" />, 'Asysty'),
      render: (person) => person.roles.includes('PLAYER')
        ? (person.assist_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{person.assist_count}</span> : <span className="text-sm text-neutral-600">–</span>)
        : null,
      className: 'text-center px-1!',
    },
    {
      key: 'yellow_cards',
      label: 'Żółte kartki',
      headerRender: () => statHeader('yellow_card_count', <YellowCardIcon className="h-5 w-5" />, 'Żółte kartki'),
      render: (person) => person.roles.includes('PLAYER')
        ? (person.yellow_card_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{person.yellow_card_count}</span> : <span className="text-sm text-neutral-600">–</span>)
        : null,
      className: 'text-center px-1!',
    },
    {
      key: 'red_cards',
      label: 'Czerwone kartki',
      headerRender: () => statHeader('red_card_count', <RedCardIcon className="h-5 w-5" />, 'Czerwone kartki'),
      render: (person) => person.roles.includes('PLAYER')
        ? (person.red_card_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{person.red_card_count}</span> : <span className="text-sm text-neutral-600">–</span>)
        : null,
      className: 'text-center px-1!',
    },
    {
      key: 'bench',
      label: 'Ławka',
      headerRender: () => statHeader('bench_count', <BenchIcon className="h-5 w-5" />, 'Ławka rezerwowych'),
      render: (person) => person.roles.includes('PLAYER')
        ? (person.bench_count > 0 ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{person.bench_count}</span> : <span className="text-sm text-neutral-600">–</span>)
        : null,
      className: 'text-center px-1!',
    },
  ]

  return (
    <AdminSearchableTable
      data={sorted}
      columns={columns}
      searchPlaceholder="Wpisz imię, nazwisko albo pseudonim..."
      showHeader={true}
      emptyMessage="Brak osób w bazie danych."
      emptySearchMessage="Brak osób pasujących do wyszukiwanej frazy."
      getPrimaryText={(person) => getPersonDisplayName(person)}
      getSecondaryTexts={(person) => [
        person.nickname,
        person.birth_city_name,
        person.birth_country_name,
        ...person.represented_country_names,
      ]}
      filterConfig={{
        label: '',
        allLabel: 'Wszystkie kraje',
        getValue: (person) => person.represented_country_names.length > 0
          ? person.represented_country_names
          : person.birth_country_name,
      }}
      secondaryFilterConfig={{
        label: '',
        allLabel: 'Wszystkie statusy',
        getValue: (person) => getActivityLabel(person),
      }}
      tertiaryFilterConfig={{
        label: '',
        allLabel: 'Wszystkie funkcje',
        getValue: (person) => person.role_labels,
      }}
      filterWidthClass="md:w-52"
      secondaryFilterWidthClass="md:w-52"
      tertiaryFilterWidthClass="md:w-52"
      defaultFilter="Polska"
      defaultTertiaryFilter="Piłkarz"
      searchIgnoresFilters
    />
  )
}
