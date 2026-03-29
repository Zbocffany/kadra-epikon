'use client'

import Link from 'next/link'
import CountryFlag from '@/components/CountryFlag'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminPersonListItem, AdminPersonRole } from '@/lib/db/people'
import { getPersonDisplayName } from '@/lib/db/people'

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

function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

function getActivityLabel(person: AdminPersonListItem): string {
  return person.is_active ? 'Aktywna' : 'Nieaktywna'
}

export default function PeopleSearchTable({ people }: { people: AdminPersonListItem[] }) {
  const columns: AdminTableColumn<AdminPersonListItem>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, index) => index + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'person',
      label: 'Osoba',
      render: (person) => (
        <Link
          href={`/admin/people/${person.id}`}
          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          {getPersonDisplayName(person)}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'birth_date',
      label: 'Data ur.',
      render: (person) => formatDate(person.birth_date),
      className: 'text-neutral-300',
    },
    {
      key: 'birth_city',
      label: 'Miasto ur.',
      render: (person) => person.birth_city_name ?? '—',
      className: 'text-neutral-400',
    },
    {
      key: 'birth_country',
      label: 'Kraj',
      render: (person) => {
        if (person.represented_country_names.length === 0) return '—'

        return (
          <div className="flex items-center justify-center gap-1">
            {person.represented_country_names.map((name, i) => (
              <CountryFlag
                key={`${name}-${i}`}
                fifaCode={person.represented_country_fifa_codes[i] ?? null}
                countryName={name}
              />
            ))}
          </div>
        )
      },
      className: 'text-center',
    },
    {
      key: 'role',
      label: 'Rola',
      render: (person) => person.roles.length ? (
        <div className="flex items-center justify-center gap-1.5">
          {person.roles.map((role) => {
            const meta = ROLE_META[role]

            return (
              <span
                key={`${person.id}-${role}`}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${meta.className}`}
                title={meta.label}
                aria-label={meta.label}
              >
                {meta.initial}
              </span>
            )
          })}
        </div>
      ) : '—',
      className: 'text-center',
    },
    {
      key: 'active',
      label: 'Aktywna',
      render: (person) => person.is_active ? (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500/15 text-emerald-400"
          title="Aktywna"
          aria-label="Aktywna"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M4.5 10.5L8.25 14.25L15.5 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : (
        <span
          className="inline-flex h-5 w-5 rounded-full border-2 border-red-500"
          title="Nieaktywna"
          aria-label="Nieaktywna"
        />
      ),
      className: 'text-neutral-400 text-center',
    },
  ]

  return (
    <AdminSearchableTable
      data={people}
      columns={columns}
      searchLabel="Wyszukaj osobę"
      searchPlaceholder="Wpisz imię, nazwisko albo pseudonim..."
      priorityHint="Najpierw pokazują się osoby, których nazwa zaczyna się od wpisanej frazy, a potem pozostałe dopasowania."
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
        label: 'Kraj rep.',
        allLabel: 'Wszystkie kraje',
        getValue: (person) => person.represented_country_names.length > 0
          ? person.represented_country_names
          : person.birth_country_name,
      }}
      secondaryFilterConfig={{
        label: 'Aktywność',
        allLabel: 'Wszystkie statusy',
        getValue: (person) => getActivityLabel(person),
      }}
      tertiaryFilterConfig={{
        label: 'Funkcja',
        allLabel: 'Wszystkie funkcje',
        getValue: (person) => person.role_labels,
      }}
      filterWidthClass="md:w-52"
      secondaryFilterWidthClass="md:w-52"
      tertiaryFilterWidthClass="md:w-52"
      summaryText={(visible, total) =>
        `Wyświetlono ${visible} z ${total} osób. Kliknij osobę, aby przejść do strony szczegółów.`
      }
    />
  )
}
