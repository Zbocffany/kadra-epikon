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
  type SortKey = 'appearance_count' | 'goal_count' | 'assist_count' | 'yellow_card_count' | 'red_card_count'
  const [sortKey, setSortKey] = useState<SortKey>('appearance_count')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...people].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number)
    return sortDir === 'desc' ? -diff : diff
  })

  function statHeader(key: SortKey, icon: React.ReactNode, label: string) {
    const active = sortKey === key
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className={`flex items-center justify-center gap-0.5 mx-auto transition-opacity ${
          active ? 'opacity-100' : 'opacity-50 hover:opacity-80'
        }`}
        title={label}
      >
        {icon}
        <span className={`text-[10px] leading-none ${
          active ? 'text-neutral-300' : 'text-neutral-500'
        }`}>{sortDir === 'desc' && active ? '▼' : sortDir === 'asc' && active ? '▲' : ''}</span>
      </button>
    )
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
      className: 'font-medium pl-2',
    },
    {
      key: 'appearances',
      label: 'Występy',
      headerRender: () => statHeader('appearance_count', <PitchIcon className="h-5 w-5" />, 'Występy'),
      render: (person) => person.roles.includes('PLAYER')
        ? <span className="text-sm font-semibold text-neutral-300">{person.appearance_count || '–'}</span>
        : null,
      className: 'text-center',
    },
    {
      key: 'goals',
      label: 'Bramki',
      headerRender: () => statHeader('goal_count', <GoalIcon className="h-5 w-5" />, 'Bramki'),
      render: (person) => person.roles.includes('PLAYER')
        ? <span className="text-sm font-semibold text-neutral-300">{person.goal_count || '–'}</span>
        : null,
      className: 'text-center',
    },
    {
      key: 'assists',
      label: 'Asysty',
      headerRender: () => statHeader('assist_count', <AssistIcon className="h-5 w-5" />, 'Asysty'),
      render: (person) => person.roles.includes('PLAYER')
        ? <span className="text-sm font-semibold text-neutral-300">{person.assist_count || '–'}</span>
        : null,
      className: 'text-center',
    },
    {
      key: 'yellow_cards',
      label: 'Żółte kartki',
      headerRender: () => statHeader('yellow_card_count', <YellowCardIcon className="h-5 w-5" />, 'Żółte kartki'),
      render: (person) => person.roles.includes('PLAYER')
        ? <span className="text-sm font-semibold text-neutral-300">{person.yellow_card_count || '–'}</span>
        : null,
      className: 'text-center',
    },
    {
      key: 'red_cards',
      label: 'Czerwone kartki',
      headerRender: () => statHeader('red_card_count', <RedCardIcon className="h-5 w-5" />, 'Czerwone kartki'),
      render: (person) => person.roles.includes('PLAYER')
        ? <span className="text-sm font-semibold text-neutral-300">{person.red_card_count || '–'}</span>
        : null,
      className: 'text-center',
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
      summaryText={(visible, total) =>
        `Wyświetlono ${visible} z ${total} osób. Kliknij osobę, aby przejść do strony szczegółów.`
      }
    />
  )
}
