'use client'

import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminClub } from '@/lib/db/clubs'

export default function ClubsSearchTable({ clubs }: { clubs: AdminClub[] }) {
  const columns: AdminTableColumn<AdminClub>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, index) => index + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'name',
      label: 'Nazwa',
      render: (club) => (
        <Link
          href={`/admin/clubs/${club.id}`}
          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          {club.name}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'city',
      label: 'Miasto',
      render: (club) => club.city_name ?? '—',
      className: 'text-neutral-400',
    },
    {
      key: 'country',
      label: 'Kraj',
      render: (club) => club.country_name ?? '—',
      className: 'text-neutral-400',
    },
  ]

  return (
    <AdminSearchableTable
      data={clubs}
      columns={columns}
      searchLabel="Wyszukaj klub"
      searchPlaceholder="Wpisz nazwę klubu albo miasto..."
      priorityHint="Najpierw pokazują się kluby, których nazwa zaczyna się od wpisanej frazy, a potem pozostałe dopasowania."
      emptyMessage="Brak klubów w bazie danych."
      emptySearchMessage="Brak klubów pasujących do wyszukiwanej frazy."
      getPrimaryText={(club) => club.name}
      getSecondaryTexts={(club) => [club.city_name, club.country_name]}
      filterConfig={{
        label: 'Miasto',
        allLabel: 'Wszystkie miasta',
        getValue: (club) => club.city_name,
      }}
      secondaryFilterConfig={{
        label: 'Kraj',
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