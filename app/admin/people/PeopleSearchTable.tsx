'use client'

import { useMemo } from 'react'
import CountryFlag from '@/components/CountryFlag'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminPeopleListRow } from '@/lib/db/people'
import { getPersonDisplayName } from '@/lib/db/people'
import PitchIcon from '@/components/icons/PitchIcon'

function getAgeDisplay(person: AdminPeopleListRow): string | null {
  if (!person.birth_date) return null
  const birth = new Date(person.birth_date)
  const ref = person.death_date ? new Date(person.death_date) : new Date()
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return person.death_date ? null : `(${age} l.)`
}

export default function PeopleSearchTable({
  people,
  basePath = '/admin/people',
  showCountryFilter = true,
  defaultCountryFilter,
}: {
  people: AdminPeopleListRow[]
  basePath?: string
  showCountryFilter?: boolean
  defaultCountryFilter?: string
}) {
  const sorted = useMemo(
    () => [...people].sort((a, b) => b.appearance_count - a.appearance_count),
    [people]
  )

  function renderStatBadge(value: number) {
    return value > 0
      ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value}</span>
      : <span className="text-sm text-neutral-600">–</span>
  }

  const columns: AdminTableColumn<AdminPeopleListRow>[] = [
    {
      key: 'index',
      label: '',
      render: (_, index) => index + 1,
      className: 'text-neutral-500 w-8 pr-2',
    },
    {
      key: 'person',
      label: '',
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
          <SmartPrefetchLink
            href={`${basePath}/${person.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            {getPersonDisplayName(person)}
            {person.death_date && (
              <span className="font-black text-neutral-500">&#x2020;</span>
            )}
            {getAgeDisplay(person) && (
              <span className="text-neutral-500 font-normal">{getAgeDisplay(person)}</span>
            )}
          </SmartPrefetchLink>
        </div>
      ),
      // min-w zapewnia stały układ kolumn stat niezależnie od długości nazwy (punkt odniesienia: widok wszystkich krajów w filtrze)
      // spójne z analogicznym ustawieniem w CountriesSearchTable i ClubsSearchTable
      className: 'font-medium pl-2 min-w-[440px]',
    },
    {
      key: 'appearances',
      label: 'Występy',
      headerRender: () => <span className="inline-flex items-center" title="Występy"><PitchIcon className="h-5 w-5" /></span>,
      render: (person) => renderStatBadge(person.appearance_count),
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
        ...person.coached_country_names,
        ...person.represented_country_names,
      ]}
      filterConfig={showCountryFilter ? {
        label: '',
        allLabel: 'Wszystkie kraje',
        getValue: (person) => (
          person.represented_country_names.length > 0
            ? person.represented_country_names
            : person.birth_country_name
        ),
      } : undefined}
      filterWidthClass="md:w-52"
      defaultFilter={defaultCountryFilter}
      searchIgnoresFilters
    />
  )
}
