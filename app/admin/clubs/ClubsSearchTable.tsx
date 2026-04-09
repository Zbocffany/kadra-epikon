'use client'

import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminClub } from '@/lib/db/clubs'
import CountryFlag from '@/components/CountryFlag'

export default function ClubsSearchTable({ clubs }: { clubs: AdminClub[] }) {
  const sorted = [...clubs].sort((a, b) => b.appearance_count - a.appearance_count || a.name.localeCompare(b.name, 'pl'))

  const columns: AdminTableColumn<AdminClub>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, index) => index + 1,
      className: 'text-neutral-500 w-8 pr-2',
    },
    {
      key: 'name',
      label: 'Nazwa',
      render: (club) => (
        <div className="flex items-center gap-2.5">
          <CountryFlag fifaCode={club.country_fifa_code} countryName={club.country_name ?? undefined} className="h-3.5 w-[21px] shrink-0" />
          <div className="relative inline-flex group/tooltip">
            <Link
              href={`/admin/clubs/${club.id}`}
              className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              {club.name}
            </Link>
            {club.city_name && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 opacity-0 transition-opacity group-hover/tooltip:opacity-100">
                {club.city_name}
              </span>
            )}
          </div>
        </div>
      ),
      className: 'font-medium pl-2',
    },
    {
      key: 'stats',
      label: '',
      render: (club) => (club.player_count > 0 || club.appearance_count > 0 || club.goal_count > 0) ? (
        <div className="flex items-center gap-5 text-sm font-semibold text-neutral-500">
          <span>Zawodnicy: <span className="text-neutral-400">{club.player_count}</span></span>
          <span>Występy: <span className="text-neutral-400">{club.appearance_count}</span></span>
          <span>Bramki: <span className="text-neutral-400">{club.goal_count}</span></span>
        </div>
      ) : null,
      className: 'whitespace-nowrap',
    },
  ]

  return (
    <AdminSearchableTable
      data={sorted}
      columns={columns}
      searchPlaceholder="Wpisz nazwę klubu albo miasto..."
      showHeader={false}
      defaultLimit={50}
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
      summaryText={(visible, total) =>
        `Wyświetlono ${visible} z ${total} klubów. Kliknij nazwę klubu, aby przejść do strony szczegółów.`
      }
    />
  )
}